import { h } from '../utils/dom.js';
import { upload } from '../utils/media.js';
import { openLightbox } from './Lightbox.js';
import { registerStepper } from '../utils/slideSteps.js';
import { pointerHold } from '../utils/pointerHold.js';

/**
 * A spread of photographs around one large one — the travel-journal page.
 *
 * Built to a reference image the user supplied: one wide photograph in the
 * middle, a little left of centre; small prints scattered around it, some
 * overlapping its edges, some cut by the frame. The reference also carries a
 * timeline of handwritten notes above and three lines of copy below; both were
 * built and then REMOVED on request (2026-09-21, "I just want the photographs").
 * The slide is the pictures and nothing else, on Torii's light sheet with its
 * two measured colours washing behind.
 *
 * THE PRINTS TRADE PLACES ON THEIR OWN, about once a second. One of the small
 * prints travels into the middle and the one that was there travels out to the
 * place it left — a swap, so no picture is ever off the page. Point at the
 * slide and it holds; leave it and it carries on. Press a small print and it
 * comes to the middle at once; press the middle one and it opens full size.
 *
 * THE BOX IS WHAT MOVES, NOT A TRANSFORM — and that is the whole of "smooth".
 * The first cut was a FLIP: the print laid out at its new box and scaled back
 * onto the old one with `scale(sx, sy)`, then released. Two things were wrong
 * with it, both visible. The scale is non-uniform because a 16:9 slot and a
 * 4:5 slot are different shapes, so for 760ms the photograph — and its white
 * border — STRETCHED, faces widening and narrowing on the way; and the print
 * going out was rasterised at its small destination size and then shown six
 * times larger for the first frames, blurred, sharpening as it shrank. Neither
 * is a jitter a profiler would find. Animating `left/top/width/height` instead
 * relays two absolutely-positioned elements a frame, which costs nothing
 * measurable here, and inside each box `object-fit: cover` RE-CROPS the
 * photograph frame by frame rather than distorting it; the border stays 6px
 * throughout, and the image is drawn at its true size on every frame. This
 * deck's rule against animating boxes is about type being re-set; there is no
 * type on this slide.
 *
 * Three layers a print all the same: `.sp-photo` carries the box and its
 * transition, `.sp-photo__rise` the entrance, `.sp-photo__face` the tilt and
 * the hover — three rules that would otherwise fight over one element.
 */

/* The middle: 940x529, 16:9, a little left of the frame's centre like the
   reference's. BIGGER THAN THE FIRST CUT (2026-09-21, "more bigger pics"):
   that one was 800x452 and read as a spread floating in a frame once the
   words around it had gone. This fills the 804 rows above the presenter bar
   from y=95 to 748. */
const HERO = { x: 250, y: 95, w: 940, h: 529 };

/* The prints, in the order they take their turn in the middle — the left three,
   the bottom left, then across the right cluster. LAID OUT BY HAND, NOT SCALED:
   the first geometry scaled up 1.22 about its centre put the big right-hand
   print entirely off the frame — the right cluster is wide, and a uniform
   scale pushes its far edge out faster than it grows. So every slot was
   re-placed at about 1.3x its size with the same character as the reference:
   the left three overlapping the middle's left edge, the right cluster dense
   beside it, two prints cut by the frame. The tall slots stay 4:5 rather than
   the reference's 1:2, because these photographs are landscape and a 1:2 crop
   of one is a strip. `tilt` is the print's rest lean. */
