import * as sectionModel from '../models/section.model.js';
import * as orgModel from '../models/org.model.js';
import * as assetService from './asset.service.js';
import { data, persist } from '../models/db.js';
import { HttpError } from '../utils/http.js';
import { newId, slugify } from '../utils/id.js';
import { parseVideoUrl, describeVideoUrlSupport } from '../utils/videoUrl.js';

export const BLOCK_TYPES = [
  // Canvas blocks
  'text',
  'image',
  'video',
  'profile',
  // Composed blocks (also used by the seed content)
  'heading',
  'paragraph',
  'bullets',
  'quote',
  'stats',
  'cards',
  'gallery',
  'divider',
  // Page-builder elements
  'hero',
  'kpi',
  'icon',
  'buttons',
  'logo',
  'box',
  'leader-hero',
  'milestone-timeline',
  'leadership-panels',
  'gallery-wall',
  'course-deck',
  'drift-wall',
  'platforms',
  'coe-wall',
  'story-wall',
  'program-deck',
  'testimonial-wall',
  'placement-wall',
  'event-reel',
  'certification-wall',
  'video-resume',
  'council-grid',
  'roster',
  'hub',
  'stat-wall',
  'book-shelf',
  'paper-tabs',
  'alliance-accordion',
  'skew-carousel',
  'tilted-tiles',
  'card-fan',
  'photo-ring',
  'event-orbit',
  'training-shelf',
  'curriculum-deck',
  'photo-collage',
  'event-wheel',
  'photo-folder',
  'project-showcase',
  'thread-board',
];

export const CARD_VARIANTS = ['plain', 'team', 'partner', 'program', 'placement', 'certification'];

/** Canvas is a 12-column grid; heights are row units used as a minimum. */
export const GRID_COLUMNS = 12;

/** Layout boxes may nest, but not without end. Mirrors MAX_BOX_DEPTH on the client. */
export const MAX_BOX_DEPTH = 3;
const MAX_CHILDREN = 30;

/** Must stay in step with DEFAULT_SIZE in frontend/src/utils/layout.js. */
const DEFAULT_SIZE = {
  text: { w: 6, h: 5 },
  image: { w: 6, h: 8 },
  video: { w: 8, h: 8 },
  profile: { w: 4, h: 11 },
  heading: { w: 12, h: 2 },
  paragraph: { w: 12, h: 3 },
  bullets: { w: 12, h: 4 },
  quote: { w: 12, h: 6 },
  stats: { w: 12, h: 3 },
  cards: { w: 12, h: 10 },
  gallery: { w: 12, h: 9 },
  divider: { w: 12, h: 1 },
  hero: { w: 12, h: 9 },
  kpi: { w: 12, h: 4 },
  icon: { w: 2, h: 4 },
  buttons: { w: 6, h: 3 },
  logo: { w: 3, h: 5 },
  box: { w: 6, h: 10 },
  'leader-hero': { w: 12, h: 15 },
  'milestone-timeline': { w: 12, h: 15 },
  'leadership-panels': { w: 12, h: 15 },
  'gallery-wall': { w: 12, h: 15 },
  'course-deck': { w: 12, h: 15 },
  'drift-wall': { w: 12, h: 15 },
  'platforms': { w: 12, h: 15 },
  'council-grid': { w: 12, h: 15 },
  'roster': { w: 12, h: 15 },
  'hub': { w: 12, h: 15 },
  'stat-wall': { w: 12, h: 15 },
  'book-shelf': { w: 12, h: 15 },
  'paper-tabs': { w: 12, h: 22 },
  'alliance-accordion': { w: 12, h: 15 },
  'skew-carousel': { w: 12, h: 15 },
  'tilted-tiles': { w: 12, h: 15 },
  'card-fan': { w: 12, h: 15 },
  'photo-ring': { w: 12, h: 15 },
  'event-orbit': { w: 12, h: 15 },
  'training-shelf': { w: 12, h: 15 },
  'curriculum-deck': { w: 12, h: 15 },
  'photo-collage': { w: 12, h: 15 },
  'event-wheel': { w: 12, h: 15 },
  'photo-folder': { w: 12, h: 15 },
  'project-showcase': { w: 12, h: 15 },
  'thread-board': { w: 12, h: 15 },
};

const oneOf = (value, allowed, fallback) => (allowed.includes(value) ? value : fallback);

/**
 * Links are rendered as anchors, so only navigable schemes survive. Anything
 * else (javascript:, data:, vbscript:) is dropped rather than sanitised, so a
 * bad value can never round-trip into the DOM.
 */
export function safeHref(value) {
  const raw = String(value ?? '').trim().slice(0, 600);
  if (!raw) return '';
  if (/^(https?:|mailto:|tel:)/i.test(raw)) return raw;
  // Bare domains are a very common paste; make them explicit rather than reject.
  if (/^www\./i.test(raw)) return `https://${raw}`;
  if (raw.startsWith('/') || raw.startsWith('#')) return raw;
  return '';
}

const text = (value, max = 4000) => String(value ?? '').slice(0, max);

/**
 * Icon library keys are rendered straight into a lookup on the client, so only
 * the shape a key can legally have survives: lowercase words and hyphens.
 */
const iconKey = (value) => {
  const raw = String(value ?? '').trim().toLowerCase().slice(0, 40);
  return /^[a-z][a-z0-9-]*$/.test(raw) ? raw : '';
};

/**
 * Panel colours come from the organization's own board rather than from a theme
 * token, so they arrive as literals. Only a well-formed hex survives — the value
 * is written straight into a style attribute, and anything else would be a hole
 * in the same wall `safeHref` guards.
 */
const hexColor = (value) => {
  const raw = String(value ?? '').trim();
  return /^#[0-9a-fA-F]{6}$/.test(raw) ? raw.toUpperCase() : '';
};

const clampInt = (value, min, max, fallback) => {
  const n = Math.round(Number(value));
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, n));
};

/** Layout is optional on input: legacy blocks get a full-width flow position. */
function normalizeLayout(raw, type, index) {
  const size = DEFAULT_SIZE[type] || { w: 12, h: 4 };
  const source = raw?.layout;
  if (!source || typeof source !== 'object') {
    return { x: 0, y: index * 4, w: size.w === 12 ? 12 : 12, h: size.h, auto: true };
  }
  const w = clampInt(source.w, 1, GRID_COLUMNS, size.w);
  return {
    x: clampInt(source.x, 0, GRID_COLUMNS - w, 0),
    y: clampInt(source.y, 0, 9999, index * 4),
    w,
    h: clampInt(source.h, 1, 60, size.h),
    auto: false,
  };
}

