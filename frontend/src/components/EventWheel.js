import { h } from '../utils/dom.js';
import { upload } from '../utils/media.js';
import { openLightbox } from './Lightbox.js';
import { registerStepper } from '../utils/slideSteps.js';

/**
 * Events as a wheel of albums beside the open album.
 *
 * Built to a reference the user supplied: on the left the rightmost sweep of a
 * great ring — its centre well off the frame — whose rim *is* the photographs: a
 * continuous curved strip of tiles, each one an event's cover, each turned to
 * follow the arc, edge to edge. The event at the ring's rightmost point is the
 * one that is open: larger, lit, with its name and count on a card beside it.
 * On the right the open album runs down a column, each photograph at its own
 * ratio. The reference's ring of icons inside the wheel is left out on request,
 * and the room is Torii's light one, not the reference's dark.
 *
 * **The wheel has no ends.** The covers are the events repeated until there are
 * enough to fill the visible arc, and every tile is placed each frame from its
 * *wrapped* distance to the wheel's position — so turning past the last event
 * brings the first round again, in either direction, and the strip is never
 * seen to stop.
 *
 * Two things move, and both are one eased value in one rAF loop — the ribbon's
 * and the shelf's discipline, not a transition per element, because a wheel is
 * nothing but interruptions:
 *
 *   - `pos`, the wheel's position in tiles. Every tile is placed each frame at
 *     `wrap(i − pos) × STEP` radians around the ring's centre and rotated by
 *     that same angle, so the rim turns and the strip bends with it.
 *   - `colY`, how far the album has scrolled. A step is one photograph: the
 *     target is the next photograph's own top, never a fixed distance.
 *
 * The wheel steps on the wheel, the arrow keys (← →), the pill on the card and
 * a press on any tile. The album steps on the wheel over it, ↑ ↓, and its own
 * pill; a press on a photograph opens it whole in the shared viewer with the
 * rest of that event behind it. Both scroll both ways.
 */

const W = 1600;

/* The ring. Its centre stands off the left edge, so what is on screen is the
   rightmost sweep of a much larger wheel. */
const RING = { cx: -270, cy: 430, r: 640, band: 136 };
/* A tile on the rim: `r` runs along the radius, `t` along the tangent. Tiles
   stand edge to edge along the arc, so the step between them is their
   tangential size plus a seam, as an angle. */
const TILE = { r: 124, t: 96, seam: 6 };
const STEP = (TILE.t + TILE.seam) / RING.r;   // radians between neighbouring tiles
const LIT = 1.34;                             // the open tile, as a scale
const REACH = 7;                              // tiles drawn either side of the open one
const MIN_TILES = REACH * 2 + 1;              // enough to fill the visible arc

/* The open album's column, the card beside the wheel, the meta beside the album.
   The card ends before the album begins. */
const ALBUM = { x: 780, w: 520, gap: 14, pad: 84 };
const CARD = { x: 466, y: 430 };
const META = { x: 1332 };

/* Motion. */
const TAU = 0.16;                     // seconds to close ~63% of the distance
const WHEEL_THRESHOLD = 24;
/* Only has to outlast one notch's own burst — a smooth-scrolling mouse sends a
   dozen equal events per notch inside ~100ms. The inertia tail is caught by its
   shape, not by this; at 260 a mouse spun quickly lost every other notch. */
/* The slide plays itself. An event's photographs are walked one at a time, and
   when the last one has been seen the wheel turns to the next event and starts
   again — the order a presenter would use, without a hand on anything.

   The gaps are what make it watchable rather than a slideshow: long enough to
   look at a photograph, and a longer beat on the last one of an event so the
   turn of the wheel reads as the end of a chapter rather than as one more
   step. RESUME is what is owed to a presenter who has just moved it themselves,
   or has taken the pointer off it. */
const AUTO_FIRST = 2600;  // ms after the slide arrives before it starts
const AUTO_PHOTO = 1900;  // ms a photograph is held
const AUTO_EVENT = 2800;  // ms the last photograph of an event is held
const AUTO_RESUME = 2600; // ms of stillness owed after the presenter's own move

const REDUCED = typeof matchMedia === 'function'
  ? matchMedia('(prefers-reduced-motion: reduce)')
  : null;

const WHEEL_COOLDOWN = 120;
const WHEEL_QUIET = 120;              // ms of silence that ends a gesture

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const mod = (a, n) => ((a % n) + n) % n;

