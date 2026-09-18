import { h } from '../utils/dom.js';
import { upload } from '../utils/media.js';
import { openLightbox } from './Lightbox.js';
import { letterRevealPreset } from '../utils/letterReveal.js';

/**
 * A folder of photographs that opens into a bento wall.
 *
 * Built to a reference the user supplied, shape for shape: a manila folder
 * standing in the middle of the frame — the back panel with its tab, three
 * document cards fanned out of the mouth, the pocket across the front carrying
 * the folder's own name and "N Files". Pressing the button empties it: every
 * card flies out of the mouth and lands in a bento of deliberately unequal
 * tiles, and Back sends them home along the same path.
 *
 * **A card is a document, closed and open.** White paper, the photograph on it
 * at its own exact ratio, the name and a line beneath — so nothing is ever
 * cropped, and the same element is the peeking card and the bento tile. Its box
 * is its *bento* slot, written once in px; the closed state is a
 * `translate … scale … rotate` that carries that box back into the mouth,
 * solved in JS from the two rectangles. Opening and closing are therefore one
 * transition played in opposite directions, and no width or height is ever
 * animated. Scaled down into the mouth, the caption reads as the two grey lines
 * the reference draws on its documents.
 *
 * **The cards stay behind the pocket, always.** On the way out a card emerges
 * from behind the pocket while the pocket fades; on the way back it slides
 * behind the pocket as the pocket fades in. No z-index moves mid-flight.
 *
 * **The wall is solved from the photographs' own shapes.** A composition names
 * columns of tile widths; each tile's height follows from its photograph's
 * aspect plus a fixed caption band, columns are centred on one another, and the
 * whole is centred on the frame — so a picture is never squeezed into a tile
 * that is not its shape.
 */

const W = 1600;
const SVG_NS = 'http://www.w3.org/2000/svg';
const svgEl = (tag, attrs = {}) => {
  const el = document.createElementNS(SVG_NS, tag);
  Object.entries(attrs).forEach(([k, v]) => el.setAttribute(k, String(v)));
  return el;
};

/* ---------------------------------------------------------------- the folder */
/* Read off the reference by proportion and set 900 wide: its folder is 85% of
   its frame, and "a bit big" was the brief. */
const FOLDER = { x: 350, w: 900 };
/* The back panel — the part with the tab. Slightly inside the pocket on both
   sides, as the reference's is. Local coordinates run from its own top-left. */
const SHELL = { x: 362, y: 232, w: 876, h: 458, r: 30, tabEnd: 736, shoulder: 92, slope: 72 };
/* The pocket across the front. */
const POCKET = { x: 350, y: 476, w: 900, h: 220 };
/* Where a card peeks out of the mouth: the centre it stands on, the top of its
   visible edge, and its lean. Read outward from the middle; the middle card is
   highest and in front, as the reference has it. */
const PEEK_W = 250;
const PEEK = [
  { cx: 800, top: 258, rot: 0, z: 25 },
  { cx: 598, top: 298, rot: -12, z: 23 },
  { cx: 1002, top: 298, rot: 12, z: 23 },
  { cx: 470, top: 332, rot: -22, z: 21 },
  { cx: 1130, top: 332, rot: 22, z: 21 },
  { cx: 400, top: 360, rot: -30, z: 19 },
];

/* ------------------------------------------------------------------ the wall */
/* Columns of tile widths, by count. Unequal on purpose and written out by hand:
   "random but intentional" is a composition, not a random number. Heights are
   never written — they follow from each photograph's own ratio. */
const COLUMNS = {
  1: [[820]],
  2: [[640], [480]],
  3: [[700], [340, 340]],
  4: [[560], [380, 380], [300]],
  5: [[520], [380, 380], [340, 340]],
  6: [[460, 460], [360, 360], [360, 360]],
};
const GAP = 26;
const PAD = 14;               // the paper around the photograph
const CAP_FULL = 96;          // caption band: name and two lines
const CAP_SMALL = 54;         // caption band: name only, on a tile under 400 wide
const WALL_CY = 458;          // the wall is centred on this line
const WALL_MAX_H = 612;       // and never taller than this — the bar is below

