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
      // Partner marks are typographic, never drawn: there are no official
      // vendor logo files in the library and hand-tracing one is worse than
      // setting the name.
      block.partners = (Array.isArray(raw.partners) ? raw.partners : [])
        .map((p) => ({ name: text(p?.name, 60), note: text(p?.note, 40) }))
        .filter((p) => p.name).slice(0, 6);
      block.frames = (Array.isArray(raw.frames) ? raw.frames : [])
        .map((f) => ({
          kind: oneOf(f?.kind, ['cards', 'modules', 'close'], 'cards'),
          eyebrow: text(f?.eyebrow, 80),
          title: text(f?.title, 120),
          subtitle: text(f?.subtitle, 240),
          columns: clampInt(f?.columns, 1, 3, 2),
          items: (Array.isArray(f?.items) ? f.items : [])
            .map((i) => ({
              title: text(i?.title, 120),
              body: text(i?.body, 400),
              icon: iconKey(i?.icon),
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
        .slice(0, 200);
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

    case 'event-reel':
      block.eyebrow = text(raw.eyebrow, 120);
      block.title = text(raw.title, 160);
      block.lead = text(raw.lead, 400);
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
            }))
            .filter((g) => g.title && g.films.length)
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
      block.chapters = (Array.isArray(raw.chapters) ? raw.chapters : [])
        .map((c) => ({
          key: text(c?.key, 40),
          name: text(c?.name, 80),
          blurb: text(c?.blurb, 240),
          // 'poster' is a designed card that must never be cropped; 'photo' is
          // a photograph; 'journey' is a tall infographic read on its own.
          kind: oneOf(text(c?.kind, 12), ['poster', 'photo', 'journey'], 'photo'),
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
          name: text(s?.name, 80),
          role: text(s?.role, 120),
          body: text(s?.body, 900),
          quote: text(s?.quote, 600),
        }))
        .filter((s) => s.photo)
        .slice(0, 80);
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

