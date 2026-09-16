import { h } from '../utils/dom.js';
import { icon } from '../utils/icons.js';
import { filmStage, posterImg, bindStageLifetime } from '../utils/filmStage.js';

/**
 * Events: the whole film library, one chapter at a time.
 *
 * The first version of this page put a player and a list of every entry side by
 * side, and it was too much at once — twenty-three rows in a 496px column at
 * 12.5px, with the flow chips smaller again. A presentation slide is read from
 * across a room, so the page is now one thing: a grid of chapter entries at a
 * size that can actually be read, and the film plays across the whole display
 * rather than in a box beside the list.
 *
 * The workbook's structure is what the grid has to carry. A row with a title
 * starts a series and every row beneath it with the title left blank is another
 * part of the same one — T-News is ten rows and one title, Project Space 3.0 is
 * five. So a card for a series shows its parts as a numbered run with arrows
 * between them, and each one opens the film it points at. The arrows are the
 * point: they say these are in order and there is another after this.
 *
 * Columns are solved rather than fixed. Six chapters hold between four and
 * twenty-three entries, and one column count cannot serve both without leaving
 * either a stranded row of white or cards too small to read.
 */

const REDUCED = window.matchMedia?.('(prefers-reduced-motion: reduce)');

/* Layout pixels, not measured ones — the grid sits inside FitSlide's transform,
   so a bounding rect comes back scaled and would solve in the wrong unit. */
const CANVAS = 1600;
const EDGE = 30;
const GAP = 18;
const STAGE_W = CANVAS - EDGE * 2;

/* A card is a 16:9 poster with its title under it. The foot is fixed, so only the
   poster changes size when the column count does. */
const FOOT = 52;
const FOOT_FLOW = 88;
/* The floor is a legibility floor, not a packing one. At 176px the twenty-three
   entries of the events chapter all fitted on one screen, and that was the whole
   complaint about the first version of this page: everything present, nothing
   readable from across a room. 230px keeps a two-line title at 14px comfortable,
   and the two biggest chapters scroll instead — which is what Certifications and
   Placements already do. */
const CARD_MIN = 230;
const CARD_MAX = 420;

const ordinal = (n) => String(n).padStart(2, '0');

/**
 * Pick the column count that fills the grid best.
 *
 * A card's height follows from its width — 16:9 plus a fixed foot — so the column
 * count decides both dimensions at once and there is exactly one number to solve.
 * Widest card that still fits the available height wins; ties go to the layout
 * with the least empty space in its last row, because a row holding one lone card
 * under five full ones reads as something gone wrong.
 */
function solveGrid(count, hasFlow, width, height) {
  const foot = hasFlow ? FOOT_FLOW : FOOT;
  let best = null;
  for (let cols = 1; cols <= Math.min(count, 8); cols += 1) {
    const rows = Math.ceil(count / cols);
    const w = (width - GAP * (cols - 1)) / cols;
    if (w < CARD_MIN || w > CARD_MAX) continue;
    const cardH = w * 9 / 16 + foot;
    const total = cardH * rows + GAP * (rows - 1);
    if (total > height) continue;
    const empty = cols * rows - count;
    if (best && (w < best.w || (Math.abs(w - best.w) < 0.5 && empty >= best.empty))) continue;
    best = { cols, rows, w, cardH, total, empty };
  }
  /* Nothing fits without scrolling — the biggest chapters. Take the most columns
     allowed and let the grid scroll, which is the honest outcome: shrinking a card
     below CARD_MIN makes the title unreadable, and this page exists to be read. */
  if (!best) {
    const cols = Math.min(count, Math.max(1, Math.floor((width + GAP) / (CARD_MIN + GAP))));
    const w = (width - GAP * (cols - 1)) / cols;
    best = { cols, rows: Math.ceil(count / cols), w, cardH: w * 9 / 16 + foot, total: Infinity, empty: 0 };
  }
  return best;
}

