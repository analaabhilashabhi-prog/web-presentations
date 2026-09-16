import { h } from '../utils/dom.js';
import { upload } from '../utils/media.js';
import { openLightbox } from './Lightbox.js';
import { justifyRows } from './PlacementWall.js';
import { letterRevealPreset } from '../utils/letterReveal.js';

/**
 * A headline beside a collage of photographs — and, below the fold, the rest.
 *
 * Built to a reference image: copy in the left third — eyebrow, a two-line
 * headline, a lead, one pill — and to its right a staggered collage of nine
 * cards at different heights and offsets, with a short list of four lines set
 * into a gap in the collage. The reference is black and white; this one keeps
 * the photographs in colour and takes its ink, its button and its accent from
 * the organization's own palette.
 *
 * The cards do not arrive together. Each slot carries its own entrance — up
 * from below, a slow drift with a slight settle of scale, a slide from the side,
 * an unfold — with its own delay and its own duration, so the collage assembles
 * rather than fades in. The headline arrives on the deck's letter reveal.
 *
 * The geometry is fixed. Nine slots, laid out on the 1600x860 canvas by hand
 * from the reference's proportions, and the photographs are dealt into them in
 * order. A card is a window on its photograph — `cover`, with a focus point the
 * publisher sets per picture — and the whole picture is one press away in the
 * shared viewer.
 *
 * Under the collage, when the block carries `more[]`, the slide keeps going: a
 * justified wall of every further photograph, rows solved so nothing is
 * cropped, each tile fading up as it scrolls into view. The root is the
 * scroller, eased by hand off the wheel the way the Trainings page is, and the
 * pill scrolls down to the wall rather than opening a viewer over it. The
 * viewer holds the whole set — collage first, then the wall — so from any
 * picture the arrows walk through all of them.
 */

/* The slots, on the nominal 1600x860 canvas. Named after the reference's own
   arrangement: the card under the copy, then four columns rising toward the
   right edge, the fourth of which carries the list above its card. */
const SLOTS = [
  { x: 60,   y: 570, w: 245, h: 230, enter: 'rise',   delay: 520, dur: 980 },   // under the pill
  { x: 340,  y: 395, w: 265, h: 250, enter: 'drift',  delay: 180, dur: 1400 },  // col 2, top
  { x: 340,  y: 670, w: 265, h: 130, enter: 'rise',   delay: 700, dur: 900 },   // col 2, bottom
  { x: 645,  y: 330, w: 265, h: 260, enter: 'unfold', delay: 80,  dur: 1100 },  // col 3, top
  { x: 645,  y: 615, w: 265, h: 185, enter: 'rise',   delay: 460, dur: 1000 },  // col 3, bottom
  { x: 950,  y: 500, w: 265, h: 300, enter: 'drift',  delay: 620, dur: 1500 },  // col 4, under the list
  { x: 1255, y: 60,  w: 265, h: 165, enter: 'sink',   delay: 260, dur: 900 },   // col 5, top
  { x: 1255, y: 250, w: 265, h: 360, enter: 'slide',  delay: 380, dur: 1200 },  // col 5, tall
  { x: 1255, y: 635, w: 265, h: 165, enter: 'rise',   delay: 840, dur: 900 },   // col 5, bottom
];
/* Where the list sits — the gap the fourth column leaves above its card. */
const LIST = { x: 950, y: 335, w: 265 };

/* The wall under the collage: the canvas width less the copy's 60px margin
   each side, rows aimed at 300px, the gap the collage's own cards keep. */
const WALL_WIDTH = 1600 - 2 * 60;
const WALL_ROW = 300;
const WALL_GAP = 16;
/* How much of the way to the target each frame closes. Same figure as the
   Trainings page, which is the same gesture. */
const SCROLL_EASE = 0.22;

