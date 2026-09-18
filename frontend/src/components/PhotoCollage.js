import { h } from '../utils/dom.js';
import { upload } from '../utils/media.js';
import { openLightbox } from './Lightbox.js';
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
/* The rotation's own reduced-motion switch: with it on the collage is the nine
   it was composed with and nothing turns. */
const REDUCED = window.matchMedia?.('(prefers-reduced-motion: reduce)');

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
  /* THE MARK STANDS FOR ALL THREE (2026-09-18, on request: "I don't want all
     the stuff in the top left — place that logo and the button, that's it").
     The eyebrow, the headline and the lead are all still on the block, so
     nothing is thrown away and a deck with no mark of its own still sets them
     in type; they are simply not drawn when there is a wordmark to show.

     NOT inverted, unlike Project Street's. That one is black on a dark film;
     this is two-tone black and orange on this slide's pale ground, and its
     orange is already the deck's own accent. */
  if (block.logo) {
    copy.append(h('img', {
      class: 'pc-mark',
      src: upload(block.logo),
      alt: block.logoAlt || block.title || '',
      loading: 'eager',
      decoding: 'async',
    }));
  } else if (block.eyebrow) {
    copy.append(h('p', { class: 'pc-eyebrow' },
      h('span', { class: 'pc-eyebrow__mark', 'aria-hidden': 'true' }),
      h('span', { text: block.eyebrow })));
  }
  const lines = block.logo ? [] : String(block.title || '').split('\n').filter(Boolean);
  if (lines.length) {
    const title = h('h2', { class: 'pc-title', 'aria-label': lines.join(' ') });
    lines.forEach((line) => {
      title.append(letterRevealPreset(line, 'heading', {
        as: 'span', className: 'pc-title__line', trigger: true,
      }).node);
    });
    copy.append(title);
  }
  if (block.lead && !block.logo) copy.append(h('p', { class: 'pc-lead', text: block.lead }));
  const cta = h('button', {
    class: 'pc-cta',
    type: 'button',
    /* There is no wall below any more — the extra photographs come round on
       the cards themselves — so the pill opens the viewer, which is the one
       thing on this slide that shows a picture whole.
       there is nowhere to go, and it opens the viewer on the first card. */
    onclick: () => open(0),
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
  /* Which photograph each card is showing, as an index into `pool` below. The
     cards start on the nine the collage was composed with, in the order the
     publisher put them in, so the slide's first impression is unchanged. */
  const shown = photos.map((_, i) => i);
  const faces = [];

  photos.forEach((photo, i) => {
    const s = SLOTS[i];
    const img = h('img', {
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
    });
    faces.push(img);
    stage.append(h('button', {
      class: `pc-card pc-card--${s.enter}`,
      type: 'button',
      'aria-label': photo.name || `Photograph ${i + 1}`,
      style: {
        left: `${s.x}px`, top: `${s.y}px`, width: `${s.w}px`, height: `${s.h}px`,
        '--pc-delay': `${s.delay}ms`,
        '--pc-dur': `${s.dur}ms`,
      },
      onclick: () => open(shown[i]),
    }, h('span', { class: 'pc-card__face' }, img)));
  });


  /* ------------------------------------------------------- the rotating wall */
  /* THE EXTRA PHOTOGRAPHS COME TO THE CARDS (2026-09-18, on request: "remove
     the need for scrolling… an automatic photo replacement/flip system"). The
     slide used to be one screen of collage with a justified wall of sixteen
     more under it, reached by scrolling. The collage is the whole slide now and
     every photograph takes a turn on it.

     WHAT MAKES IT A ROTATION RATHER THAN A SHUFFLE. A queue holds every
     photograph in the pool in a shuffled order; each flip takes the next one
     off it, and the queue is only refilled once it is empty. That is what
     guarantees the thing that was actually asked for — every photograph is
     eventually displayed — where picking at random each time would leave some
     pictures unseen for a very long time and show others twice in a row.

     A photograph already on screen is skipped rather than drawn twice, and the
     card to flip is taken from its own shuffled rotation, so the same card
     never goes twice while another has not gone at all. */
  const pool = [...photos, ...more];
  if (pool.length <= photos.length) return root;

  const FLIP_MS = 1700;   // between flips — "approximately 1-2 seconds"
  const HALF_MS = 360;    // the turn, half of which happens before the swap

  const shuffle = (a) => {
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  };

  let queue = [];
  const nextPhoto = () => {
    /* Refilled only when empty: one pass of the queue is one showing of every
       photograph in the pool. */
    if (!queue.length) queue = shuffle(pool.map((_, i) => i));
    while (queue.length) {
      const next = queue.shift();
      if (!shown.includes(next)) return next;
    }
    return -1;
  };

  let order = [];
  const nextCard = () => {
    if (!order.length) order = shuffle(faces.map((_, i) => i));
    return order.shift();
  };

  let timer = 0;
  let held = false;

  function flip() {
    timer = 0;
    /* The deck rebuilds its DOM on every navigation; a chain left running would
       go on turning cards nobody can see. */
    if (!root.isConnected) return;
    if (held) { timer = setTimeout(flip, FLIP_MS); return; }

    const slot = nextCard();
    const pick = nextPhoto();
    const img = faces[slot];
    if (pick < 0 || !img || !img.isConnected) { timer = setTimeout(flip, FLIP_MS); return; }

    const card = img.closest('.pc-card');
    const photo = pool[pick];
    /* Decoded before the turn starts, so the card never shows a gap at the
       half-way point where the new picture is put in. */
    const warm = new Image();
    warm.src = urlOf(photo);
    const swap = () => {
      shown[slot] = pick;
      img.src = urlOf(photo);
      img.alt = photo.name || '';
      img.style.objectPosition = photo.focus || '';
      card.classList.remove('is-flip');
    };
    card.classList.add('is-flip');
    setTimeout(swap, HALF_MS);
    timer = setTimeout(flip, FLIP_MS);
  }

  /* The pointer over a card holds the wall: a presenter pointing at a
     photograph should not have it turn over under them. */
  stage.addEventListener('pointerenter', () => { held = true; });
  stage.addEventListener('pointerleave', () => { held = false; });

  if (!REDUCED?.matches) timer = setTimeout(flip, FLIP_MS);

  return root;
}