export function EventReel(block, { editing = false } = {}) {
  const chapters = (block.chapters || []).filter((c) => c.groups?.length);
  const root = h('div', { class: 'ev-root ph-root' });

  if (!chapters.length) {
    root.appendChild(h('div', { class: 'ev-empty' },
      h('h2', { class: 'ev-title' }, block.title || 'Events'),
      editing
        ? h('p', { class: 'ev-hint' },
            'Publish the film list from backend/uploads/Videos.xlsx and it appears here.')
        : null,
    ));
    return root;
  }

  const filmsIn = (c) => c.groups.reduce((n, g) => n + g.films.length, 0);
  const total = chapters.reduce((n, c) => n + filmsIn(c), 0);

  let chapter = chapters[0];
  let lastH = 0;

  /* The film plays across the display, not in a panel. Shared with the video
     resumes page, and portalled to the body so `inset: 0` means the screen and
     not the scaled slide. */
  const stage = filmStage({ label: 'Film' });

  /** Every film of the chapter, flattened, so the arrows walk the whole chapter. */
  function chapterFilms() {
    const out = [];
    chapter.groups.forEach((g) => g.films.forEach((f, i) => out.push({
      youtube: f.youtube,
      src: f.src,
      title: f.label || g.title,
      sub: g.films.length > 1
        ? `${chapter.name} · part ${i + 1} of ${g.films.length}`
        : chapter.name,
    })));
    return out;
  }

  /** Where a given part of a given entry sits in that flat list. */
  function flatIndex(gi, fi) {
    let n = 0;
    for (let i = 0; i < gi; i += 1) n += chapter.groups[i].films.length;
    return n + fi;
  }

  const openFilm = (gi, fi) => stage.open(chapterFilms(), flatIndex(gi, fi));

  /* ------------------------------------------------------------------ grid */
  const grid = h('div', { class: 'ev-grid' });

  grid.addEventListener('wheel', (e) => {
    if (grid.scrollHeight > grid.clientHeight) {
      const canScrollUp = grid.scrollTop > 0;
      const canScrollDown = grid.scrollTop + grid.clientHeight < grid.scrollHeight - 1;
      if ((e.deltaY > 0 && canScrollDown) || (e.deltaY < 0 && canScrollUp)) {
        e.preventDefault();
        e.stopPropagation();
        grid.scrollTop += e.deltaY;
      }
    }
  }, { passive: false });

  function drawGrid() {
    grid.textContent = '';
    grid.scrollTop = 0;

    const groups = chapter.groups;

    // Chunk cards into rows of max 4 cards for funnel alignment
    const rows = [];
    for (let i = 0; i < groups.length; i += 4) {
      rows.push(groups.slice(i, i + 4));
    }

    let globalIndex = 0;
    rows.forEach((rowGroups) => {
      const rowEl = h('div', { class: 'ev-row' });
      rowGroups.forEach((g) => {
        const gi = globalIndex++;
        const many = g.films.length > 1;
        const shot = h('span', { class: 'ev-card__shot' },
          posterImg(g.films[0]?.youtube, { eager: gi < 8 }),
          h('span', { class: 'ev-card__play', 'aria-hidden': 'true' },
            icon('play', { class: 'ic ic--sm' })),
        );

        /* The run of parts. Each chip opens its own film. */
        const flow = many
          ? h('div', { class: 'ev-flow' }, ...g.films.flatMap((f, fi) => {
              const chip = h('button', {
                class: 'ev-flow__part', type: 'button',
                title: f.label || `Part ${fi + 1}`,
                'aria-label': `${g.title}, part ${fi + 1}`,
                style: REDUCED?.matches ? {} : { '--i': String(fi) },
                onclick: (e) => { e.stopPropagation(); openFilm(gi, fi); },
              }, ordinal(fi + 1));
              return fi === g.films.length - 1 ? [chip] : [chip,
                h('span', { class: 'ev-flow__arrow', 'aria-hidden': 'true' },
                  icon('arrow-right', { class: 'ic ic--xs' }))];
            }))
          : null;

        const card = h('article', {
          class: `ev-card${many ? ' ev-card--flow' : ''}`,
          style: REDUCED?.matches ? {} : { '--i': String(Math.min(gi, 24)) },
        },
          h('button', {
            class: 'ev-card__hit', type: 'button', title: g.title,
            onclick: () => openFilm(gi, 0),
          }, shot),
          h('div', { class: 'ev-card__foot' },
            h('h3', { class: 'ev-card__title' }, g.title),
            flow,
          ),
        );
        rowEl.appendChild(card);
      });
      grid.appendChild(rowEl);
    });
  }

  /* ------------------------------------------------------------------ tabs */
  const tabs = h('div', { class: 'ev-tabs', role: 'tablist' });

  function drawTabs() {
    tabs.replaceChildren(...chapters.map((c, i) => h('button', {
      class: `ev-tab${c === chapter ? ' is-on' : ''}`,
      type: 'button', role: 'tab', 'aria-selected': String(c === chapter),
      style: REDUCED?.matches ? {} : { 'animation-delay': `${i * 60}ms` },
      onclick: () => {
        if (c === chapter) return;
        chapter = c;
        drawTabs(); drawGrid();
      },
    },
      icon(c.icon || 'calendar', { class: 'ic ic--sm' }),
      h('span', { class: 'ev-tab__name' }, (c.name || '').toUpperCase()),
    )));
  }

  /* ------------------------------------------------------------------ head */
  const head = h('div', { class: 'ev-head ev-head--clean' },
    h('h2', { class: 'ev-title ev-title--center' }, (block.title || 'NINE YEARS, ON FILM').toUpperCase()),
  );

  root.appendChild(head);
  root.appendChild(tabs);
  root.appendChild(grid);

  drawTabs();
  drawGrid();

  const watchSize = new ResizeObserver(() => {
    if (grid.clientHeight && Math.abs(grid.clientHeight - lastH) > 8) drawGrid();
  });
  watchSize.observe(grid);

  bindStageLifetime(root, stage);
  const watchGone = new MutationObserver(() => {
    if (!root.isConnected) { watchSize.disconnect(); watchGone.disconnect(); }
  });
  watchGone.observe(document.body, { childList: true, subtree: true });

  return root;
}