export function PhotoCollage(block = {}) {
  const photos = (block.photos || []).filter((p) => p && p.src).slice(0, SLOTS.length);
  const more = (block.more || []).filter((p) => p && p.src && p.w && p.h);
  const root = h('section', { class: 'pc-root' });
  if (!photos.length) return root;

  const base = String(block.base || '').replace(/^\/+|\/+$/g, '');
  const urlOf = (p) => upload(base ? `${base}/${p.src}` : p.src);
  /* One list for the viewer: the collage, then the wall, so its arrows walk
     every photograph in the order the slide shows them. */
  const all = [...photos, ...more].map((p) => ({ url: urlOf(p), name: p.name || '' }));
  const open = (i) => openLightbox(all, i);

  /* The first screen. Everything on it is anchored to the TOP in canvas pixels,
     and the stage takes the root's full height — 860 on the canvas, `--slide-h`
     in the room — so the wall begins exactly one screen down. The stage growing
     by the difference moves nothing on it. */
  const stage = h('div', { class: 'pc-stage' });
  root.append(stage);

  /* Soft blobs behind the collage, in the organization's own two measured
     colours. First child on purpose: positioned siblings with no z-index paint
     in document order, so everything built after this — the copy, the list and
     every photograph — lands on top of it without a single z-index. */
  if (block.glow !== 'none') {
    stage.append(h(
      'div',
      {
        class: 'pc-glow',
        'aria-hidden': 'true',
        style: {
          '--pc-glow': block.glow || null,
          '--pc-glow-2': block.glow2 || null,
        },
      },
      h('span', { class: 'pc-blob pc-blob--a' }),
      h('span', { class: 'pc-blob pc-blob--b' }),
      h('span', { class: 'pc-blob pc-blob--c' }),
    ));
  }

  // ------------------------------------------------------------------ the copy
  const copy = h('div', { class: 'pc-copy' });
  if (block.eyebrow) {
    copy.append(h('p', { class: 'pc-eyebrow' },
      h('span', { class: 'pc-eyebrow__mark', 'aria-hidden': 'true' }),
      h('span', { text: block.eyebrow })));
  }
  const lines = String(block.title || '').split('\n').filter(Boolean);
  if (lines.length) {
    const title = h('h2', { class: 'pc-title', 'aria-label': lines.join(' ') });
    lines.forEach((line) => {
      title.append(letterRevealPreset(line, 'heading', {
        as: 'span', className: 'pc-title__line', trigger: true,
      }).node);
    });
    copy.append(title);
  }
  if (block.lead) copy.append(h('p', { class: 'pc-lead', text: block.lead }));
  const cta = h('button', {
    class: 'pc-cta',
    type: 'button',
    /* With a wall below, the pill takes the presenter down to it; without one
       there is nowhere to go, and it opens the viewer on the first card. */
    onclick: () => (more.length ? scrollTo(wall.offsetTop) : open(0)),
  }, block.ctaLabel || 'See every photograph');
  copy.append(cta);
  stage.append(copy);

  // ------------------------------------------------------------------ the list
  const points = (block.points || []).filter(Boolean).slice(0, 5);
  if (points.length) {
    stage.append(h('ul', {
      class: 'pc-points',
      style: { left: `${LIST.x}px`, top: `${LIST.y}px`, width: `${LIST.w}px` },
    }, ...points.map((text, i) => h('li', { style: { '--pc-i': String(i) } },
      h('span', { class: 'pc-points__arrow', 'aria-hidden': 'true', text: '↗' }),
      h('span', { text })))));
  }

  // --------------------------------------------------------------- the collage
  photos.forEach((photo, i) => {
    const s = SLOTS[i];
    stage.append(h('button', {
      class: `pc-card pc-card--${s.enter}`,
      type: 'button',
      'aria-label': photo.name || `Photograph ${i + 1}`,
      style: {
        left: `${s.x}px`, top: `${s.y}px`, width: `${s.w}px`, height: `${s.h}px`,
        '--pc-delay': `${s.delay}ms`,
        '--pc-dur': `${s.dur}ms`,
      },
      onclick: () => open(i),
    }, h('span', { class: 'pc-card__face' },
      h('img', {
        src: urlOf(photo),
        alt: photo.name || '',
        draggable: 'false',
        loading: 'eager',
        decoding: 'async',
        /* Where the card looks within its photograph — set per picture by the
           publisher, because a tall card on a wide group shot has to be told
           where the people are. */
        style: photo.focus ? { objectPosition: photo.focus } : null,
        onerror: (event) => event.currentTarget.closest('.pc-card')?.remove(),
      }))));
  });

  if (!more.length) return root;

  // ------------------------------------------------------------------ the wall
  const wall = h('div', { class: 'pc-more' });
  wall.append(h('div', { class: 'pc-more__head' },
    h('p', { class: 'pc-eyebrow pc-more__label' },
      h('span', { class: 'pc-eyebrow__mark', 'aria-hidden': 'true' }),
      h('span', { text: block.moreLabel || 'Every photograph' })),
    h('span', { class: 'pc-more__count', text: `${all.length} photographs` })));

  const rows = justifyRows(more.map((p, i) => ({ ...p, i })), WALL_WIDTH, WALL_ROW, WALL_GAP);
  let n = 0;
  rows.forEach((row) => {
    wall.append(h('div', { class: `pc-more__row${row.full ? ' is-full' : ''}` },
      ...row.items.map((it) => {
        const tile = h('button', {
          class: 'pc-tile',
          type: 'button',
          'aria-label': it.name || `Photograph ${photos.length + it.i + 1}`,
          style: {
            width: `${it.dw.toFixed(2)}px`,
            height: `${it.dh.toFixed(2)}px`,
            /* Its place in the wall, for the stagger of a row that arrives
               together. */
            '--pc-n': String(n++ % 6),
          },
          onclick: () => open(photos.length + it.i),
        }, h('img', {
          src: urlOf(it),
          alt: it.name || '',
          draggable: 'false',
          loading: 'lazy',
          decoding: 'async',
          onerror: (event) => event.currentTarget.closest('.pc-tile')?.remove(),
        }));
        return tile;
      })));
  });

  wall.append(h('div', { class: 'pc-more__foot' },
    h('button', {
      class: 'pc-cta pc-cta--ghost',
      type: 'button',
      onclick: () => scrollTo(0),
    }, block.topLabel || 'Back to the top')));
  root.append(wall);

  /* Tiles fade up as they scroll into view — and stay, so scrolling back up
     does not replay the wall. The observer's root is the scroller, not the
     viewport: inside FitSlide the viewport is the wrong frame. */
  if ('IntersectionObserver' in window) {
    const seen = new IntersectionObserver((entries) => {
      entries.forEach((e) => {
        if (e.isIntersecting) { e.target.classList.add('is-seen'); seen.unobserve(e.target); }
      });
    }, { root, rootMargin: '0px 0px 60px 0px', threshold: 0.12 });
    wall.querySelectorAll('.pc-tile').forEach((t) => seen.observe(t));
  } else {
    wall.querySelectorAll('.pc-tile').forEach((t) => t.classList.add('is-seen'));
  }

  // --------------------------------------------------------------- the scroll
  /* Scrolled by hand and eased, never with `scroll-behavior: smooth` — reading
     `scrollTop` back mid-animation is how a wall stops scrolling. */
  let target = 0;
  let raf = 0;
  const maxScroll = () => Math.max(0, root.scrollHeight - root.clientHeight);
  /* The browser keeps scrollTop in whole pixels, so an ease that asks for less
     than a pixel of movement gets none and never arrives — it sat 2px short of
     the wall and 2px short of the top, spinning a frame loop forever. Inside a
     pixel of the target it lands; a step under a pixel is made a pixel. */
  function frame() {
    raf = 0;
    const cur = root.scrollTop;
    const left = target - cur;
    if (Math.abs(left) < 1) { root.scrollTop = target; return; }
    const step = left * SCROLL_EASE;
    root.scrollTop = cur + (Math.abs(step) < 1 ? Math.sign(step) : step);
    raf = requestAnimationFrame(frame);
  }
  function scrollTo(y) {
    target = Math.max(0, Math.min(y, maxScroll()));
    if (!raf) raf = requestAnimationFrame(frame);
  }
  root.addEventListener('wheel', (event) => {
    event.preventDefault();
    /* A drag on the scrollbar-less scroller or a touch flick moves it natively;
       pick the target up from wherever that left it. */
    if (!raf) target = root.scrollTop;
    scrollTo(target + event.deltaY);
  }, { passive: false });

  return root;
}