function layoutWall(photos) {
  const n = photos.length;
  const aspect = (p) => (p.w && p.h ? p.w / p.h : 1.4);
  let columns = COLUMNS[n];
  if (!columns) {
    const cols = Math.ceil(Math.sqrt(n));
    const w = Math.floor((1400 - GAP * (cols - 1)) / cols);
    columns = Array.from({ length: cols }, (_, c) => photos.filter((_, i) => i % cols === c).map(() => w));
  }
  const build = (scale) => {
    let i = 0;
    let x = 0;
    let maxH = 0;
    const cols = columns.map((widths) => {
      let y = 0;
      const items = widths.map((w0) => {
        const p = photos[i++];
        const w = Math.round(w0 * scale);
        const ph = Math.round((w - 2 * PAD) / aspect(p));
        const cap = w >= 400 ? CAP_FULL : CAP_SMALL;
        const item = { x, y, w, h: PAD + ph + cap + PAD, ph, cap, small: w < 400 };
        y += item.h + GAP;
        return item;
      });
      const colH = y - GAP;
      maxH = Math.max(maxH, colH);
      const colW = Math.max(...items.map((it) => it.w));
      const col = { items, h: colH };
      x += colW + GAP;
      return col;
    });
    return { cols, w: x - GAP, h: maxH };
  };
  let r = build(1);
  if (r.h > WALL_MAX_H) r = build(WALL_MAX_H / r.h);
  const left = Math.round((W - r.w) / 2);
  const top = Math.round(WALL_CY - r.h / 2);
  const slots = [];
  r.cols.forEach((c) => {
    const lift = Math.round((r.h - c.h) / 2);   // columns centred on one another
    c.items.forEach((it) => slots.push({ ...it, x: left + it.x, y: top + lift + it.y }));
  });
  return slots;
}

/** The back panel of the folder: a rounded sheet whose top steps down on the right — the tab. */
function shellPath({ w, h, r, tabEnd, shoulder, slope }) {
  return [
    `M ${r} 0`,
    `H ${tabEnd}`,
    `C ${tabEnd + slope / 2} 0, ${tabEnd + slope / 2} ${shoulder}, ${tabEnd + slope} ${shoulder}`,
    `H ${w - r}`,
    `A ${r} ${r} 0 0 1 ${w} ${shoulder + r}`,
    `V ${h}`,
    `H 0`,
    `V ${r}`,
    `A ${r} ${r} 0 0 1 ${r} 0`,
    'Z',
  ].join(' ');
}