const SLOTS = [
  { x: -40,  y: 145, w: 270, h: 338, tilt: -1.6 },  // far left, tall, cut by the edge
  { x: 215,  y: 275, w: 165, h: 165, tilt:  2.2 },  // small, over the middle's left edge
  { x: 60,   y: 415, w: 270, h: 176, tilt: -1.2 },  // landscape, under it
  { x: 20,   y: 605, w: 225, h: 143, tilt:  1.4 },  // bottom left
  { x: 1145, y: 225, w: 205, h: 280, tilt:  1.3 },  // tall, over the middle's right edge
  { x: 1360, y: 125, w: 130, h: 160, tilt: -1.8 },  // right cluster, top row
  { x: 1505, y: 125, w: 140, h: 160, tilt:  1.0 },  //   cut by the edge
  { x: 1360, y: 300, w: 140, h: 132, tilt:  1.8 },  // second row
  { x: 1515, y: 300, w: 140, h: 140, tilt: -1.3 },  //   cut by the edge
  { x: 1405, y: 447, w: 265, h: 265, tilt: -0.8 },  // big, cut by the right edge
  { x: 1255, y: 523, w: 140, h: 180, tilt:  1.7 },  // portrait, low
  { x: 1040, y: 535, w: 205, h: 142, tilt:  1.2 },  // landscape, over the middle's corner
];

/* About a second a swap (on request: "between one second"), with a flight
   that takes most of it — so the page is very nearly always in gentle motion,
   which is the effect wanted, rather than a still page that jumps. */
const SWAP_EVERY = 1150;   // ms between swaps
const FLIGHT = 640;        // ms, the stylesheet's transition; z-order is held for it
const FIRST_SWAP = 2300;   // ms after mount — clear of the entrance

const REDUCED = window.matchMedia?.('(prefers-reduced-motion: reduce)');