function normalizeBlock(raw, index = 0, depth = 0) {
  const type = BLOCK_TYPES.includes(raw?.type) ? raw.type : 'paragraph';
  const block = { id: raw?.id || newId('blk'), type, layout: normalizeLayout(raw, type, index) };

  switch (type) {
    case 'text':
      block.heading = text(raw.heading, 200);
      block.level = raw.level === 3 ? 3 : 2;
      block.body = text(raw.body, 6000);
      block.items = (Array.isArray(raw.items) ? raw.items : [])
        .map((item) => text(item, 500))
        .filter((item) => item.trim())
        .slice(0, 40);
      block.align = ['left', 'center'].includes(raw.align) ? raw.align : 'left';
      break;

    case 'image':
      block.assetId = raw.assetId || null;
      block.title = text(raw.title, 160);
      block.caption = text(raw.caption, 240);
      // Alt text falls back to the title so an image is never unlabelled.
      block.alt = text(raw.alt, 240) || text(raw.title, 160);
      // Showing the whole picture is the default: cropping is a deliberate
      // choice, not something that should happen to an admin by accident.
      block.fit = raw.fit === 'cover' ? 'cover' : 'contain';
      block.radius = oneOf(raw.radius, ['none', 'sm', 'md', 'lg', 'pill'], 'md');
      break;

    case 'video':
      block.source = raw.source === 'url' ? 'url' : 'upload';
      block.assetId = raw.assetId || null;
      block.videoUrl = text(raw.videoUrl, 600).trim();
      block.caption = text(raw.caption, 240);
      block.autoplay = Boolean(raw.autoplay);
      block.loop = Boolean(raw.loop);
      block.muted = raw.muted === undefined ? Boolean(raw.autoplay) : Boolean(raw.muted);
      break;

    case 'profile':
      block.assetId = raw.assetId || null;
      block.name = text(raw.name, 120);
      block.role = text(raw.role, 160);
      block.blurb = text(raw.blurb, 600);
      block.focus = ['top', 'center', 'bottom'].includes(raw.focus) ? raw.focus : 'center';
      block.frame = raw.frame === 'square' ? 'square' : 'portrait';
      break;

    default:
      break;
  }

  switch (type) {
    case 'heading':
      block.text = text(raw.text, 200);
      block.level = raw.level === 3 ? 3 : 2;
      break;
    case 'paragraph':
      block.text = text(raw.text);
      break;
    case 'bullets':
      block.items = (Array.isArray(raw.items) ? raw.items : [])
        .map((item) => text(item, 500))
        .filter((item) => item.trim())
        .slice(0, 40);
      break;
    case 'quote':
      block.text = text(raw.text, 1200);
      block.author = text(raw.author, 120);
      block.role = text(raw.role, 160);
      block.imageAssetId = raw.imageAssetId || null;
      break;
    case 'stats':
      block.items = (Array.isArray(raw.items) ? raw.items : [])
        .map((item) => ({
          value: Number(item?.value) || 0,
          suffix: text(item?.suffix, 8),
          prefix: text(item?.prefix, 8),
          label: text(item?.label, 120),
        }))
        .slice(0, 8);
      break;
    case 'cards':
      block.variant = CARD_VARIANTS.includes(raw.variant) ? raw.variant : 'plain';
      block.items = (Array.isArray(raw.items) ? raw.items : [])
        .map((item) => ({
          id: item?.id || newId('crd'),
          title: text(item?.title, 160),
          subtitle: text(item?.subtitle, 200),
          meta: text(item?.meta, 160),
          body: text(item?.body, 1200),
          imageAssetId: item?.imageAssetId || null,
          tags: (Array.isArray(item?.tags) ? item.tags : []).map((t) => text(t, 40)).slice(0, 8),
        }))
        .slice(0, 60);
      break;
    case 'gallery':
      block.caption = text(raw.caption, 240);
      block.fit = raw.fit === 'cover' ? 'cover' : 'contain';
      block.assetIds = (Array.isArray(raw.assetIds) ? raw.assetIds : [])
        .map((id) => String(id))
        .slice(0, 60);
      block.titles = (Array.isArray(raw.titles) ? raw.titles : [])
        .map((value) => text(value, 160))
        .slice(0, 60);
      break;

    /* ------------------------------------------------ page-builder elements */
    case 'hero':
      block.kicker = text(raw.kicker, 120);
      block.heading = text(raw.heading, 240);
      block.subheading = text(raw.subheading, 600);
      block.media = oneOf(raw.media, ['color', 'image', 'video'], 'color');
      block.source = raw.source === 'url' ? 'url' : 'upload';
      block.assetId = raw.assetId || null;
      block.videoUrl = text(raw.videoUrl, 600).trim();
      /* Seconds into the film the hero should open on, and loop back to. A
         brand film that opens on a title card or a logo sting has nothing on
         screen for the first few seconds, which is exactly the moment the slide
         is doing its work. Capped at an hour so a bad value cannot park the
         film past its own end. */
      block.start = clampInt(raw.start, 0, 3600, 0);
      /* How far past the frame the film is scaled. The stylesheet's own figure
         is 1.325, which exists to push the black bars of a 2.34:1 film exported
         inside a 16:9 frame out of sight. A film that is honestly 16:9 has no
         bars to hide and that scale simply crops a third of it away, so a block
         can set its own. 0 means "leave it to the stylesheet". */
      block.zoom = Math.min(2, Math.max(0, Math.round((Number(raw.zoom) || 0) * 1000) / 1000));
      /* The colour the `[gold:…]` spans in this hero's copy are set in. Unset
         falls through to the stylesheet's NCET orange, which is what the two
         decks that were here first are written against. Never invented: it is
         measured off the organization's own mark. */
      block.accent = hexColor(raw.accent);
      block.alt = text(raw.alt, 240);
      block.overlay = clampInt(raw.overlay, 0, 90, 45);
      block.align = oneOf(raw.align, ['left', 'center', 'right'], 'left');
      block.height = oneOf(raw.height, ['sm', 'md', 'lg', 'full'], 'md');
      block.buttons = normalizeButtons(raw.buttons);
      break;

    case 'kpi':
      block.columns = ['auto', '2', '3', '4'].includes(String(raw.columns)) ? String(raw.columns) : 'auto';
      block.variant = oneOf(raw.variant, ['card', 'plain', 'outline'], 'card');
      block.items = (Array.isArray(raw.items) ? raw.items : [])
        .map((item) => ({
          id: item?.id || newId('kpi'),
          icon: text(item?.icon, 8),
          value: Number(item?.value) || 0,
          prefix: text(item?.prefix, 8),
          suffix: text(item?.suffix, 8),
          label: text(item?.label, 140),
          note: text(item?.note, 160),
        }))
        .slice(0, 12);
      break;

    case 'icon':
      block.glyph = text(raw.glyph, 8) || '★';
      block.label = text(raw.label, 140);
      block.note = text(raw.note, 240);
      block.size = oneOf(raw.size, ['sm', 'md', 'lg'], 'md');
      block.shape = oneOf(raw.shape, ['none', 'circle', 'square'], 'circle');
      block.tone = oneOf(raw.tone, ['accent', 'primary', 'muted'], 'accent');
      break;

    case 'buttons':
      block.items = normalizeButtons(raw.items);
      block.align = oneOf(raw.align, ['left', 'center', 'right'], 'left');
      break;

    case 'logo':
      block.assetId = raw.assetId || null;
      block.title = text(raw.title, 160);
      block.alt = text(raw.alt, 240) || text(raw.title, 160);
      block.href = safeHref(raw.href);
      block.background = oneOf(raw.background, ['none', 'surface', 'soft', 'brand', 'dark'], 'surface');
      block.pad = oneOf(raw.pad, ['none', 'sm', 'md', 'lg'], 'md');
      break;

    case 'leader-hero':
      block.index = text(raw.index, 4);
      block.kicker = text(raw.kicker, 140);
      block.firstName = text(raw.firstName, 40);
      block.lastName = text(raw.lastName, 40);
      block.watermark = text(raw.watermark, 40);
      block.tagline = text(raw.tagline, 240);
      /* Figures set beside the portrait, under the social row — a career in two
         numbers. Drawn only when supplied; nothing is derived. */
      block.highlights = (Array.isArray(raw.highlights) ? raw.highlights : [])
        .map((x) => ({ value: text(x?.value, 24), label: text(x?.label, 80) }))
        .filter((x) => x.value && x.label)
        .slice(0, 3);
      block.body = text(raw.body, 900);
      block.assetId = raw.assetId || null;
      block.alt = text(raw.alt, 240);
      block.tags = (Array.isArray(raw.tags) ? raw.tags : [])
        .map((tag) => ({ label: text(tag?.label, 40), icon: iconKey(tag?.icon), solid: Boolean(tag?.solid) }))
        .filter((tag) => tag.label)
        .slice(0, 6);
      block.links = (Array.isArray(raw.links) ? raw.links : [])
        .map((link) => ({
          label: text(link?.label, 40),
          href: safeHref(link?.href),
          icon: iconKey(link?.icon),
          /* What the in-place panel says about the destination. The sites these point
             at all refuse to be framed and the deck presents offline, so the note is
             the only thing on that panel a presenter can talk to. */
          note: text(link?.note, 240),
          /* Supplied brand artwork, drawn instead of a library glyph. A real logo keeps
             its own colours, which is the whole point of supplying one. */
          logo: text(link?.logo, 220),
          /* A wordmark rather than a glyph, so it needs an oblong instead of a circle -
             ORACLE squeezed into 40px round is a red smudge. */
          wide: Boolean(link?.wide),
        }))
        .filter((link) => link.href)
        .slice(0, 6);
      break;

    /* A timeline the presenter steps through in place. `stops` is ordered and
       the order is the story, so it is never sorted here — "NEXT" is a legal
       label and would not sort after 2026. */
    case 'milestone-timeline':
      block.kicker = text(raw.kicker, 140);
      block.title = text(raw.title, 160);
      // A dark stop needs a ground to sit on; the photo is optional and the
      // block falls back to a painted night sky when there is none.
      block.theme = oneOf(raw.theme, ['light', 'dark'], 'light');
      block.assetId = raw.assetId || null;
      block.alt = text(raw.alt, 240);
      block.sky = raw.sky === undefined ? true : Boolean(raw.sky);
      block.stops = (Array.isArray(raw.stops) ? raw.stops : [])
        .map((stop) => ({
          label: text(stop?.label, 8),
          title: text(stop?.title, 120),
          bullets: (Array.isArray(stop?.bullets) ? stop.bullets : [])
            .map((line) => text(line, 200))
            .filter(Boolean)
            .slice(0, 8),
        }))
        .filter((stop) => stop.label && stop.title)
        .slice(0, 24);
      break;

    /* A wall of panels, one per chapter, that open one at a time. `accent` is
       a per-panel colour from the organization's board rather than a theme
       token, so it is validated as a hex literal and dropped if it is not one. */
    /* A council read as a grid of faces: one card per member, each carrying a
       name the designer may break over two lines with 
, a role, and a
       portrait. Deliberately flat — no summary, no highlights — because the
       page is a board, not a narrative. */
    /* A roll of names with no photographs: a governing body, a council, a
       committee. Each entry carries the person's own position separately from
       the seat they hold on the body, because the source material distinguishes
       them and collapsing the two loses which is which. `note` is the footing
       a minutes sheet usually carries. */
    /* A chooser: a small set of doors onto the pages beneath this one. The
       target is a section id, resolved by the client at click time, because a
       hub is only ever built against sections in its own organization. */
    /* A wall of figures, each in its own tile with a drawing of itself.
       `viz` picks the drawing: a counted total, a bar set, a two-way split or
       a ratio. Percentages are carried rather than derived, because the source
       document rounds them and re-deriving would silently disagree with it. */
    case 'stat-wall':
      block.kicker = text(raw.kicker, 140);
      block.standfirst = text(raw.standfirst, 200);
      block.note = text(raw.note, 200);
      block.tiles = (Array.isArray(raw.tiles) ? raw.tiles : [])
        .map((tile) => ({
          title: text(tile?.title, 80),
          caption: text(tile?.caption, 160),
          viz: oneOf(tile?.viz, ['count', 'bars', 'split', 'donut', 'rings', 'pie', 'ratio'], 'count'),
          value: text(tile?.value, 24),
          span: Math.min(6, Math.max(1, Number(tile?.span) || 2)),
          series: (Array.isArray(tile?.series) ? tile.series : [])
            .map((point) => ({
              label: text(point?.label, 40),
              value: text(point?.value, 16),
              percent: text(point?.percent, 8),
            }))
            .filter((point) => point.label)
            .slice(0, 6),
        }))
        .filter((tile) => tile.title)
        .slice(0, 8);
      break;

    /* A shelf of books, one per sheet of figures, each opening onto its own
       table and nothing else. Three is not arbitrary: the showcase's authored
       geometry places exactly three volumes, one centre and one leaning in
       from either side, so a fourth has nowhere to stand.

       The table is carried as rows of cells rather than as typed columns
       because each sheet has its own columns — a programme list and a research
       register share no fields — and a schema that named them would have to
       name every sheet the deck will ever hold. `total` marks the row the
       source document itself sets apart as a summation; it is a property of
       the sheet, not something derived here, so a sheet whose printed total
       disagrees with its own column still shows what the sheet says. */
    /* Three panels behind one nav row. A tab is either the film — the hero
       block carried through whole, with the same fields it always had, so
       nothing about its art direction is re-specified here — or a sheet
       printed on the translucent paper.

       A sheet's body is a list of entries because both shapes it has to take
       are lists: a roll of recognitions, where the label is empty and the
       body is the line; and a set of named statements, where the label is
       "Vision" or "Mission". `layout` says which of the two to draw rather
       than leaving the renderer to infer it from whether labels happen to be
       present. Bold runs ride inside the body as **…**, because canvas has no
       rich text and the source sheets bold a phrase mid-sentence. */
    case 'paper-tabs':
      block.wordmark = text(raw.wordmark, 24);
      block.tabs = (Array.isArray(raw.tabs) ? raw.tabs : [])
        .map((tab) => {
          const kind = oneOf(tab?.kind, ['hero', 'sheet'], 'sheet');
          const out = { label: text(tab?.label, 60), kind };
          if (kind === 'hero') {
            const hero = tab?.hero || {};
            out.hero = {
              kicker: text(hero.kicker, 120),
              heading: text(hero.heading, 240),
              subheading: text(hero.subheading, 600),
              media: oneOf(hero.media, ['color', 'image', 'video'], 'color'),
              source: hero.source === 'url' ? 'url' : 'upload',
              assetId: hero.assetId || null,
              videoUrl: text(hero.videoUrl, 600).trim(),
              alt: text(hero.alt, 240),
              overlay: clampInt(hero.overlay, 0, 90, 45),
              align: oneOf(hero.align, ['left', 'center', 'right'], 'left'),
              height: oneOf(hero.height, ['sm', 'md', 'lg', 'full'], 'md'),
              buttons: normalizeButtons(hero.buttons),
            };
            out.sheet = null;
          } else {
            const sheet = tab?.sheet || {};
            out.hero = null;
            out.sheet = {
              eyebrow: text(sheet.eyebrow, 60),
              title: text(sheet.title, 80),
              layout: oneOf(sheet.layout, ['bullets', 'sections'], 'bullets'),
              mark: text(sheet.mark, 24),
              markNote: text(sheet.markNote, 80),
              edgeTag: text(sheet.edgeTag, 24),
              entries: (Array.isArray(sheet.entries) ? sheet.entries : [])
                .map((entry) => ({
                  label: text(entry?.label, 40),
                  body: text(entry?.body, 600),
                }))
                .filter((entry) => entry.body)
                .slice(0, 20),
            };
          }
          return out;
        })
        .filter((tab) => tab.label)
        .slice(0, 4);
      break;

    case 'book-shelf':
      block.books = (Array.isArray(raw.books) ? raw.books : [])
        .map((book) => ({
          title: text(book?.title, 60),
          kicker: text(book?.kicker, 40),
          subtitle: text(book?.subtitle, 60),
          footer: text(book?.footer, 60),
          coverColor: text(book?.coverColor, 24),
          coverAssetId: book?.coverAssetId || null,
          motionAssetId: book?.motionAssetId || null,
          note: text(book?.note, 240),
          columns: (Array.isArray(book?.columns) ? book.columns : [])
            .map((column) => text(column, 60))
            .filter(Boolean)
            .slice(0, 5),
          rows: (Array.isArray(book?.rows) ? book.rows : [])
            .map((row) => ({
              total: row?.total === true,
              cells: (Array.isArray(row?.cells) ? row.cells : [])
                .map((cell) => text(cell, 120))
                .slice(0, 5),
            }))
            .filter((row) => row.cells.some(Boolean))
            .slice(0, 24),
        }))
        .filter((book) => book.title)
        .slice(0, 3);
      break;

    case 'hub':
      block.kicker = text(raw.kicker, 140);
      block.standfirst = text(raw.standfirst, 200);
      block.logoAssetId = raw.logoAssetId || null;
      block.doors = (Array.isArray(raw.doors) ? raw.doors : [])
        .map((door) => ({
          label: text(door?.label, 60),
          targetId: text(door?.targetId, 64),
        }))
        .filter((door) => door.label)
        .slice(0, 6);
      break;

    case 'roster':
      block.kicker = text(raw.kicker, 140);
      // One mark for the whole roll: every card carries the institution's
      // emblem, not the person's own employer.
      block.logoAssetId = raw.logoAssetId || null;
      block.meta = text(raw.meta, 80);
      block.standfirst = text(raw.standfirst, 200);
      block.note = text(raw.note, 200);
      block.entries = (Array.isArray(raw.entries) ? raw.entries : [])
        .map((entry) => ({
          name: text(entry?.name, 120),
          affiliation: text(entry?.affiliation, 200),
          role: text(entry?.role, 60),
        }))
        .filter((entry) => entry.name)
        .slice(0, 40);
      break;

    case 'council-grid':
      block.kicker = text(raw.kicker, 140);
      block.standfirst = text(raw.standfirst, 200);
      block.members = (Array.isArray(raw.members) ? raw.members : [])
        .map((member) => ({
          name: text(member?.name, 80),
          role: text(member?.role, 60),
          assetId: member?.assetId || null,
        }))
        .filter((member) => member.name)
        .slice(0, 8);
      break;

    case 'leadership-panels':
      block.kicker = text(raw.kicker, 140);
      block.titleLines = (Array.isArray(raw.titleLines) ? raw.titleLines : [])
        .map((line) => text(line, 60))
        .filter(Boolean)
        .slice(0, 2);
      block.standfirst = text(raw.standfirst, 200);
      block.panels = (Array.isArray(raw.panels) ? raw.panels : [])
        .map((panel) => ({
          title: text(panel?.title, 60),
          chapter: text(panel?.chapter, 80),
          year: text(panel?.year, 24),
          role: text(panel?.role, 90),
          // 900, not 500. A real chapter of the journey runs past 500 and the
          // cap silently cut one mid-sentence — the Ecosystem Builder summary
          // stopped at "…Flipkart, Myntra," on the published page.
          summary: text(panel?.summary, 900),
          icon: iconKey(panel?.icon),
          accent: hexColor(panel?.accent),
          assetId: panel?.assetId || null,
          highlights: (Array.isArray(panel?.highlights) ? panel.highlights : [])
            .map((line) => text(line, 160))
            .filter(Boolean)
            .slice(0, 6),
        }))
        .filter((panel) => panel.title)
        .slice(0, 9);
      break;

    /* A wall of moments behind a hollow title, then the anniversary frame.
       Tiles carry an assetId rather than a path: a path would be resolved
       against whatever machine the deck happens to be running on, and the
       whole point is that the images survive being deployed. */
    case 'gallery-wall':
      block.eyebrow = text(raw.eyebrow, 80);
      block.title = text(raw.title, 80);
      block.subtitle = text(raw.subtitle, 160);
      block.tiles = (Array.isArray(raw.tiles) ? raw.tiles : [])
        .map((tile) => ({ assetId: tile?.assetId || null, tag: text(tile?.tag, 40) }))
        .filter((tile) => tile.assetId)
        .slice(0, 120);
      block.decade = raw.decade && typeof raw.decade === 'object'
        ? {
            assetId: raw.decade.assetId || null,
            mark: text(raw.decade.mark, 8),
            years: text(raw.decade.years, 24),
            line: text(raw.decade.line, 90),
            alt: text(raw.decade.alt, 240),
          }
        : null;
      break;

    /* A course prospectus, paged. One block holds every frame of the flyer —
       the offer, why it stands out, the curriculum, the benefits, the close —
       and the presenter steps through them. Frames are generic on purpose:
       `cards` and `modules` are the two shapes the content actually takes, and
       a third would have been a fourth block type for no gain. */
    case 'course-deck':
      block.eyebrow = text(raw.eyebrow, 120);
      block.titleLines = (Array.isArray(raw.titleLines) ? raw.titleLines : [])
        .map((line) => text(line, 40)).filter(Boolean).slice(0, 2);
      block.standfirst = text(raw.standfirst, 400);
      block.stats = (Array.isArray(raw.stats) ? raw.stats : [])
        .map((s) => ({ value: text(s?.value, 24), label: text(s?.label, 60) }))
        .filter((s) => s.value || s.label).slice(0, 4);
      /* The flyer's middle tile is a credential seal, not a number. It sits in
         the same row as "16 Modules" and "50+ Tools" and carries as much of the
         offer as either, so it is a first-class field rather than a stat with
         no value. */
      block.credential = raw.credential && typeof raw.credential === 'object'
        ? {
            ring: text(raw.credential.ring, 40),
            name: text(raw.credential.name, 60),
            note: text(raw.credential.note, 40),
          }
        : null;
      /* A partner is set in type unless a real file is supplied. The rule has
         not changed — a hand-traced vendor mark is still worse than a name in
         type — but the official Claude Partner Network and OpenAI Select
         Partner lockups arrived from the user (2026-09-18), so `logo` carries
         them and a partner without one still stands in type beside them. */
      block.partners = (Array.isArray(raw.partners) ? raw.partners : [])
        .map((p) => ({
          name: text(p?.name, 60),
          note: text(p?.note, 40),
          logo: (() => {
            const t = text(p?.logo, 240).replace(/^\/+/, '');
            return /^[A-Za-z0-9][A-Za-z0-9 _.-]*(\/[A-Za-z0-9][A-Za-z0-9 _.-]*)*$/.test(t) ? t : '';
          })(),
        }))
        .filter((p) => p.name).slice(0, 6);
      block.frames = (Array.isArray(raw.frames) ? raw.frames : [])
        .map((f) => ({
          /* 'split' and 'people' were rendered by the component long before
             they were allowed here, because those frames were written straight
             into the store. Anything PATCHed through this route was therefore
             coerced to 'cards' — which turned the ten-portrait team frame into
             a list of names and dropped its photographs, silently, on a write
             that was about something else entirely. */
          kind: oneOf(f?.kind, ['cards', 'modules', 'split', 'people', 'close'], 'cards'),
          eyebrow: text(f?.eyebrow, 80),
          title: text(f?.title, 120),
          subtitle: text(f?.subtitle, 240),
          /* 'people' lays out five across; the cards and modules frames are
             one to three, which is why this used to be capped at 3. */
          columns: clampInt(f?.columns, 1, 6, 2),
          /* The half-frame artwork a 'split' shows. */
          figure: (() => {
            const t = text(f?.figure, 240).replace(/^\/+/, '');
            return /^[A-Za-z0-9][A-Za-z0-9 _.-]*(\/[A-Za-z0-9][A-Za-z0-9 _.-]*)*$/.test(t) ? t : '';
          })(),
          figureAlt: text(f?.figureAlt, 160),
          /* A mark set into the frame's own corner — the certification the
             frame is about, where the frame is not about a picture. */
          badge: (() => {
            const t = text(f?.badge, 240).replace(/^\/+/, '');
            return /^[A-Za-z0-9][A-Za-z0-9 _.-]*(\/[A-Za-z0-9][A-Za-z0-9 _.-]*)*$/.test(t) ? t : '';
          })(),
          badgeAlt: text(f?.badgeAlt, 160),
          items: (Array.isArray(f?.items) ? f.items : [])
            .map((i) => ({
              title: text(i?.title, 120),
              body: text(i?.body, 400),
              icon: iconKey(i?.icon),
              /* A file under /uploads drawn in the card's mark instead of the
                 icon — a credential's own badge, say. Same path rule as every
                 other block's media field. */
              logo: (() => {
                const t = text(i?.logo, 240).replace(/^\/+/, '');
                return /^[A-Za-z0-9][A-Za-z0-9 _.-]*(\/[A-Za-z0-9][A-Za-z0-9 _.-]*)*$/.test(t) ? t : '';
              })(),
              /* A face, on a 'people' frame. Same path rule; dropped here is a
                 roster of initials where ten portraits were meant to be. */
              photo: (() => {
                const t = text(i?.photo, 240).replace(/^\/+/, '');
                return /^[A-Za-z0-9][A-Za-z0-9 _.-]*(\/[A-Za-z0-9][A-Za-z0-9 _.-]*)*$/.test(t) ? t : '';
              })(),
            }))
            .filter((i) => i.title).slice(0, 20),
          chips: (Array.isArray(f?.chips) ? f.chips : [])
            .map((c) => text(c, 40)).filter(Boolean).slice(0, 12),
          stats: (Array.isArray(f?.stats) ? f.stats : [])
            .map((s) => ({ value: text(s?.value, 24), label: text(s?.label, 60) }))
            .filter((s) => s.value).slice(0, 4),
          lines: (Array.isArray(f?.lines) ? f.lines : [])
            .map((l) => text(l, 160)).filter(Boolean).slice(0, 4),
          contact: (Array.isArray(f?.contact) ? f.contact : [])
            .map((c) => ({ icon: iconKey(c?.icon), label: text(c?.label, 80) }))
            .filter((c) => c.label).slice(0, 4),
        }))
        .slice(0, 8);
      break;

    /* Tiles drifting on a 3D plane. Tuning values are stored so the wall can be
       retimed without a deploy; each is clamped, because these drive an
       animation loop and a hostile value is a frozen tab. */
    case 'drift-wall':
      block.titleTop = text(raw.titleTop, 40);
      block.titleBottom = text(raw.titleBottom, 40);
      block.tagline = text(raw.tagline, 80);
      /* A mark in the middle instead of the two-colour name: a file under
         /uploads, the way the newer blocks carry theirs. `brand` names the deck
         in the viewer's tag when a tile has no category; `plate` is the colour
         of the scrim the mark sits on. */
      block.logo = (() => {
        const t = text(raw.logo, 240).replace(/^\/+/, '');
        return /^[A-Za-z0-9][A-Za-z0-9 _.\-]*(\/[A-Za-z0-9][A-Za-z0-9 _.\-]*)*$/.test(t) ? t : '';
      })();
      block.brand = text(raw.brand, 40);
      block.plate = hexColor(raw.plate);
      block.columns = clampInt(raw.columns, 2, 14, 8);
      block.tileWidth = clampInt(raw.tileWidth, 80, 480, 230);
      block.tileHeight = clampInt(raw.tileHeight, 60, 400, 150);
      block.gap = clampInt(raw.gap, 0, 60, 18);
      block.radius = clampInt(raw.radius, 0, 40, 14);
      block.tilt = clampInt(raw.tilt, -30, 30, 4);
      block.perspective = clampInt(raw.perspective, 200, 4000, 1200);
      block.depth = clampInt(raw.depth, 0, 600, 90);
      block.speed = clampInt(raw.speed, 0, 200, 42);
      block.lift = clampInt(raw.lift, 0, 200, 50);
      block.variance = Math.min(1, Math.max(0, Number(raw.variance) || 0.35));
      block.parallax = Math.min(2, Math.max(0, Number(raw.parallax) ?? 0.4));
      block.dim = Math.min(1, Math.max(0.2, Number(raw.dim) || 0.88));
      // assetId, not a path: a `/images/...` string resolves against whoever is
      // serving the page, so the wall would be full for the author and empty
      // for everyone who opened the deployed link.
      block.items = (Array.isArray(raw.items) ? raw.items : [])
        .map((i) => ({
          assetId: i?.assetId || null,
          title: text(i?.title, 60),
          tag: text(i?.tag, 60),
          category: text(i?.category, 40),
        }))
        .filter((i) => i.assetId)
        /* Torii's snapshot is its whole photograph library, 383 tiles; the wall
           lazy-loads and interleaves by category, so the count is not the
           cost — the bytes per tile are, and the publisher keeps those small. */
        .slice(0, 400);
      break;

    /* A wall of platform cards; opening one runs it inside the slide.
       Credentials are stored as given — the user was told they end up in the
       store, in git and on the deployed server, and chose that. */
    case 'platforms':
      block.eyebrow = text(raw.eyebrow, 120);
      block.title = text(raw.title, 120);
      block.subtitle = text(raw.subtitle, 240);
      block.items = (Array.isArray(raw.items) ? raw.items : [])
        .map((p) => ({
          name: text(p?.name, 80),
          blurb: text(p?.blurb, 240),
          icon: iconKey(p?.icon),
          /* The platform's own mark, a path under /uploads. `tone` says which
             ground it was cut from — these are crops of the products' own login
             screens and posters, so a white-on-black wordmark needs a dark tile
             behind it while a logo drawn for white paper needs a light one. The
             alternative would be sampling pixels at render time. */
          logo: text(p?.logo, 200),
          /* The product's own colour, for the rail's active card. Taken from
             each platform's own login page, not invented. */
          tint: hexColor(p?.tint),
          tone: oneOf(text(p?.tone, 8), ['dark', 'light'], 'light'),
          // The screenshot's filename under /uploads/platforms, without the
          // extension. Named explicitly rather than derived from the title, so
          // renaming a platform on screen never breaks its image.
          shot: text(p?.shot, 80),
          url: safeHref(p?.url),
          adminUrl: safeHref(p?.adminUrl),
          logins: (Array.isArray(p?.logins) ? p.logins : [])
            .map((l) => ({
              role: text(l?.role, 40),
              user: text(l?.user, 120),
              pass: text(l?.pass, 120),
              url: safeHref(l?.url),
            }))
            .filter((l) => l.user)
            .slice(0, 8),
          /* A platform can present more than one face: TAG and the AI Ready
             Engineer LMS each have a portal the students and staff use and a
             separate admin sign-in, with their own URL, their own roles and
             their own recording. A platform with one face simply omits this
             and the item's own url/shot/logins stand as the single view. */
          views: (Array.isArray(p?.views) ? p.views : [])
            .map((v) => ({
              label: text(v?.label, 40),
              shot: text(v?.shot, 80),
              url: safeHref(v?.url),
              logins: (Array.isArray(v?.logins) ? v.logins : [])
                .map((l) => ({
                  role: text(l?.role, 40),
                  user: text(l?.user, 120),
                  pass: text(l?.pass, 120),
                  url: safeHref(l?.url),
                }))
                .filter((l) => l.user)
                .slice(0, 8),
            }))
            .filter((v) => v.url)
            .slice(0, 4),
        }))
        .filter((p) => p.name && p.url)
        .slice(0, 12);
      break;

    /* An accordion of alliance photographs: one panel is open, the rest are
       collapsed to a slat, and moving across them opens whichever is under the
       pointer. Ported from a React/GSAP sketch (reactbits AccordionGallery) —
       see AllianceAccordion.js for what changed and why.

       Panels carry an `assetId`, never a path, for the reason gallery-wall does:
       a path resolves against whichever machine is serving, so the wall would be
       complete for whoever authored it and empty for everyone opening the
       deployed link. */
    case 'alliance-accordion':
      block.eyebrow = text(raw.eyebrow, 120);
      block.title = text(raw.title, 160);
      block.subtitle = text(raw.subtitle, 280);
      block.panels = (Array.isArray(raw.panels) ? raw.panels : [])
        .map((p) => ({
          /* Optional. An agreement whose photograph has not been supplied still
             gets a card — set as type on a plate in its own colour — rather than
             being dropped, which would silently shorten the row and leave the
             deck claiming fewer MOUs than there are. */
          assetId: p?.assetId || null,
          /* The caption on the open panel. `kicker` sits above it in the accent
             and `note` under it — an alliance is a partner, a kind of agreement
             and what it gives the student, and one line cannot hold all three. */
          kicker: text(p?.kicker, 40),
          label: text(p?.label, 80),
          note: text(p?.note, 160),
          /* What the panel is called while it is closed, set up the slat. It
             falls back to `label`, which is right for a partner — "Pega" reads
             fine either way — but not for the lead panel, whose label is the
             section's own title and far too long to stand on a 140px slat. */
          slat: text(p?.slat, 24),
          alt: text(p?.alt, 240),
          /* The lead panel sets the section's own title in the caption slot and
             is the one open on arrival, so the slide never opens on a row of
             identical slats with nothing said. It is a flag rather than a
             separate block field because which panel leads is a content
             decision, and the publisher already orders the panels. */
          /* 'intro' is the card the row rests on and returns to: no photograph
             at all, a heading and a line of prose. Anything else is an
             agreement. `lead` is the older spelling of the same idea and is
             still honoured so stored content keeps working. */
          kind: oneOf(text(p?.kind, 8), ['intro', 'mou'], p?.lead ? 'intro' : 'mou'),
          heading: text(p?.heading, 90),
          body: text(p?.body, 300),
          // The partner's own colour, for the plate. Never invented — it comes
          // off the partner's own mark, the way the centres' colours do.
          tint: hexColor(p?.tint),
          /* The initials on that plate, when deriving them from the name gets it
             wrong — "Institute of Advanced Energy (IAE)" reduces to INA, which
             is not what anyone calls it. */
          mono: text(p?.mono, 4),
          href: safeHref(p?.href),
        }))
        .filter((p) => p.assetId || p.label || p.heading)
        .slice(0, 8);
      /* Clamped to the panel list rather than stored blind: a defaultIndex left
         past the end of a shortened list would open nothing, which is exactly
         the dead-looking slide the lead panel exists to prevent. */
      block.defaultIndex = clampInt(raw.defaultIndex, 0, Math.max(0, block.panels.length - 1), 0);
      /* The share of the row the open panel takes. The sketch's 0.2–0.9 range is
         kept: below 0.2 opening one changes nothing, above 0.9 the others vanish. */
      block.expandRatio = clampInt(Math.round(Number(raw.expandRatio ?? 0.52) * 100), 20, 90, 52) / 100;
      block.trigger = oneOf(text(raw.trigger, 8), ['hover', 'click'], 'hover');
      block.grayscale = raw.grayscale !== false;
      break;

    case 'testimonial-wall':
      block.eyebrow = text(raw.eyebrow, 120);
      block.title = text(raw.title, 160);
      block.people = (Array.isArray(raw.people) ? raw.people : [])
        .map((p) => ({
          name: text(p?.name, 80),
          note: text(p?.note, 160),
          // A local portrait, pulled from the film so it survives offline.
          photo: text(p?.photo, 200),
          youtube: text(p?.youtube, 24),
          src: text(p?.src, 200),
        }))
        .filter((p) => p.name && (p.youtube || p.src))
        .slice(0, 24);
      break;

    /* Certifications. Same shape as the placement wall and for the same reason:
       these are finished announcement cards with the cohort count, the vendor
       badge and the branding already set into them, so nothing may be cropped and
       the real pixels have to travel with the data.
       Unlike Placements they are almost all square, which is why the wall can be
       a uniform grid rather than solved rows. */
    case 'video-resume':
      block.eyebrow = text(raw.eyebrow, 120);
      block.title = text(raw.title, 160);
      block.lead = text(raw.lead, 400);
      block.people = (Array.isArray(raw.people) ? raw.people : [])
        .map((p) => ({
          name: text(p?.name, 80),
          // A YouTube id, or a file under /uploads — never both.
          youtube: text(p?.youtube, 24),
          src: text(p?.src, 200),
        }))
        .filter((p) => p.name && (p.youtube || p.src))
        .slice(0, 400);
      break;

    case 'certification-wall':
      block.eyebrow = text(raw.eyebrow, 120);
      block.title = text(raw.title, 160);
      block.lead = text(raw.lead, 400);
      block.quote = text(raw.quote, 400);
      block.quoteBy = text(raw.quoteBy, 160);
      /* A wide cohort photograph held far back behind the register's type. */
      block.backdrop = text(raw.backdrop, 240);
      /* The register's second figure, as the deck states it ("16,000+"); a deck
         that leaves it out shows the total alone. And the total's split by year,
         when the deck has one. Neither is derived from anything. */
      block.trainees = text(raw.trainees, 20);
      block.years = (Array.isArray(raw.years) ? raw.years : [])
        .map((y) => ({ label: text(y?.label, 40), count: clampInt(y?.count, 0, 1000000, 0) }))
        .filter((y) => y.label && y.count)
        .slice(0, 6);
      /* The catalogue: named credentials, who awards them, how many hold each and
         what the exam tests. Counts come from the workbook via the publisher, so
         nothing here is recomputed. */
      block.credentials = (Array.isArray(raw.credentials) ? raw.credentials : [])
        .map((c) => ({
          name: text(c?.name, 160),
          vendor: text(c?.vendor, 80),
          domain: text(c?.domain, 80),
          held: clampInt(c?.held, 0, 1000000, 0),
          /* A file under /uploads. The badges are downloaded locally because this
             deck presents with no network; one the CDN refuses carries none and
             falls back to the vendor set in type. */
          badge: text(c?.badge, 240),
          /* Whether the badge is shown on the register's arcs. False for a badge
             that is a PHOTOGRAPH of a badge rather than the artwork — cropped
             from a cohort card, so it carries a brick wall or a dark plate
             behind it. Those read as stickers on the register's clean sheet.
             Skills Unlocked shows every badge either way; this governs the arcs
             alone, and an unset value means yes, as it always did. */
          onRegister: c?.onRegister !== false,
          skills: (Array.isArray(c?.skills) ? c.skills : [])
            .map((k) => text(k, 140)).filter(Boolean).slice(0, 8),
        }))
        .filter((c) => c.name && c.vendor)
        .slice(0, 200);
      /* The cohort artwork, one folder per vendor. Every card carries its real
         pixel size so the wall can solve justified rows before a byte of image
         data has landed — and so nothing is ever cropped or stretched. */
      block.vendors = (Array.isArray(raw.vendors) ? raw.vendors : [])
        .map((v) => ({
          key: text(v?.key, 60),
          name: text(v?.name, 80),
          domain: text(v?.domain, 80),
          skills: (Array.isArray(v?.skills) ? v.skills : [])
            .map((k) => text(k, 140)).filter(Boolean).slice(0, 8),
          certs: (Array.isArray(v?.certs) ? v.certs : [])
            .map((c) => ({
              src: text(c?.src, 240),
              label: text(c?.label, 160),
              w: clampInt(c?.w, 1, 20000, 0),
              h: clampInt(c?.h, 1, 20000, 0),
            }))
            // No dimensions means no row height can be solved for it.
            .filter((c) => c.src && c.w && c.h)
            .slice(0, 120),
        }))
        .filter((v) => v.key && v.certs.length)
        .slice(0, 40);
      break;

    /* Events as a ring turned by hand. One group is one event: a poster (its
       first picture) on the ring, and the whole set behind it when the card is
       clicked. Paths are relative to `base`, the way the placement wall and the
       event reel store theirs. */
    case 'event-orbit':
      block.eyebrow = text(raw.eyebrow, 120);
      block.title = text(raw.title, 160);
      block.base = text(raw.base, 120);
      block.groups = (Array.isArray(raw.groups) ? raw.groups : [])
        .map((g) => ({
          title: text(g?.title, 160),
          images: (Array.isArray(g?.images) ? g.images : [])
            .map((im) => ({
              src: text(im?.src, 240),
              label: text(im?.label, 160),
              w: Number(im?.w) || null,
              h: Number(im?.h) || null,
            }))
            .filter((im) => im.src)
            .slice(0, 60),
        }))
        /* The ring solves its radius from the count, so it widens rather than
           overlapping as events are added; past two dozen the cards are edge-on
           to each other whatever the radius. A display limit, not a storage one. */
        .filter((g) => g.title && g.images.length)
        .slice(0, 24);
      break;

    /* Cards standing on a turntable. Pictures are stored as paths relative to
       `base`, the way the placement wall and the event reel store theirs — a set
       arrives as a folder and a manifest, not as an upload each. */
    case 'photo-ring': {
      block.eyebrow = text(raw.eyebrow, 120);
      block.title = text(raw.title, 160);
      block.lead = text(raw.lead, 400);
      block.base = text(raw.base, 120);
      /* What the "everything" filter is called. Only ever shown when there is
         more than one set to combine. */
      block.allLabel = text(raw.allLabel, 60);

      /* Past a couple of dozen the cards stand behind each other however wide
         the fan gets. A display limit, not a storage one. */
      const shotList = (arr) => (Array.isArray(arr) ? arr : [])
        .map((s) => ({
          src: text(s?.src, 200),
          label: text(s?.label, 160),
          w: Number(s?.w) || null,
          h: Number(s?.h) || null,
        }))
        .filter((s) => s.src)
        .slice(0, 24);

      /* The sets behind the filters. A block written before the filters existed
         carries a flat `shots` list instead, and both are kept: dropping the
         flat one here would empty every ring saved before this. */
      block.groups = (Array.isArray(raw.groups) ? raw.groups : [])
        .map((g) => ({
          key: text(g?.key, 40),
          name: text(g?.name, 80),
          shots: shotList(g?.shots),
        }))
        .filter((g) => g.name && g.shots.length)
        .slice(0, 12);
      block.shots = shotList(raw.shots);
      break;
    }

    case 'event-reel':
      block.eyebrow = text(raw.eyebrow, 120);
      block.title = text(raw.title, 160);
      block.lead = text(raw.lead, 400);
      /* The folder under /uploads that photograph entries are stored relative
         to. Films do not use it; an all-film reel can leave it unset. */
      block.base = text(raw.base, 120);
      block.chapters = (Array.isArray(raw.chapters) ? raw.chapters : [])
        .map((c) => ({
          key: text(c?.key, 40),
          name: text(c?.name, 80),
          icon: text(c?.icon, 40),
          blurb: text(c?.blurb, 240),
          /* A chapter whose entries are themselves in order — the anniversary
             films — is drawn as one connected run rather than a set of cards. */
          sequential: Boolean(c?.sequential),
          groups: (Array.isArray(c?.groups) ? c.groups : [])
            .map((g) => ({
              title: text(g?.title, 160),
              films: (Array.isArray(g?.films) ? g.films : [])
                .map((f) => ({
                  // A YouTube id, or a file under /uploads — never both.
                  youtube: text(f?.youtube, 24),
                  src: text(f?.src, 200),
                  label: text(f?.label, 120),
                }))
                .filter((f) => f.youtube || f.src)
                .slice(0, 24),
              /* An entry may be a folder of photographs instead of a film: not
                 every event was filmed. Paths are relative to the block's `base`
                 and carry their true pixel dimensions, the way the placement
                 wall stores them, so the grid can lay them out without waiting
                 for each file to decode. */
              images: (Array.isArray(g?.images) ? g.images : [])
                .map((p) => ({
                  src: text(p?.src, 200),
                  label: text(p?.label, 160),
                  w: Number(p?.w) || null,
                  h: Number(p?.h) || null,
                }))
                .filter((p) => p.src)
                .slice(0, 60),
            }))
            /* Either kind makes an entry. The old films-only test would have
               dropped every photographed event on the next save. */
            .filter((g) => g.title && (g.films.length || g.images.length))
            .slice(0, 60),
        }))
        .filter((c) => c.key && c.name && c.groups.length)
        .slice(0, 12);
      break;

    /* Placements. Every image carries its true pixel dimensions, and that is
       the point of the type rather than an optimisation: the gallery packs
       justified rows whose heights come from the real aspect ratios, so nothing
       is ever cropped to a uniform tile or stretched to fill one. Without w/h
       arriving with the data the layout could only be computed after every
       image had loaded, which means a page that visibly reflows. */
    case 'placement-wall':
      block.eyebrow = text(raw.eyebrow, 120);
      block.title = text(raw.title, 160);
      block.lead = text(raw.lead, 400);
      /* The folder under /uploads every `src` in this block hangs off. It was
         hardcoded to Placements in the component, which is what kept this
         gallery — justified rows that never crop, a filter built from the group
         names, the staggered reveal — from being usable by anything else. Campus
         Events is the second caller. Restricted to a plain relative path: it is
         joined onto a URL, so a `..` or a leading slash would be a way out of
         the uploads folder. */
      /* What the chip that clears the filter says. It was the literal string
         "All companies", which is right for placements and wrong the moment the
         groups are anything else — on Campus Events it announced forty-three
         photographs of workshops and graduations as companies. */
      block.allLabel = text(raw.allLabel, 40) || 'All companies';
      block.base = (() => {
        const raw_ = text(raw.base, 80).replace(/^\/+|\/+$/g, '');
        return /^[A-Za-z0-9][A-Za-z0-9 _-]*(\/[A-Za-z0-9][A-Za-z0-9 _-]*)*$/.test(raw_) ? raw_ : 'Placements';
      })();
      block.chapters = (Array.isArray(raw.chapters) ? raw.chapters : [])
        .map((c) => ({
          key: text(c?.key, 40),
          name: text(c?.name, 80),
          blurb: text(c?.blurb, 240),
          // 'poster' is a designed card that must never be cropped; 'photo' is
          // a photograph; 'journey' is a tall infographic read on its own.
          kind: oneOf(text(c?.kind, 12), ['poster', 'photo', 'journey'], 'photo'),
          /* Whether this chapter offers the "everything" chip. Default on, which
             is what every chapter had before the flag existed; a chapter of two
             named activities turns it off, because their combined view is not a
             third thing anyone is looking for. */
          allChip: c?.allChip !== false,
          icon: iconKey(c?.icon),
          groups: (Array.isArray(c?.groups) ? c.groups : [])
            .map((g) => ({
              name: text(g?.name, 80),
              images: (Array.isArray(g?.images) ? g.images : [])
                .map((im) => ({
                  src: text(im?.src, 240),
                  label: text(im?.label, 80),
                  w: clampInt(im?.w, 1, 20000, 0),
                  h: clampInt(im?.h, 1, 20000, 0),
                }))
                // No dimensions means no row height can be computed for it.
                .filter((im) => im.src && im.w && im.h)
                .slice(0, 120),
            }))
            .filter((g) => g.images.length)
            .slice(0, 40),
        }))
        .filter((c) => c.key && c.groups.length)
        .slice(0, 8);
      break;

    /* A tilted wall of drifting photographs with one button in the middle of
       it, and behind that button the same set filed and filterable. The gallery
       half is not a second implementation: the component hands `groups` to
       `PlacementWall`, which is where justified rows, the chips and the
       scrolling stage already live. So this block carries both — `tiles` for
       the wall and `groups` for the gallery — and they are deliberately allowed
       to differ: the wall wants a spread of the best photographs, the gallery
       wants every one of them. */
    case 'tilted-tiles':
      block.eyebrow = text(raw.eyebrow, 120);
      block.title = text(raw.title, 160);
      block.lead = text(raw.lead, 400);
      /* What the one button in the middle says, and what the way back says. */
      block.ctaLabel = text(raw.ctaLabel, 48) || 'See the infrastructure';
      block.backLabel = text(raw.backLabel, 48) || 'Back to the campus';
      block.allLabel = text(raw.allLabel, 40) || 'All facilities';
      /* The folder under /uploads every `src` here hangs off — same guard as
         placement-wall's, and for the same reason: it is joined onto a URL, so
         a `..` or a leading slash would be a way out of the uploads folder. */
      block.base = (() => {
        const raw_ = text(raw.base, 80).replace(/^\/+|\/+$/g, '');
        return /^[A-Za-z0-9][A-Za-z0-9 _-]*(\/[A-Za-z0-9][A-Za-z0-9 _-]*)*$/.test(raw_) ? raw_ : 'Infrastructure';
      })();
      block.tiles = (Array.isArray(raw.tiles) ? raw.tiles : [])
        .map((t) => ({
          src: text(t?.src, 240),
          alt: text(t?.alt, 200),
          w: clampInt(t?.w, 1, 20000, 0),
          h: clampInt(t?.h, 1, 20000, 0),
        }))
        // A tile with no dimensions has no height the column can give it.
        .filter((t) => t.src && t.w && t.h)
        .slice(0, 80);
      block.groups = (Array.isArray(raw.groups) ? raw.groups : [])
        .map((g) => ({
          name: text(g?.name, 80),
          images: (Array.isArray(g?.images) ? g.images : [])
            .map((im) => ({
              src: text(im?.src, 240),
              label: text(im?.label, 80),
              w: clampInt(im?.w, 1, 20000, 0),
              h: clampInt(im?.h, 1, 20000, 0),
            }))
            .filter((im) => im.src && im.w && im.h)
            .slice(0, 120),
        }))
        .filter((g) => g.images.length)
        .slice(0, 40);
      break;

    /* A headline over a hand of cards arching up out of the bottom edge, built
       to a layout the user supplied as a reference image. The title carries its
       own line breaks — the reference sets two lines and the component reveals
       them one after the other, so where it breaks is a content decision. */
    case 'card-fan':
      block.eyebrow = text(raw.eyebrow, 80);
      /* The section's own wordmark, above the buttons. A file under /uploads,
         the same path rule as every other block's media field. */
      block.logo = (() => {
        const t = text(raw.logo, 240).replace(/^\/+/, '');
        return /^[A-Za-z0-9][A-Za-z0-9 _.-]*(\/[A-Za-z0-9][A-Za-z0-9 _.-]*)*$/.test(t) ? t : '';
      })();
      block.logoAlt = text(raw.logoAlt, 160);
      block.title = text(raw.title, 200);
      /* The colour of the orbs behind the cards. A hex value tints them, the
         string 'none' turns them off, and unset leaves the stylesheet's own —
         which is the organization's accent. Never invented: where one is set it
         is measured off the organization's own mark. */
      block.glow = text(raw.glow, 8) === 'none' ? 'none' : hexColor(raw.glow);
      block.base = (() => {
        const raw_ = text(raw.base, 80).replace(/^\/+|\/+$/g, '');
        return /^[A-Za-z0-9][A-Za-z0-9 _-]*(\/[A-Za-z0-9][A-Za-z0-9 _-]*)*$/.test(raw_) ? raw_ : '';
      })();
      /* Two at most, as the reference has: one filled and one outlined. Each
         opens the viewer at a card, so a button on this slide always does
         something and always does the same kind of thing. */
      block.buttons = (Array.isArray(raw.buttons) ? raw.buttons : [])
        .map((b) => ({
          label: text(b?.label, 32),
          kind: oneOf(text(b?.kind, 8), ['solid', 'ghost'], 'solid'),
          target: clampInt(b?.target, 0, 79, 0),
        }))
        .filter((b) => b.label)
        .slice(0, 2);
      block.cards = (Array.isArray(raw.cards) ? raw.cards : [])
        .map((c) => ({
          src: text(c?.src, 240),
          // What the viewer captions it with.
          name: text(c?.name, 120),
          w: clampInt(c?.w, 1, 20000, 0),
          h: clampInt(c?.h, 1, 20000, 0),
        }))
        .filter((c) => c.src)
        /* The hand's edges are fixed and the cards stand closer the more of
           them there are; past fifteen each shows too little of itself. */
        .slice(0, 15);
      /* A second, smaller set behind one more pill — dealt as a hand of its
         own over the fan. Optional; nothing is drawn when it is absent. */
      block.deck = (() => {
        const d = raw.deck && typeof raw.deck === 'object' ? raw.deck : null;
        if (!d) return null;
        const photos = (Array.isArray(d.photos) ? d.photos : [])
          .map((p) => ({
            src: text(p?.src, 240),
            name: text(p?.name, 120),
            w: clampInt(p?.w, 1, 20000, 0),
            h: clampInt(p?.h, 1, 20000, 0),
          }))
          .filter((p) => p.src)
          .slice(0, 24);
        if (!photos.length) return null;
        return {
          label: text(d.label, 40),
          eyebrow: text(d.eyebrow, 60),
          title: text(d.title, 80),
          photos,
        };
      })();
      break;

    /* The trainings as a shelf of books. Built to a reference image: two zones
       split by a shelf, the trainings standing on it as books, and under it —
       where the reference puts a row of bestsellers — the selected training's
       own information. One list, therefore, not two: a training is both the
       book and what is written about it. */
    /* The curriculum as cards: a programme's name on the face, and its numbered
       topics behind it. Deliberately the whole of the schema — there is no
       description field on a programme or on a topic, because the brief this
       was built to says there are none, and a field nobody fills is a field
       somebody fills later by accident. */
    case 'curriculum-deck':
      block.eyebrow = text(raw.eyebrow, 80);
      block.title = text(raw.title, 80);
      block.teachLabel = text(raw.teachLabel, 40);
      block.backLabel = text(raw.backLabel, 40);
      block.programs = (Array.isArray(raw.programs) ? raw.programs : [])
        .map((p) => ({
          name: text(p?.name, 80),
          topics: (Array.isArray(p?.topics) ? p.topics : [])
            .map((t) => text(t, 90))
            .filter(Boolean)
            .slice(0, 24),
        }))
        .filter((p) => p.name)
        .slice(0, 12);
      break;

    case 'training-shelf':
      block.eyebrow = text(raw.eyebrow, 80);
      block.title = text(raw.title, 80);
      block.lead = text(raw.lead, 240);
      block.openLabel = text(raw.openLabel, 40);
      block.backLabel = text(raw.backLabel, 40);
      block.teachLabel = text(raw.teachLabel, 40);
      block.photosLabel = text(raw.photosLabel, 40);
      /* The folder under /uploads a programme's photographs hang off. Same
         guard as placement-wall's: it is joined onto a URL. */
      block.base = (() => {
        const raw_ = text(raw.base, 80).replace(/^\/+|\/+$/g, '');
        return /^[A-Za-z0-9][A-Za-z0-9 _-]*(\/[A-Za-z0-9][A-Za-z0-9 _-]*)*$/.test(raw_) ? raw_ : 'Trainings';
      })();
      /* No search, no vertical label and no outcome list any more: under the
         shelf there is a name and a paragraph, and that is the whole of it. The
         per-training `track`, `duration`, `level`, `mode`, `outcomes` and
         `tools` are kept in the schema — the covers still set the track and the
         length on themselves, and the rest is content already written down that
         a later cut may want back. */
      block.trainings = (Array.isArray(raw.trainings) ? raw.trainings : [])
        .map((t) => ({
          name: text(t?.name, 90),
          track: text(t?.track, 40),
          duration: text(t?.duration, 40),
          level: text(t?.level, 40),
          mode: text(t?.mode, 40),
          blurb: text(t?.blurb, 400),
          /* The cover's colour. White into red is the design; this is which
             red, so a shelf reads as a set of related books rather than as one
             book printed a dozen times. */
          tint: hexColor(t?.tint),
          /* What is actually taught in it — the syllabus, set as one
             dot-separated line under the description. This replaced `outcomes`
             and `tools`, which were two lists nobody had written and which the
             shelf stopped showing. */
          subjects: (Array.isArray(t?.subjects) ? t.subjects : [])
            .map((o) => text(o, 60)).filter(Boolean).slice(0, 10),
          /* Further points for the open page — what it is for, who it is for,
             what it ends in. Drawn only when supplied. */
          highlights: (Array.isArray(t?.highlights) ? t.highlights : [])
            .map((x) => ({ label: text(x?.label, 40), text: text(x?.text, 240) }))
            .filter((x) => x.text).slice(0, 4),
          /* Photographs of the programme, shown under its open page and
             reached by scrolling. Dimensions travel with each one so the rows
             are solved before a byte of image has landed. */
          photos: (Array.isArray(t?.photos) ? t.photos : [])
            .map((p) => ({
              src: text(p?.src, 240),
              alt: text(p?.alt, 120),
              w: clampInt(p?.w, 1, 20000, 0),
              h: clampInt(p?.h, 1, 20000, 0),
            }))
            .filter((p) => p.src && p.w && p.h).slice(0, 24),
        }))
        .filter((t) => t.name)
        .slice(0, 24);
      break;

    /* A headline beside a staggered collage of photographs, built to a
       reference image. Nine fixed slots; the photographs are dealt into them in
       order, so the publisher's order IS the layout. `focus` is where a card
       looks within its photograph — a tall card on a wide group shot has to be
       told where the people are. */
    case 'photo-collage':
      block.eyebrow = text(raw.eyebrow, 80);
      block.title = text(raw.title, 120);
      block.lead = text(raw.lead, 300);
      /* The section's own wordmark, in place of the eyebrow, the title and the
         lead. A file under /uploads, the same path rule as every other block's
         media field. Unset, the copy is set in type as it always was. */
      block.logo = (() => {
        const t = text(raw.logo, 240).replace(/^\/+/, '');
        return /^[A-Za-z0-9][A-Za-z0-9 _.-]*(\/[A-Za-z0-9][A-Za-z0-9 _.-]*)*$/.test(t) ? t : '';
      })();
      block.logoAlt = text(raw.logoAlt, 160);
      block.ctaLabel = text(raw.ctaLabel, 40);
      /* The two colours of the blobs behind the collage. 'none' turns them off;
         unset leaves the stylesheet's own, which are the organization's. Never
         invented — both are measured off its own material. */
      block.glow = text(raw.glow, 8) === 'none' ? 'none' : hexColor(raw.glow);
      block.glow2 = hexColor(raw.glow2);
      block.base = (() => {
        const raw_ = text(raw.base, 80).replace(/^\/+|\/+$/g, '');
        return /^[A-Za-z0-9][A-Za-z0-9 _-]*(\/[A-Za-z0-9][A-Za-z0-9 _-]*)*$/.test(raw_) ? raw_ : '';
      })();
      block.points = (Array.isArray(raw.points) ? raw.points : [])
        .map((p) => text(p, 60)).filter(Boolean).slice(0, 5);
      {
        const photo = (p) => ({
          src: text(p?.src, 240),
          name: text(p?.name, 120),
          /* An object-position, and only that: two percentages or keywords. */
          focus: /^\s*(\d{1,3}%|left|center|right)\s+(\d{1,3}%|top|center|bottom)\s*$/.test(String(p?.focus || ''))
            ? String(p.focus).trim() : '',
          w: clampInt(p?.w, 1, 20000, 0),
          h: clampInt(p?.h, 1, 20000, 0),
        });
        /* The collage: nine fixed slots, so nine. */
        block.photos = (Array.isArray(raw.photos) ? raw.photos : [])
          .map(photo).filter((p) => p.src).slice(0, 9);
        /* The wall under it — every further photograph, in justified rows. They
           need `w` and `h` to be laid out, and the component drops any without. */
        block.more = (Array.isArray(raw.more) ? raw.more : [])
          .map(photo).filter((p) => p.src && p.w && p.h).slice(0, 60);
        block.moreLabel = text(raw.moreLabel, 40);
        block.topLabel = text(raw.topLabel, 40);
      }
      break;

    case 'thread-board': {
      /* A film, then a board of photographs pinned along a thread. Two
         screens: the film's own words, then the board's. */
      const safePath = (v) => {
        const t = text(v, 240).replace(/^\/+/, '');
        return /^[A-Za-z0-9][A-Za-z0-9 _.-]*(\/[A-Za-z0-9][A-Za-z0-9 _.-]*)*$/.test(t) ? t : '';
      };
      block.base = (() => {
        const raw_ = text(raw.base, 80).replace(/^\/+|\/+$/g, '');
        return /^[A-Za-z0-9][A-Za-z0-9 _-]*(\/[A-Za-z0-9][A-Za-z0-9 _-]*)*$/.test(raw_) ? raw_ : '';
      })();
      block.video = safePath(raw.video);
      block.videoEyebrow = text(raw.videoEyebrow, 60);
      block.videoTitle = text(raw.videoTitle, 80);
      /* The section's own wordmark, over the film, instead of its name in type.
         A file under /uploads, the same path rule as every other block's media
         field. Unset, the name is set in type as it always was. */
      block.videoLogo = (() => {
        const t = text(raw.videoLogo, 240).replace(/^\/+/, '');
        return /^[A-Za-z0-9][A-Za-z0-9 _.-]*(\/[A-Za-z0-9][A-Za-z0-9 _.-]*)*$/.test(t) ? t : '';
      })();
      block.videoLogoAlt = text(raw.videoLogoAlt, 160);
      block.videoCta = text(raw.videoCta, 40);
      /* Seconds into the film to begin at, 0 for the start. The component opens
         the file at this point rather than seeking to it (see ThreadBoard). */
      block.videoStart = Math.max(0, Math.min(3600, Number(raw.videoStart) || 0));
      block.eyebrow = text(raw.eyebrow, 60);
      block.title = text(raw.title, 120);
      block.lead = text(raw.lead, 320);
      block.note = text(raw.note, 60);
      /* The photographs need `w` and `h`: a card is as wide as its picture is at
         the row's height, and nothing is ever cropped to a slot. */
      block.photos = (Array.isArray(raw.photos) ? raw.photos : [])
        .map((p) => ({
          src: safePath(p?.src),
          name: text(p?.name, 120),
          w: clampInt(p?.w, 1, 20000, 0),
          h: clampInt(p?.h, 1, 20000, 0),
        }))
        .filter((p) => p.src && p.w && p.h)
        .slice(0, 60);
      break;
    }

    case 'project-showcase': {
      /* The product wall: paper "files" on the left, a desk rig on the right
         whose monitor plays each project's film — or, at a press, the project's
         own site, live, inside the same screen. */
      const safePath = (v) => {
        const t = text(v, 400).replace(/^\/+(?!\/)/, '');
        /* Either an http(s) URL — a real product lives on the web — or a file
           in the library. Nothing else: this value ends up in an iframe. */
        if (/^https?:\/\//i.test(t)) return t;
        return /^[A-Za-z0-9][A-Za-z0-9 _.\-]*(\/[A-Za-z0-9][A-Za-z0-9 _.\-]*)*$/.test(t) ? t : '';
      };
      block.brand = text(raw.brand, 40);
      /* The mark beside the brand words. A file under /uploads; unset falls back
         to the gate the stylesheet draws. */
      block.logo = (() => {
        const t = text(raw.logo, 240).replace(/^\/+/, '');
        return /^[A-Za-z0-9][A-Za-z0-9 _.-]*(\/[A-Za-z0-9][A-Za-z0-9 _.-]*)*$/.test(t) ? t : '';
      })();
      block.defaultTitle = text(raw.defaultTitle, 40);
      block.base = (() => {
        const raw_ = text(raw.base, 80).replace(/^\/+|\/+$/g, '');
        return /^[A-Za-z0-9][A-Za-z0-9 _-]*(\/[A-Za-z0-9][A-Za-z0-9 _-]*)*$/.test(raw_) ? raw_ : '';
      })();
      block.projects = (Array.isArray(raw.projects) ? raw.projects : [])
        .map((p) => ({
          name: text(p?.name, 40),
          tag: text(p?.tag, 80),
          logo: safePath(p?.logo),
          description: text(p?.description, 600),
          features: (Array.isArray(p?.features) ? p.features : [])
            .map((f) => text(f, 80)).filter(Boolean).slice(0, 8),
          stack: (Array.isArray(p?.stack) ? p.stack : [])
            .map((f) => text(f, 32)).filter(Boolean).slice(0, 10),
          links: {
            live: safePath(p?.links?.live),
            code: safePath(p?.links?.code),
          },
          /* The film on the monitor. */
          media: (() => {
            const src = safePath(p?.media?.src);
            if (!src) return null;
            return { type: oneOf(text(p?.media?.type, 8), ['video', 'image'], 'video'), src };
          })(),
          /* The site the monitor opens. */
          site: safePath(p?.site),
          /* Demo logins. The values are carried so a presenter can put one on
             the clipboard; they are never rendered — see the note in
             `Platforms.js`, which set that rule: a password on a three-metre
             screen is a password given away. */
          logins: (Array.isArray(p?.logins) ? p.logins : [])
            .map((l) => ({
              role: text(l?.role, 40),
              user: text(l?.user, 120),
              pass: text(l?.pass, 120),
            }))
            .filter((l) => l.role && (l.user || l.pass))
            .slice(0, 6),
        }))
        .filter((p) => p.name)
        /* The grid is three across and the dock holds what is left; past a
           dozen the files no longer fit the left half. */
        .slice(0, 12);
      break;
    }

    case 'photo-folder':
      /* A folder of photographs that opens into a bento wall. */
      block.eyebrow = text(raw.eyebrow, 60);
      block.title = text(raw.title, 80);
      /* The section's own wordmark, in the head. A file under /uploads, the
         same path rule as every other block's media field. */
      block.logo = (() => {
        const t = text(raw.logo, 240).replace(/^\/+/, '');
        return /^[A-Za-z0-9][A-Za-z0-9 _.-]*(\/[A-Za-z0-9][A-Za-z0-9 _.-]*)*$/.test(t) ? t : '';
      })();
      block.logoAlt = text(raw.logoAlt, 160);
      block.openLabel = text(raw.openLabel, 32);
      block.backLabel = text(raw.backLabel, 32);
      block.glow = text(raw.glow, 8) === 'none' ? 'none' : hexColor(raw.glow);
      block.glow2 = hexColor(raw.glow2);
      block.base = (() => {
        const raw_ = text(raw.base, 80).replace(/^\/+|\/+$/g, '');
        return /^[A-Za-z0-9][A-Za-z0-9 _-]*(\/[A-Za-z0-9][A-Za-z0-9 _-]*)*$/.test(raw_) ? raw_ : '';
      })();
      block.photos = (Array.isArray(raw.photos) ? raw.photos : [])
        .map((p) => ({
          src: text(p?.src, 240),
          name: text(p?.name, 80),
          desc: text(p?.desc, 200),
          /* An object-position, and only that: two percentages or keywords. */
          focus: /^\s*(\d{1,3}%|left|center|right)\s+(\d{1,3}%|top|center|bottom)\s*$/.test(String(p?.focus || ''))
            ? String(p.focus).trim() : '',
          w: clampInt(p?.w, 1, 20000, 0),
          h: clampInt(p?.h, 1, 20000, 0),
        }))
        .filter((p) => p.src)
        /* The compositions are written out to six; past twelve a folder is a
           gallery and belongs in `placement-wall`. */
        .slice(0, 12);
      break;

    case 'event-wheel':
      /* Events as a wheel of albums beside the open album. */
      block.eyebrow = text(raw.eyebrow, 40);
      block.title = text(raw.title, 80);
      block.base = (() => {
        const raw_ = text(raw.base, 80).replace(/^\/+|\/+$/g, '');
        return /^[A-Za-z0-9][A-Za-z0-9 _-]*(\/[A-Za-z0-9][A-Za-z0-9 _-]*)*$/.test(raw_) ? raw_ : '';
      })();
      block.groups = (Array.isArray(raw.groups) ? raw.groups : [])
        .map((g) => ({
          title: text(g?.title, 80),
          /* Optional, written as text: the reference shows a date under the name
             and the data may one day carry one. Nothing derives it. */
          date: text(g?.date, 40),
          images: (Array.isArray(g?.images) ? g.images : [])
            .map((im) => ({
              src: text(im?.src, 240),
              label: text(im?.label, 120),
              w: clampInt(im?.w, 1, 20000, 0),
              h: clampInt(im?.h, 1, 20000, 0),
            }))
            .filter((im) => im.src)
            .slice(0, 60),
        }))
        .filter((g) => g.title && g.images.length)
        .slice(0, 40);
      break;

    case 'program-deck':
      block.eyebrow = text(raw.eyebrow, 120);
      block.title = text(raw.title, 160);
      block.programs = (Array.isArray(raw.programs) ? raw.programs : [])
        .map((p) => ({
          key: text(p?.key, 40),
          name: text(p?.name, 80),
          blurb: text(p?.blurb, 200),
          logo: text(p?.logo, 200),
          videos: (Array.isArray(p?.videos) ? p.videos : [])
            .map((v) => ({
              title: text(v?.title, 120),
              // A YouTube id, or a file under /uploads — never both.
              youtube: text(v?.youtube, 24),
              src: text(v?.src, 200),
            }))
            .filter((v) => v.youtube || v.src)
            /* Twelve was the old ceiling and T-Connect landed exactly on it once
               the video workbook was folded in, which is one film away from
               silently losing one. */
            .slice(0, 24),
          /* A programme may be evidenced by photographs rather than film — Ignite
             Coder has five and no reel. They sit in the same gallery as the films
             and open the same way, so a programme is never a dead card. */
          photos: (Array.isArray(p?.photos) ? p.photos : [])
            .map((x) => ({
              src: text(x?.src, 200),
              caption: text(x?.caption, 160),
            }))
            .filter((x) => x.src)
            .slice(0, 40),
        }))
        .filter((p) => p.key && p.name)
        .slice(0, 24);
      break;

    case 'story-wall':
      block.eyebrow = text(raw.eyebrow, 120);
      block.title = text(raw.title, 160);
      block.subtitle = text(raw.subtitle, 300);
      block.stories = (Array.isArray(raw.stories) ? raw.stories : [])
        .map((s) => ({
          photo: text(s?.photo, 200),
          /* A card may hold a film instead of a photograph — the student
             testimonials are filmed, not photographed. Same shape and the same
             path under /uploads; only the element that plays it differs. */
          video: text(s?.video, 200),
          /* The rest of that achievement's photographs. The card carries one of
             them; these fill the wall behind it while the card is centred, so a
             folder of six pictures shows all six rather than hiding five. A
             folder with a single photograph has none, and the wall keeps its own
             gradient — which is the designed default, not a fallback. */
          backdrop: (Array.isArray(s?.backdrop) ? s.backdrop : [])
            .map((b) => text(b, 200)).filter(Boolean).slice(0, 8),
          name: text(s?.name, 120),
          role: text(s?.role, 120),
          body: text(s?.body, 900),
          quote: text(s?.quote, 600),
        }))
        /* Either is enough to make a card. Keeping the old photo-only test here
           would silently drop every film on the next save. */
        .filter((s) => s.photo || s.video)
        .slice(0, 80);
      break;

    /* The team, as a skewed ribbon. Members carry a `photo` path under
       /uploads rather than an assetId, the way the story wall and the placement
       wall do: these arrive as a folder of two dozen files at once, which is a
       copy and a manifest rather than two dozen uploads, and the wall is only
       ever served by the same server that holds them. */
    case 'skew-carousel':
      block.eyebrow = text(raw.eyebrow, 120);
      block.title = text(raw.title, 160);
      block.lead = text(raw.lead, 300);
      /* The colour the ground and the plates are built from. The component
         derives the deep end and the glow from it, so one value dresses the
         whole section — and it is measured off the photographs rather than
         invented: it is the red of the shirt everybody in them is wearing. */
      block.tint = hexColor(raw.tint);
      block.members = (Array.isArray(raw.members) ? raw.members : [])
        .map((m) => ({
          photo: text(m?.photo, 200),
          name: text(m?.name, 80),
          /* Optional, and blank until it is supplied. A card with a name and no
             title is a person whose title nobody has written down yet; an
             invented one is worse than a missing one. */
          role: text(m?.role, 80),
        }))
        .filter((m) => m.photo || m.name)
        .slice(0, 60);
      break;

    case 'coe-wall':
      block.eyebrow = text(raw.eyebrow, 120);
      block.title = text(raw.title, 120);
      block.subtitle = text(raw.subtitle, 240);
      /* The organization's own mark, which sits at the centre of the orbit the
         page opens on. Written in at publish time so the block carries its own
         art and the renderer never has to reach for the active org. */
      block.hubLogo = text(raw.hubLogo, 200);
      block.hubName = text(raw.hubName, 80);
      block.centers = (Array.isArray(raw.centers) ? raw.centers : [])
        .map((c) => ({
          key: text(c?.key, 40),
          name: text(c?.name, 80),
          mono: text(c?.mono, 4),
          tagline: text(c?.tagline, 160),
          color: hexColor(c?.color) || '#161821',
          ink: hexColor(c?.ink) || '#ffffff',
          /* Filenames, resolved at publish time by scanning the folders. The
             page cannot list a directory itself, and a manifest keeps the
             gallery working with no network and no extra endpoint. */
          logo: text(c?.logo, 120),
          logoFull: text(c?.logoFull, 120),
          media: (Array.isArray(c?.media) ? c.media : [])
            .map((m) => ({
              src: text(m?.src, 200),
              /* A YouTube id instead of a file. The vendor-academy films live on
                 YouTube, so a centre's strip has to be able to hold one. */
              youtube: text(m?.youtube, 24),
              kind: oneOf(m?.kind, ['image', 'video'], 'image'),
              label: text(m?.label, 120),
            }))
            .filter((m) => m.src || m.youtube)
            .slice(0, 40),
        }))
        .filter((c) => c.key && c.name)
        .slice(0, 40);
      break;

    case 'box':
      block.label = text(raw.label, 120);
      block.background = oneOf(raw.background, ['none', 'surface', 'soft', 'brand', 'dark'], 'surface');
      block.padding = oneOf(raw.padding, ['none', 'sm', 'md', 'lg'], 'md');
      block.gap = oneOf(raw.gap, ['none', 'sm', 'md', 'lg'], 'md');
      block.border = raw.border === undefined ? true : Boolean(raw.border);
      block.radius = oneOf(raw.radius, ['none', 'sm', 'md', 'lg'], 'md');
      block.children = normalizeBlocks(raw.children, depth + 1);
      break;

    default:
      break;
  }
  return block;
}

function normalizeButtons(raw) {
  return (Array.isArray(raw) ? raw : [])
    .map((item) => ({
      id: item?.id || newId('btn'),
      label: text(item?.label, 80),
      href: safeHref(item?.href),
      variant: oneOf(item?.variant, ['primary', 'outline', 'ghost', 'dark'], 'primary'),
      icon: text(item?.icon, 8),
    }))
    .filter((item) => item.label)
    .slice(0, 6);
}

const overlaps = (a, b) =>
  a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;

/**
 * Guarantees a valid canvas: legacy blocks with no coordinates are flowed
 * full-width in document order, and anything still overlapping is pushed down.
 * The client does the same maths while dragging; this is the backstop.
 */
export function normalizeBlocks(blocks, depth = 0) {
  if (!Array.isArray(blocks)) return [];
  const limit = depth === 0 ? 80 : MAX_CHILDREN;
  // Past the nesting limit a layout box is dropped rather than kept as an empty
  // shell, so a crafted payload cannot make the renderer recurse for ever.
  const source = depth >= MAX_BOX_DEPTH
    ? blocks.filter((block) => block?.type !== 'box')
    : blocks;
  const normalized = source.slice(0, limit).map((block, index) => normalizeBlock(block, index, depth));

  let cursor = 0;
  for (const block of normalized) {
    if (block.layout.auto) {
      block.layout.x = 0;
      block.layout.w = GRID_COLUMNS;
      block.layout.y = cursor;
      cursor += block.layout.h;
    } else {
      cursor = Math.max(cursor, block.layout.y + block.layout.h);
    }
    delete block.layout.auto;
  }

  const placed = [];
  for (const block of [...normalized].sort((a, b) => a.layout.y - b.layout.y || a.layout.x - b.layout.x)) {
    let guard = 0;
    while (placed.some((other) => overlaps(block.layout, other.layout)) && guard < 400) {
      block.layout.y += 1;
      guard += 1;
    }
    placed.push(block);
  }

  return normalized;
}

/** Attach resolved image URLs so the viewer never has to look assets up itself. */
export function hydrateBlocks(blocks) {
  return (blocks || []).map((block) => {
    if (block.type === 'video') {
      // A pasted link is resolved here, so the viewer just renders what it is told.
      const link = block.source === 'url' && block.videoUrl ? parseVideoUrl(block.videoUrl) : null;
      return {
        ...block,
        asset: block.assetId ? assetService.resolveMany([block.assetId])[0] || null : null,
        link,
        linkError: block.source === 'url' && block.videoUrl && !link
          ? `That link is not a playable video. ${describeVideoUrlSupport()}`
          : null,
      };
    }
    /* Same contract as gallery-wall: ids in, real /uploads URLs out, and a panel
       whose asset has been deleted is dropped rather than rendered as a hole in
       the row — the accordion solves its widths off the panel count, so a broken
       one would take a slat's width and show nothing in it. */
    if (block.type === 'alliance-accordion') {
      const ids = (block.panels || []).map((p) => p.assetId).filter(Boolean);
      const byId = new Map(assetService.resolveMany(ids).filter(Boolean).map((a) => [a.id, a]));
      /* Unlike gallery-wall, a panel with no asset is kept: here the picture is
         optional and its absence is a designed state, not a broken tile. */
      return {
        ...block,
        panels: (block.panels || []).map((p) => ({ ...p, asset: byId.get(p.assetId) || null })),
      };
    }
    if (block.type === 'drift-wall') {
      const ids = (block.items || []).map((i) => i.assetId).filter(Boolean);
      const byId = new Map(assetService.resolveMany(ids).filter(Boolean).map((a) => [a.id, a]));
      return {
        ...block,
        items: (block.items || [])
          .map((i) => ({ ...i, asset: byId.get(i.assetId) || null }))
          .filter((i) => i.asset),
      };
    }
    /* Every tile resolves to a real `/uploads/...` URL the server serves, so a
       deployed copy shows the same wall to everyone who opens the link. */
    if (block.type === 'gallery-wall') {
      const ids = (block.tiles || []).map((tile) => tile.assetId).filter(Boolean);
      if (block.decade?.assetId) ids.push(block.decade.assetId);
      const byId = new Map(assetService.resolveMany(ids).filter(Boolean).map((a) => [a.id, a]));
      return {
        ...block,
        tiles: (block.tiles || [])
          .map((tile) => ({ ...tile, asset: byId.get(tile.assetId) || null }))
          // A tile whose asset has been deleted would render as a broken frame;
          // drop it here rather than ask the viewer to cope.
          .filter((tile) => tile.asset),
        decade: block.decade
          ? { ...block.decade, asset: byId.get(block.decade.assetId) || null }
          : null,
      };
    }
    // Each panel carries its own optional photograph, so the whole set is
    // resolved in one lookup rather than one per panel.
    // The film tab needs its asset resolved the same way a standalone hero
    // does, or the video has no src and the tab opens on a black rectangle.
    if (block.type === 'paper-tabs') {
      const ids = (block.tabs || []).map((tab) => tab.hero?.assetId).filter(Boolean);
      const byId = new Map(assetService.resolveMany(ids).filter(Boolean).map((a) => [a.id, a]));
      return {
        ...block,
        tabs: (block.tabs || []).map((tab) => {
          if (!tab.hero) return tab;
          const usingLink = tab.hero.media === 'video' && tab.hero.source === 'url'
            && Boolean(tab.hero.videoUrl);
          return {
            ...tab,
            hero: {
              ...tab.hero,
              asset: tab.hero.assetId ? byId.get(tab.hero.assetId) || null : null,
              link: usingLink ? parseVideoUrl(tab.hero.videoUrl) : null,
            },
          };
        }),
      };
    }
    // Each volume carries two pieces of media — a still cover and the loop that
    // plays over it — so both ids for all three books resolve in one lookup.
    if (block.type === 'book-shelf') {
      const ids = (block.books || [])
        .flatMap((book) => [book.coverAssetId, book.motionAssetId])
        .filter(Boolean);
      const byId = new Map(assetService.resolveMany(ids).filter(Boolean).map((a) => [a.id, a]));
      return {
        ...block,
        books: (block.books || []).map((book) => ({
          ...book,
          cover: book.coverAssetId ? byId.get(book.coverAssetId) || null : null,
          motion: book.motionAssetId ? byId.get(book.motionAssetId) || null : null,
        })),
      };
    }
    if (block.type === 'hub') {
      return {
        ...block,
        logo: block.logoAssetId ? assetService.resolveMany([block.logoAssetId])[0] || null : null,
      };
    }
    if (block.type === 'roster') {
      return {
        ...block,
        logo: block.logoAssetId ? assetService.resolveMany([block.logoAssetId])[0] || null : null,
      };
    }
    if (block.type === 'council-grid') {
      const ids = (block.members || []).map((member) => member.assetId).filter(Boolean);
      const byId = new Map(assetService.resolveMany(ids).filter(Boolean).map((a) => [a.id, a]));
      return {
        ...block,
        members: (block.members || []).map((member) => ({
          ...member,
          asset: member.assetId ? byId.get(member.assetId) || null : null,
        })),
      };
    }
    if (block.type === 'leadership-panels') {
      const ids = (block.panels || []).map((panel) => panel.assetId).filter(Boolean);
      const byId = new Map(assetService.resolveMany(ids).filter(Boolean).map((a) => [a.id, a]));
      return {
        ...block,
        panels: (block.panels || []).map((panel) => ({
          ...panel,
          asset: panel.assetId ? byId.get(panel.assetId) || null : null,
        })),
      };
    }
    if (['image', 'profile', 'logo', 'leader-hero', 'milestone-timeline'].includes(block.type)) {
      return {
        ...block,
        asset: block.assetId ? assetService.resolveMany([block.assetId])[0] || null : null,
      };
    }
    if (block.type === 'hero') {
      const usingLink = block.media === 'video' && block.source === 'url' && Boolean(block.videoUrl);
      const link = usingLink ? parseVideoUrl(block.videoUrl) : null;
      return {
        ...block,
        asset: block.assetId ? assetService.resolveMany([block.assetId])[0] || null : null,
        link,
        linkError: usingLink && !link
          ? `That link is not a playable video. ${describeVideoUrlSupport()}`
          : null,
      };
    }
    if (block.type === 'gallery') {
      // Titles ride alongside the asset ids, so each image keeps its own caption.
      const images = assetService.resolveMany(block.assetIds);
      const titleFor = new Map((block.assetIds || []).map((id, i) => [id, (block.titles || [])[i] || '']));
      return { ...block, images: images.map((img) => ({ ...img, title: titleFor.get(img.id) || '' })) };
    }
    if (block.type === 'cards') {
      return {
        ...block,
        items: block.items.map((item) => ({
          ...item,
          image: item.imageAssetId ? assetService.resolveMany([item.imageAssetId])[0] || null : null,
        })),
      };
    }
    if (block.type === 'quote' && block.imageAssetId) {
      return { ...block, image: assetService.resolveMany([block.imageAssetId])[0] || null };
    }
    if (block.type === 'box') {
      return { ...block, children: hydrateBlocks(block.children) };
    }
    return block;
  });
}

function hydrate(section) {
  return {
    ...section,
    // An uploaded navigation mark is resolved here so the sidebar can render it
    // without a second lookup, exactly like an image block's asset.
    iconAsset: section.iconAssetId ? assetService.resolveMany([section.iconAssetId])[0] || null : null,
    blocks: hydrateBlocks(section.blocks),
  };
}

/**
 * One-time migration: sections created before the canvas existed have blocks
 * with no coordinates. Flow them full-width in their current order so the
 * canvas is valid from the first render.
 */
export async function migrateLayouts() {
  const store = data();
  let migrated = 0;
  for (const section of store.sections) {
    if (!Array.isArray(section.blocks) || !section.blocks.length) continue;
    if (section.blocks.every((block) => block.layout)) continue;
    section.blocks = normalizeBlocks(section.blocks);
    migrated += 1;
  }
  if (migrated) await persist();
  return migrated;
}

export function listForRole(orgId, role) {
  if (!orgModel.byId(orgId)) throw new HttpError(404, 'Organization not found');
  const rows = sectionModel.byOrg(orgId);
  const visible = role === 'admin'
    ? rows
    : rows.filter((section) => section.status === 'published' && !section.hidden);
  return visible.map(hydrate);
}

/**
 * One section, filtered by who is asking.
 *
 * The listing already hides drafts from a presenter, but this did not — and the
 * deck navigates by id in the URL, so an unfinished section was one hash away
 * from anybody holding the link. A presenter asking for a section that is not
 * published gets the same 404 as one that does not exist, which is what keeps
 * work in progress genuinely private rather than merely unlisted.
 */
export function get(id, role = 'admin') {
  const section = sectionModel.byId(id);
  if (!section) throw new HttpError(404, 'Section not found');
  if (role !== 'admin' && (section.status !== 'published' || section.hidden)) {
    throw new HttpError(404, 'Section not found');
  }
  return hydrate(section);
}

/**
 * A subsection's parent. The tree is deliberately one level deep: the navigation
 * shows a group and the pages inside it, and nothing below that. A child of a
 * child would have nowhere to appear.
 */
function parentIdFor(value, orgId, selfId = null) {
  if (!value) return null;
  const parent = sectionModel.byId(String(value));
  if (!parent) throw new HttpError(400, 'Parent section not found');
  if (parent.orgId !== orgId) throw new HttpError(400, 'Parent section belongs to another organization');
  if (parent.id === selfId) throw new HttpError(400, 'A section cannot be its own parent');
  if (parent.parentId) throw new HttpError(400, 'Subsections cannot be nested further');
  return parent.id;
}

export async function create(orgId, payload = {}) {
  if (!orgModel.byId(orgId)) throw new HttpError(404, 'Organization not found');
  const title = text(payload.title, 120).trim() || 'Untitled section';
  const section = await sectionModel.insert({
    id: newId('sec'),
    orgId,
    parentId: parentIdFor(payload.parentId, orgId),
    key: slugify(payload.key || title, 'section'),
    title,
    subtitle: text(payload.subtitle, 240),
    // A title card shown once when the slide opens: it fades up, holds, fades
    // away, and only then does the page behind it animate in. Empty means no
    // card and the page arrives immediately, which is the old behaviour.
    intro: text(payload.intro, 120),
    icon: text(payload.icon, 8),
    // Navigation mark: a name from the shared icon library, or an uploaded
    // PNG/SVG asset that takes precedence over it.
    iconKey: iconKey(payload.iconKey),
    iconAssetId: payload.iconAssetId ? String(payload.iconAssetId) : null,
    order: sectionModel.nextOrder(orgId),
    hidden: Boolean(payload.hidden),
    status: payload.status === 'published' ? 'published' : 'draft',
    blocks: normalizeBlocks(payload.blocks),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });
  return hydrate(section);
}

export async function update(id, payload = {}) {
  const existing = sectionModel.byId(id);
  if (!existing) throw new HttpError(404, 'Section not found');

  const patch = {};
  if (payload.title !== undefined) {
    const title = text(payload.title, 120).trim();
    if (!title) throw new HttpError(400, 'Section title cannot be empty');
    patch.title = title;
  }
  if (payload.subtitle !== undefined) patch.subtitle = text(payload.subtitle, 240);
  if (payload.intro !== undefined) patch.intro = text(payload.intro, 120);
  if (payload.icon !== undefined) patch.icon = text(payload.icon, 8);
  if (payload.iconKey !== undefined) patch.iconKey = iconKey(payload.iconKey);
  if (payload.parentId !== undefined) {
    patch.parentId = parentIdFor(payload.parentId, existing.orgId, existing.id);
  }
  if (payload.iconAssetId !== undefined) {
    patch.iconAssetId = payload.iconAssetId ? String(payload.iconAssetId) : null;
  }
  if (payload.hidden !== undefined) patch.hidden = Boolean(payload.hidden);
  if (payload.status !== undefined) {
    if (!['draft', 'published'].includes(payload.status)) {
      throw new HttpError(400, 'Status must be draft or published');
    }
    patch.status = payload.status;
  }
  if (payload.blocks !== undefined) patch.blocks = normalizeBlocks(payload.blocks);

  return hydrate(await sectionModel.update(id, patch));
}

export async function remove(id) {
  const section = sectionModel.byId(id);
  if (!section) throw new HttpError(404, 'Section not found');
  await sectionModel.remove(id);
  return { id };
}

/** Drops block ids so a copied tree is issued fresh ones by the normaliser. */
function stripIds(blocks) {
  return (blocks || []).map(({ id, children, ...rest }) => ({
    ...rest,
    ...(children ? { children: stripIds(children) } : {}),
  }));
}

/** Copies a section — content and all — as a fresh draft at the end of the deck. */
export async function duplicate(id, payload = {}) {
  const source = sectionModel.byId(id);
  if (!source) throw new HttpError(404, 'Section not found');
  const title = text(payload.title, 120).trim() || `${source.title} copy`;
  return create(source.orgId, {
    title,
    subtitle: source.subtitle,
    intro: source.intro,
    icon: source.icon,
    iconKey: source.iconKey,
    iconAssetId: source.iconAssetId,
    hidden: source.hidden,
    status: 'draft',
    blocks: stripIds(structuredClone(source.blocks || [])),
  });
}

export async function reorder(orgId, orderedIds) {
  if (!orgModel.byId(orgId)) throw new HttpError(404, 'Organization not found');
  if (!Array.isArray(orderedIds) || !orderedIds.length) {
    throw new HttpError(400, 'Provide an array of section ids');
  }
  const owned = new Set(sectionModel.byOrg(orgId).map((section) => section.id));
  if (orderedIds.some((id) => !owned.has(id))) {
    throw new HttpError(400, 'Reorder list contains sections from another organization');
  }
  return (await sectionModel.applyOrder(orgId, orderedIds)).map(hydrate);
}