export function PhotoFolder(block = {}) {
  const photos = (block.photos || []).filter((p) => p && p.src);
  const root = h('section', { class: 'fd-root', tabindex: '0', 'aria-label': block.title || 'Photographs' });
  if (!photos.length) return root;

  const base = String(block.base || '').replace(/^\/+|\/+$/g, '');
  const urlOf = (p) => upload(base ? `${base}/${p.src}` : p.src);
  const all = photos.map((p) => ({ url: urlOf(p), name: p.name || '' }));

  /* ------------------------------------------------------------ the ground */
  if (block.glow !== 'none') {
    root.append(h('div', {
      class: 'fd-glow',
      'aria-hidden': 'true',
      style: { '--fd-glow': block.glow || null, '--fd-glow-2': block.glow2 || null },
    },
    h('span', { class: 'fd-blob fd-blob--a' }),
    h('span', { class: 'fd-blob fd-blob--b' }),
    h('span', { class: 'fd-blob fd-blob--c' })));
  }

  /* -------------------------------------------------------------- the head */
  const backBtn = h('button', {
    class: 'fd-back',
    type: 'button',
    onclick: () => close(),
  }, h('span', { class: 'fd-back__arrow', 'aria-hidden': 'true', text: '←' }),
  h('span', { text: block.backLabel || 'Back to the folder' }));
  root.append(h('div', { class: 'fd-head' }, backBtn));

  /* ------------------------------------------------------------ the folder */
  const shell = svgEl('svg', {
    class: 'fd-shell',
    viewBox: `0 0 ${SHELL.w} ${SHELL.h}`,
    width: SHELL.w,
    height: SHELL.h,
    style: `left:${SHELL.x}px;top:${SHELL.y}px`,
    'aria-hidden': 'true',
  });
  shell.append(svgEl('path', { class: 'fd-shell__body', d: shellPath(SHELL) }));

  const title = h('div', { class: 'fd-pocket__title' });
  String(block.title || '').split('\n').filter(Boolean).forEach((line) => {
    title.append(letterRevealPreset(line, 'heading', { as: 'span', className: 'fd-pocket__line', trigger: true }).node);
  });
  const openBtn = h('button', {
    class: 'fd-open',
    type: 'button',
    onclick: () => open(),
  }, h('span', { text: block.openLabel || 'View photos' }),
  h('span', { class: 'fd-open__arrow', 'aria-hidden': 'true', text: '↗' }));
  const pocket = h('div', {
    class: 'fd-pocket',
    style: { left: `${POCKET.x}px`, top: `${POCKET.y}px`, width: `${POCKET.w}px`, height: `${POCKET.h}px` },
  },
  h('div', { class: 'fd-pocket__copy' },
    title,
    h('p', { class: 'fd-pocket__count', text: `${photos.length} ${photos.length === 1 ? 'File' : 'Files'}` })),
  openBtn);

  /* --------------------------------------------------------- the documents */
  const slots = layoutWall(photos);
  const cards = photos.map((p, i) => {
    const s = slots[i];
    const peek = PEEK[Math.min(i, PEEK.length - 1)];
    /* The closed transform: the card's own box carried back into the mouth.
       `transform-origin` is the centre, so the scale and the lean happen about
       the card's middle and the translate only has to move that middle. */
    const scale = PEEK_W / s.w;
    const peekCy = peek.top + (s.h * scale) / 2;
    const dx = peek.cx - (s.x + s.w / 2);
    const dy = peekCy - (s.y + s.h / 2);
    const tucked = `translate3d(${Math.round(dx)}px, ${Math.round(dy)}px, 0) scale(${scale.toFixed(4)}) rotate(${peek.rot}deg)`;

    return h('button', {
      class: `fd-card${s.small ? ' fd-card--small' : ''}`,
      type: 'button',
      'aria-label': p.name || `Photograph ${i + 1}`,
      style: {
        left: `${s.x}px`, top: `${s.y}px`, width: `${s.w}px`, height: `${s.h}px`,
        '--fd-tucked': tucked,
        '--fd-cap': `${s.cap}px`,
        /* Out from the middle of the fan, and home in the same order reversed. */
        '--fd-delay': `${Math.round(Math.abs(i - (photos.length - 1) / 2) * 90)}ms`,
        zIndex: String(peek.z),
      },
      onclick: () => { if (openState) openLightbox(all, i); else open(); },
    },
    h('span', { class: 'fd-card__paper' },
      h('span', { class: 'fd-card__shot', style: { height: `${s.ph}px` } },
        h('img', {
          src: urlOf(p),
          alt: p.name || '',
          draggable: 'false',
          loading: 'eager',
          decoding: 'async',
          onerror: (event) => event.currentTarget.closest('.fd-card')?.remove(),
        })),
      h('span', { class: 'fd-card__text' },
        h('span', { class: 'fd-card__name', text: p.name || `Photograph ${i + 1}` }),
        p.desc && !s.small ? h('span', { class: 'fd-card__desc', text: p.desc }) : null)));
  });

  /* The pocket is drawn after the cards and never moves in z, so a card is
     always behind it — which is what makes it read as coming out of the
     folder. */
  root.append(shell, ...cards, pocket);

  // ----------------------------------------------------------------- state
  let openState = false;
  /* `focus` is false when the folder opens itself: moving focus is an answer to
     a press, and there has not been one. Taking it anyway would also pull the
     ring onto a control nobody asked for, in front of a room. */
  function open({ focus = true } = {}) {
    if (openState) return;
    openState = true;
    root.classList.add('is-open');
    if (focus) backBtn.focus({ preventScroll: true });
  }
  function close() {
    if (!openState) return;
    openState = false;
    root.classList.remove('is-open');
    openBtn.focus({ preventScroll: true });
  }

  /* IT OPENS ITSELF (2026-09-18, on request: "it should open itself
     automatically... till we go to the next step it should stay like that").
     The folder is the slide's first impression and has to be seen as a folder
     before it is emptied, so the deal is left alone for a beat and then runs on
     its own. AUTO_OPEN is measured from mount and clears the slide's own
     entrance, which is about 0.7s, with time to read the pocket after it.

     It fires once and never closes anything. Back and Escape still work, and a
     presenter who has already pressed something is never overruled: any press
     on this slide before the timer cancels it, because the one thing worse than
     a folder that does not open is one that opens over somebody's hand. */
  const AUTO_OPEN = 2400;
  let pressed = false;
  const takeOver = () => { pressed = true; };
  root.addEventListener('pointerdown', takeOver, true);
  root.addEventListener('keydown', takeOver, true);
  setTimeout(() => {
    /* The deck rebuilds its DOM on every navigation, so a slide left before the
       timer ran must not open the folder in the one that replaced it. */
    if (!root.isConnected || pressed || openState) return;
    open({ focus: false });
  }, AUTO_OPEN);

  root.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && openState) {
      event.stopPropagation(); event.preventDefault();
      close();
      return;
    }
    if (event.key === 'Enter' && !openState && event.target === root) {
      event.stopPropagation(); event.preventDefault();
      open();
    }
  });

  return root;
}