export function PhotoSpread(block = {}) {
  const photos = (block.photos || []).filter((p) => p && p.src).slice(0, SLOTS.length + 1);
  const root = h('section', { class: 'sp-root', tabindex: '0', 'aria-label': block.title || 'Workspace' });
  if (!photos.length) return root;

  const base = String(block.base || '').replace(/^\/+|\/+$/g, '');
  const urlOf = (p) => upload(base ? `${base}/${p.src}` : p.src);
  const all = photos.map((p) => ({ url: urlOf(p), name: p.name || '' }));

  /* The wash. First child, so everything after it paints on top with no
     z-index; placed where the ground shows — top right and bottom left. */
  if (block.glow !== 'none') {
    root.append(h('div', {
      class: 'sp-glow', 'aria-hidden': 'true',
      style: { '--sp-glow': block.glow || null, '--sp-glow-2': block.glow2 || null },
    },
    h('span', { class: 'sp-blob sp-blob--a' }),
    h('span', { class: 'sp-blob sp-blob--b' })));
  }

  // -------------------------------------------------------------- the prints
  /* `where[i]` is the slot photograph i is in: -1 is the middle, otherwise an
     index into SLOTS. The first photograph opens in the middle. */
  const where = photos.map((_, i) => i - 1);
  const stage = h('div', { class: 'sp-stage' });
  root.append(stage);

  const rectOf = (slot) => (slot < 0 ? HERO : SLOTS[slot]);
  const tiltOf = (slot) => (slot < 0 ? 0 : SLOTS[slot].tilt);

  const els = photos.map((p, i) => {
    const img = h('img', {
      src: urlOf(p),
      alt: p.name || '',
      loading: 'eager',
      decoding: 'async',
      draggable: 'false',
      style: p.focus ? { objectPosition: p.focus } : {},
    });
    const face = h('button', { class: 'sp-photo__face', type: 'button', 'aria-label': p.name || `Photograph ${i + 1}` }, img);
    const rise = h('div', { class: 'sp-photo__rise' }, face);
    const el = h('figure', { class: 'sp-photo', style: { '--sp-i': String(i) } }, rise);
    /* Press a print and it comes to the middle; press the middle and it opens. */
    face.addEventListener('click', () => {
      userMoved();
      if (where[i] < 0) open(i);
      else swapInto(i);
    });
    stage.append(el);
    return el;
  });

  const open = (i) => openLightbox(all, i);

  /* Writes a photograph's box for its slot. The stylesheet's transition on the
     four box properties carries it from wherever it was; `flying` lifts it over
     everything for the flight, both of them, since they cross. */
  const seat = (i, flying) => {
    const el = els[i];
    const slot = where[i];
    const r = rectOf(slot);
    el.style.left = `${r.x}px`;
    el.style.top = `${r.y}px`;
    el.style.width = `${r.w}px`;
    el.style.height = `${r.h}px`;
    el.style.setProperty('--sp-tilt', `${tiltOf(slot)}deg`);
    el.classList.toggle('is-hero', slot < 0);
    if (!flying) return;
    el.classList.add('is-flying');
    clearTimeout(el.__land);
    el.__land = setTimeout(() => el.classList.remove('is-flying'), FLIGHT + 40);
  };

  const heroIndex = () => where.indexOf(-1);

  /* The swap: photograph `i` comes to the middle, and whatever was there takes
     the slot it left. */
  const swapInto = (i) => {
    const slot = where[i];
    if (slot < 0) return;
    const j = heroIndex();
    where[i] = -1;
    where[j] = slot;
    seat(i, true);
    seat(j, true);
  };

  /* Which slot takes its turn next, round the ring. */
  let cursor = 0;
  const swapSlot = (slot) => {
    const i = where.indexOf(slot);
    if (i > -1) swapInto(i);
  };
  const stepForward = () => { swapSlot(cursor % SLOTS.length); cursor += 1; };
  const stepBack = () => { cursor -= 1; swapSlot(((cursor % SLOTS.length) + SLOTS.length) % SLOTS.length); };

  // ------------------------------------------------------------- the autoplay
  /* `isConnected` is checked when the timer FIRES, never when it is set — the
     first schedule is made before the caller has appended this root, when it
     is always false, and that mistake once left the Events wheel on photograph
     one. */
  let timer = 0;
  let autoAt = 0;
  const hold = pointerHold(root, { idle: 3000, onRelease: () => schedule(SWAP_EVERY) });
  const schedule = (ms) => {
    if (REDUCED?.matches) return;
    clearTimeout(timer);
    autoAt = performance.now() + ms;
    timer = setTimeout(tick, ms);
  };
  const tick = () => {
    timer = 0;
    if (!root.isConnected) return;
    if (hold.held) { schedule(600); return; }
    const wait = autoAt - performance.now();
    if (wait > 40) { timer = setTimeout(tick, wait); return; }
    stepForward();
    schedule(SWAP_EVERY);
  };
  /* A gesture buys a beat of stillness before the ring moves on its own. */
  const userMoved = () => { if (!REDUCED?.matches) schedule(SWAP_EVERY + 900); };

  // ----------------------------------------------------------------- the keys
  /* Through `slideSteps`, never bound on this root. Forward walks the ring
     once — every print has its turn in the middle — and is then spent, so the
     right arrow leaves the tab; back from the start leaves it the other way. A
     ring has no ends, so "spent" is counted rather than detected. */
  let steps = 0;
  registerStepper((delta) => {
    if (delta > 0) {
      if (steps >= SLOTS.length) return false;
      steps += 1;
      userMoved();
      stepForward();
      return true;
    }
    if (steps <= 0) return false;
    steps -= 1;
    userMoved();
    stepBack();
    return true;
  });
  root.addEventListener('pointerdown', () => {
    if (document.activeElement !== root) root.focus({ preventScroll: true });
  });

  // ----------------------------------------------------------------- the mark
  /* The Torii wordmark under the spread (2026-09-21, "in the down i want torii
     logo") — the same SVG the pane's head draws, so the deck says its own name
     one way. It stands in the one band the prints leave empty at the foot,
     under the middle: x 245–1040 at y 680–770, measured off the slots, and
     it is the only thing on the slide that is not a photograph. Arrives last,
     after the prints. */
  if (block.logo) {
    root.append(h('img', {
      class: 'sp-logo',
      src: upload(block.logo),
      alt: block.logoAlt || 'Torii',
      loading: 'eager',
      decoding: 'async',
      draggable: 'false',
    }));
  }

  // ---------------------------------------------------------------- arrival
  photos.forEach((_, i) => seat(i, false));
  /* The entrance is a class a frame after mount, so every animation on the
     slide begins from the state it was written in. */
  requestAnimationFrame(() => { if (root.isConnected) root.classList.add('is-in'); });
  schedule(FIRST_SWAP);

  return root;
}