export function EventWheel(block = {}) {
  const groups = (block.groups || []).filter((g) => g && g.title && Array.isArray(g.images) && g.images.length);
  const root = h('section', { class: 'ew-root', tabindex: '0', 'aria-label': block.title || 'Events' });
  if (!groups.length) return root;

  const base = String(block.base || '').replace(/^\/+|\/+$/g, '');
  const urlOf = (src) => upload(base ? `${base}/${src}` : src);
  const n = groups.length;

  /* ------------------------------------------------------------ the ground */
  if (block.glow !== 'none') {
    root.append(h('div', { class: 'ew-glow', 'aria-hidden': 'true' },
      h('span', { class: 'ew-blob ew-blob--a' }),
      h('span', { class: 'ew-blob ew-blob--b' }),
      h('span', { class: 'ew-blob ew-blob--c' })));
  }

  // ------------------------------------------------------------------ the ring
  const wheel = h('div', { class: 'ew-wheel', 'aria-hidden': 'true' });
  const svgNS = 'http://www.w3.org/2000/svg';
  const band = document.createElementNS(svgNS, 'svg');
  band.setAttribute('class', 'ew-band');
  band.setAttribute('viewBox', `0 0 ${W} 900`);
  band.setAttribute('preserveAspectRatio', 'none');
  const ringEl = document.createElementNS(svgNS, 'circle');
  ringEl.setAttribute('cx', RING.cx); ringEl.setAttribute('cy', RING.cy); ringEl.setAttribute('r', RING.r);
  ringEl.setAttribute('class', 'ew-band__ring');
  ringEl.style.strokeWidth = `${RING.band}px`;
  band.append(ringEl);
  wheel.append(band);

  /* The tiles: the events, repeated until the arc is full, so the strip never
     shows an end. `items[k]` is the event a tile shows. */
  const laps = Math.max(1, Math.ceil(MIN_TILES / n));
  const items = [];
  for (let l = 0; l < laps; l++) for (let i = 0; i < n; i++) items.push(i);
  const N = items.length;

  const tiles = items.map((gi, k) => {
    const g = groups[gi];
    const el = h('button', {
      class: 'ew-tile',
      type: 'button',
      'aria-label': g.title,
      style: { width: `${TILE.r}px`, height: `${TILE.t}px` },
      onclick: () => turnTo(k),
    }, h('img', {
      src: urlOf(g.images[0].src),
      alt: '',
      draggable: 'false',
      loading: 'eager',
      decoding: 'async',
    }));
    wheel.append(el);
    return el;
  });
  root.append(wheel);

  /* The section's name, inside the ring — in the sliver of the disc the frame
     shows, set against the inner rim. Small and quiet: the wheel is the
     subject, this is its label. */
  root.append(h('div', { class: 'ew-title', style: { top: `${RING.cy}px`, width: `${Math.round(RING.cx + RING.r - RING.band / 2 - 46)}px` } },
    h('span', { class: 'ew-title__word', text: block.title || 'Events' }),
    h('span', { class: 'ew-title__sub', text: `${n} ${n === 1 ? 'event' : 'events'}` })));

  // ------------------------------------------------------------------ the card
  const cardName = h('p', { class: 'ew-card__name' });
  const cardCount = h('p', { class: 'ew-card__count' });
  const cardMeta = h('p', { class: 'ew-card__meta' });
  const prevEvent = h('button', { class: 'ew-pill__btn', type: 'button', 'aria-label': 'Previous event', onclick: () => step(-1) }, chevron('up'));
  const nextEvent = h('button', { class: 'ew-pill__btn', type: 'button', 'aria-label': 'Next event', onclick: () => step(1) }, chevron('down'));
  const card = h('div', { class: 'ew-card', style: { left: `${CARD.x}px`, top: `${CARD.y}px` } },
    h('span', { class: 'ew-card__lead', 'aria-hidden': 'true' }),
    h('div', { class: 'ew-card__body' },
      h('p', { class: 'ew-card__kicker', text: block.eyebrow || 'Event' }),
      cardName, cardMeta, cardCount,
      h('div', { class: 'ew-pill ew-pill--events' }, prevEvent, nextEvent)));
  root.append(card);

  // ----------------------------------------------------------------- the album
  const albumWrap = h('div', { class: 'ew-album', style: { left: `${ALBUM.x}px`, width: `${ALBUM.w}px` } });
  root.append(albumWrap);

  const metaName = h('p', { class: 'ew-meta__name' });
  const metaCount = h('p', { class: 'ew-meta__count' });
  const prevPhoto = h('button', { class: 'ew-pill__btn', type: 'button', 'aria-label': 'Previous photograph', onclick: () => stepPhoto(-1) }, chevron('up'));
  const nextPhoto = h('button', { class: 'ew-pill__btn', type: 'button', 'aria-label': 'Next photograph', onclick: () => stepPhoto(1) }, chevron('down'));
  /* No kicker here: the section's name is inside the ring now, and saying it
     twice on one slide is one time too many. */
  root.append(h('div', { class: 'ew-meta', style: { left: `${META.x}px` } },
    metaName, metaCount,
    h('div', { class: 'ew-pill ew-pill--photos' }, prevPhoto, nextPhoto)));

  // ----------------------------------------------------------------- state
  let posTarget = 0;        // the wheel's target, in tiles — unbounded, wrapped on use
  let pos = 0;              // its eased position
  let current = -1;         // the open event (an index into groups)
  let colY = 0;             // the album's eased scroll, in px
  let colTarget = 0;
  let photoIndex = 0;
  let column = null;
  let tops = [];
  let colHeight = 0;
  let raf = 0;
  let last = 0;

  /* The signed distance from the wheel's position to tile k, taken the short
     way round the ring — this is what makes the wheel endless. */
  const around = (k, at) => {
    let d = mod(k - at, N);
    if (d > N / 2) d -= N;
    return d;
  };

  function placeTiles() {
    tiles.forEach((el, k) => {
      const d = around(k, pos);
      const a = Math.abs(d);
      if (a > REACH + 0.5) { el.style.visibility = 'hidden'; return; }
      el.style.visibility = '';
      const theta = d * STEP;
      const x = RING.cx + RING.r * Math.cos(theta);
      const y = RING.cy + RING.r * Math.sin(theta);
      /* The open tile is large and lit; each step out is smaller and softer,
         and the fall-off is continuous so nothing pops while the wheel turns.
         Every tile turns by its own angle, so the strip bends with the rim. */
      const near = clamp(1 - a, 0, 1);
      const scale = 1 + (LIT - 1) * near;
      const dim = clamp(1 - (a - 0.5) * 0.11, 0.42, 1);
      el.style.transform = `translate3d(${(x - TILE.r / 2).toFixed(2)}px, ${(y - TILE.t / 2).toFixed(2)}px, 0) rotate(${(theta * 180 / Math.PI).toFixed(3)}deg) scale(${scale.toFixed(4)})`;
      el.style.opacity = dim.toFixed(3);
      el.style.zIndex = String(100 - Math.round(a * 4));
      el.classList.toggle('is-open', a < 0.5);
    });
  }

  function frame(ts) {
    raf = 0;
    /* A gap wider than a few frames is the loop restarting after a pause and is
       worth one nominal frame; anything else is real elapsed time. */
    const dt = last ? Math.min((ts - last) / 1000, 0.05) : 1 / 60;
    last = ts;
    const k = 1 - Math.exp(-dt / TAU);
    pos += (posTarget - pos) * k;
    if (Math.abs(posTarget - pos) < 0.0006) pos = posTarget;
    colY += (colTarget - colY) * k;
    if (Math.abs(colTarget - colY) < 0.4) colY = colTarget;
    placeTiles();
    if (column) column.style.transform = `translate3d(0, ${(-colY).toFixed(2)}px, 0)`;
    if (pos !== posTarget || colY !== colTarget) raf = requestAnimationFrame(frame);
    else last = 0;
  }
  const kick = () => { if (!raf) raf = requestAnimationFrame(frame); };

  // ----------------------------------------------------------------- events
  /** Turn the wheel so tile `k` is at the front, the short way round. */
  function turnTo(k) {
    userMoved();
    posTarget += around(k, posTarget);
    open(items[mod(Math.round(posTarget), N)]);
    kick();
  }
  function step(dir) {
    userMoved();
    posTarget += dir;
    open(items[mod(Math.round(posTarget), N)]);
    kick();
  }
  function open(gi) {
    if (gi === current) return;
    current = gi;
    const g = groups[gi];
    cardName.textContent = g.title;
    cardMeta.textContent = g.date || '';
    cardMeta.hidden = !g.date;
    cardCount.textContent = `${g.images.length} ${g.images.length === 1 ? 'photo' : 'photos'}`;
    metaName.textContent = g.title;
    /* The card's text is rebuilt so its entrance replays for the new event. */
    card.classList.remove('is-in');
    void card.offsetWidth;
    card.classList.add('is-in');
    buildAlbum(g);
  }

  // ------------------------------------------------------------------ album
  function buildAlbum(g) {
    const old = column;
    if (old) {
      old.classList.add('is-leaving');
      setTimeout(() => old.remove(), 260);
    }
    const viewer = g.images.map((im) => ({ url: urlOf(im.src), name: im.label || g.title }));
    const col = h('div', { class: 'ew-column' });
    tops = [];
    let y = 0;
    g.images.forEach((im, i) => {
      const ratio = im.w && im.h ? im.w / im.h : 1.5;
      const hgt = Math.round(ALBUM.w / ratio);
      tops.push(y);
      col.append(h('button', {
        class: 'ew-photo',
        type: 'button',
        'aria-label': `${g.title}, photograph ${i + 1} of ${g.images.length}`,
        style: { top: `${y}px`, height: `${hgt}px`, '--ew-n': String(Math.min(i, 8)) },
        onclick: () => openLightbox(viewer, i),
      }, h('img', {
        src: urlOf(im.src), alt: im.label || '', draggable: 'false',
        loading: i < 4 ? 'eager' : 'lazy', decoding: 'async',
      })));
      y += hgt + ALBUM.gap;
    });
    colHeight = y - ALBUM.gap;
    col.style.height = `${colHeight}px`;
    albumWrap.append(col);
    column = col;
    photoIndex = 0;
    colY = 0;
    colTarget = 0;
    col.style.transform = 'translate3d(0, 0, 0)';
    paintMeta();
  }
  function maxCol() {
    const viewport = root.clientHeight || 860;
    return Math.max(0, colHeight + ALBUM.pad * 2 - viewport);
  }
  function stepPhoto(dir) {
    userMoved();
    const count = groups[current].images.length;
    photoIndex = clamp(photoIndex + dir, 0, count - 1);
    /* One step is one photograph: land its top at the album's own padding. */
    colTarget = clamp(tops[photoIndex], 0, maxCol());
    paintMeta();
    kick();
  }
  function paintMeta() {
    const count = groups[current].images.length;
    metaCount.textContent = `${photoIndex + 1} / ${count}`;
    prevPhoto.disabled = photoIndex === 0;
    nextPhoto.disabled = photoIndex >= count - 1;
  }

  // --------------------------------------------------------------- the wheel
  /* One gesture is one step. A mouse wheel sends one event per notch, each the
     same size; a trackpad sends a burst and then an inertia tail — dozens of
     events, each smaller than the last, that can run on for a second. No fixed
     cooldown fits both: long enough for the tail and a mouse cannot step
     quickly; short enough for a mouse and the tail steps twice (it did, at 380
     and at 480). So the tail is recognised by its shape instead. After a step
     the gate is disarmed, and it re-arms only on a *fresh* event: one after a
     quiet gap, or one at least as large as the event before it — a new notch or
     a new push, never the decay of the last one. */
  const gate = (fn) => {
    let acc = 0;
    let lock = 0;
    let lastAt = 0;
    let lastMag = 0;
    let armed = true;
    return (event) => {
      event.preventDefault();
      const now = performance.now();
      const delta = Math.abs(event.deltaY) >= Math.abs(event.deltaX) ? event.deltaY : event.deltaX;
      const mag = Math.abs(delta);
      const fresh = now - lastAt > WHEEL_QUIET || mag >= lastMag - 0.5;
      lastAt = now;
      lastMag = mag;
      if (fresh) armed = true;
      if (!armed || now - lock < WHEEL_COOLDOWN) { acc = 0; return; }
      if (Math.sign(delta) !== Math.sign(acc)) acc = 0;
      acc += delta;
      if (Math.abs(acc) < WHEEL_THRESHOLD) return;
      acc = 0;
      lock = now;
      armed = false;
      fn(delta > 0 ? 1 : -1);
    };
  };
  const albumWheel = gate(stepPhoto);
  albumWrap.addEventListener('wheel', (event) => { event.stopPropagation(); albumWheel(event); }, { passive: false });
  root.addEventListener('wheel', gate(step), { passive: false });

  root.addEventListener('pointerdown', () => root.focus({ preventScroll: true }));
  /* The arrows are not bound here (2026-09-18). Up and down used to walk the
     open album's photographs; they change tab now, which is the deck's own
     gesture, and the album is still scrolled by the wheel over it. Left and
     right turn the wheel through a stepper, so the tab can be left once every
     event has been round.

     THE WHEEL HAS NO ENDS on purpose — one step back from the first event is
     the last — so being spent is a count rather than a position: one lap of
     the events from wherever the slide was entered. */
  let turned = 0;
  registerStepper((delta) => {
    /* The EVENTS, not the tiles. `N` counts the strip, which repeats the
       events until there are enough to fill the visible arc — so using it
       would take two laps of a ten-event wheel to leave the tab. */
    const lap = Math.max(1, groups.length);
    const next = turned + delta;
    /* Entered at the first event; back from there leaves the tab, forward is
       spent after one lap. The same rule as every row with real ends. */
    if (next > lap - 1 || next < 0) return false;
    turned = next;
    step(delta);
    return true;
  });

  /* ------------------------------------------------------------- autoplay */
  /* Every way of moving this slide goes through `step`, `stepPhoto` or
     `turnTo`, so marking those is the whole of "the presenter did something" —
     the pills, the wheel, a tile, the deck's arrow keys, and anything added
     later, without a list to keep in step. `driving` is how the autoplay's own
     moves are told from a hand's: it would otherwise push its own schedule back
     on every tick and never advance. */
  let hovered = false;
  let timer = 0;
  let driving = false;

  const canAuto = () => root.isConnected && !hovered && !REDUCED?.matches;
  const stop = () => { if (timer) { clearTimeout(timer); timer = 0; } };
  const after = (ms) => {
    stop();
    if (hovered || REDUCED?.matches) return;
    timer = setTimeout(tick, ms);
  };
  /* `isConnected` is checked when the timer FIRES, never when it is set. The
     first schedule is made while this component is still being built, before
     the caller has appended it — so testing it here dropped the opening chain
     on the floor and the slide sat on photograph 1 for as long as nobody
     touched it. Checked at fire time it still does the job it is there for:
     the deck rebuilds its DOM on every navigation, and a chain left running
     would otherwise go on turning a wheel that is no longer on screen. */
  /* A longer beat on an event's last photograph: the wheel turning next is the
     end of a chapter, not one more step. */
  const gap = () => (photoIndex >= groups[current].images.length - 1 ? AUTO_EVENT : AUTO_PHOTO);

  function tick() {
    timer = 0;
    if (!canAuto()) return;
    driving = true;
    /* `step` opens the next event, which rebuilds the album at its first
       photograph — so one branch walks within an event and the other moves on,
       and nothing has to remember which of the two it is doing. */
    if (photoIndex < groups[current].images.length - 1) stepPhoto(1);
    else step(1);
    driving = false;
    after(gap());
  }

  function userMoved() {
    if (driving) return;
    /* Whatever they have just chosen is what stays on screen, and the autoplay
       picks up from there rather than from where it had got to — `tick` reads
       `current` and `photoIndex` live, so there is nothing to reset. */
    after(AUTO_RESUME);
  }

  /* The pointer anywhere over the slide holds it — the ring and the album are
     one thing to look at, and a presenter who has moved to the album to talk
     about a photograph has not stopped using the ring.

     Deliberately NOT focusin/focusout: `pointerdown` focuses the root, so after
     any click the root holds focus and `focusout` would not fire until focus
     left the slide entirely — the autoplay would stop for good on the first
     press. The keyboard is covered by `userMoved` instead, since the deck's
     arrow keys reach this slide through `step`. */
  root.addEventListener('pointerenter', () => { hovered = true; stop(); });
  root.addEventListener('pointerleave', () => { hovered = false; after(AUTO_RESUME); });

  open(0);
  placeTiles();
  after(AUTO_FIRST);
  return root;
}

function chevron(dir) {
  const svgNS = 'http://www.w3.org/2000/svg';
  const s = document.createElementNS(svgNS, 'svg');
  s.setAttribute('viewBox', '0 0 24 24');
  s.setAttribute('class', 'ew-chev');
  s.setAttribute('aria-hidden', 'true');
  s.style.transform = `rotate(${{ up: 180, down: 0, left: 90, right: -90 }[dir] || 0}deg)`;
  const p = document.createElementNS(svgNS, 'path');
  p.setAttribute('d', 'M6 9l6 6 6-6');
  p.setAttribute('fill', 'none');
  p.setAttribute('stroke', 'currentColor');
  p.setAttribute('stroke-width', '2');
  p.setAttribute('stroke-linecap', 'round');
  p.setAttribute('stroke-linejoin', 'round');
  s.append(p);
  return s;
}
