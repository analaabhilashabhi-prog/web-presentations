import { h } from '../utils/dom.js';
import { media } from '../utils/media.js';
import { openLightbox } from './Lightbox.js';

/**
 * The events as a ring you can turn with your hand.
 *
 * Built to a reference the user supplied: panels standing in a dark space at
 * every angle, seen in perspective, the near ones large and the far ones edge
 * on. One card is one event; taking hold of the ring and dragging turns it, and
 * letting go lets it carry on and settle. Clicking a card opens that event's
 * photographs.
 *
 * A closed ring, unlike the fan on Beyond. There the set was four pictures and a
 * full circle put both neighbours edge-on; here there are ten events, which is
 * enough to close the circle and have every card sit at a readable angle to the
 * next. The radius is solved from the card width and the count rather than
 * fixed, so adding an eleventh event widens the ring instead of overlapping the
 * cards into each other.
 *
 * Two axes, because the reference is not a flat carousel: dragging across turns
 * the ring, dragging up and down tips it, and the tip is clamped well short of
 * the poles — past about 35° you are looking at the top edges of ten cards,
 * which is a cylinder seen from above and not a gallery.
 *
 * Motion is one `requestAnimationFrame` loop over two numbers, `spin` and
 * `tilt`, rather than transitions: a drag, the throw that follows it and the
 * idle drift are the same value being integrated, so they cannot fight each
 * other the way a transition fights a script that is also writing `transform`.
 */

const REDUCED = window.matchMedia?.('(prefers-reduced-motion: reduce)');

/* With the far half not drawn, only the front arc occupies width: the widest
   cards sit at a quarter turn, where they are at z=0 and so unscaled. That is
   what lets the card be this size without the outermost pair reaching the
   section's edges. */
const CARD_W = 300;
const CARD_H = 190;
/* Opened out past touching, so neighbours overlap slightly at rest rather than
   meeting exactly — the reference has them overlapping. */
const GAP = 1.16;
/* Degrees per second the ring drifts when nobody is touching it. Slow: this is
   a presentation, and a ring that whips round reads as a screensaver. */
const IDLE_SPIN = 4.2;
/* How much of its speed a thrown ring keeps each frame, and the speed below
   which it is treated as stopped and the idle drift takes back over. */
const FRICTION = 0.94;
const STILL = 2;
const TILT_LIMIT = 35;
/* Past this many pixels a press is a drag, and the click that would follow it is
   swallowed — otherwise turning the ring opens whatever card you started on. */
const DRAG_SLOP = 6;

function radiusFor(count) {
  if (count < 2) return 0;
  return (CARD_W * GAP) / (2 * Math.tan(Math.PI / count));
}

export function EventOrbit(block, { editing = false } = {}) {
  const groups = (Array.isArray(block.groups) ? block.groups : [])
    .filter((g) => g?.title && Array.isArray(g.images) && g.images.length);

  const root = h('div', { class: 'eo-root ph-root' });

  if (!groups.length) {
    root.appendChild(h('div', { class: 'eo-empty' },
      h('h2', { class: 'eo-title' }, block.title || 'Events'),
      editing ? h('p', { class: 'eo-hint' }, 'Add events with their photographs to this block.') : null,
    ));
    return root;
  }

  const base = String(block.base || '').replace(/^\/+|\/+$/g, '');
  const srcFor = (s) => media(
    `/uploads/${[base, s].filter(Boolean).join('/').split('/').map(encodeURIComponent).join('/')}`,
  );

  const count = groups.length;
  const step = 360 / count;
  const radius = Math.round(radiusFor(count));

  /* ------------------------------------------------------------------ cards */
  const ring = h('div', { class: 'eo-ring' });

  const cards = groups.map((g, i) => {
    const poster = g.images[0];
    const card = h('button', {
      class: 'eo-card', type: 'button',
      style: { transform: `rotateY(${i * step}deg) translateZ(${radius}px)` },
      'aria-label': `${g.title}, ${g.images.length} photograph${g.images.length === 1 ? '' : 's'}`,
      onclick: (e) => {
        /* Swallowed after a drag — see DRAG_SLOP. */
        if (dragged) { e.preventDefault(); e.stopPropagation(); return; }
        openLightbox(
          g.images.map((im) => ({ url: srcFor(im.src), name: im.label || g.title })),
          0,
        );
      },
    },
      h('span', { class: 'eo-card__shot' },
        h('img', {
          class: 'eo-card__img', src: srcFor(poster.src), alt: '',
          loading: i < 6 ? 'eager' : 'lazy', decoding: 'async', draggable: 'false',
        }),
      ),
      h('span', { class: 'eo-card__foot' },
        h('span', { class: 'eo-card__name' }, g.title),
        h('span', { class: 'eo-card__n' }, String(g.images.length)),
      ),
    );
    ring.appendChild(card);
    return card;
  });

  const stage = h('div', { class: 'eo-stage' }, ring);

  /* ------------------------------------------------------------------ motion */
  let spin = 0;          // degrees around the vertical axis
  let tilt = 0;          // degrees tipped; the drag sets it from here
  let velocity = 0;      // degrees per second, left over from a throw
  let dragging = false;
  let dragged = false;   // did this press travel far enough to be a drag
  let captured = 0;      // pointerId the stage has captured, 0 for none
  let hovering = false;  // pointer is over the ring
  let lastX = 0, lastY = 0, startX = 0, startY = 0, lastT = 0;
  let raf = null;

  function paint() {
    ring.style.transform = `rotateX(${tilt.toFixed(2)}deg) rotateY(${spin.toFixed(2)}deg)`;
    /* A card facing away is dimmed and taken out of the tab order and the hit
       testing, so the ring cannot be operated through its own back. */
    cards.forEach((card, i) => {
      const facing = ((i * step + spin) % 360 + 360) % 360;
      const away = Math.min(facing, 360 - facing) / 180;   // 0 front, 1 behind
      card.style.setProperty('--away', away.toFixed(3));
      const behind = away > 0.62;
      card.style.pointerEvents = behind ? 'none' : 'auto';
      card.tabIndex = behind ? -1 : 0;
    });
  }

  let prev = 0;
  function frame(now) {
    const dt = prev ? Math.min((now - prev) / 1000, 0.05) : 0;
    prev = now;
    if (!dragging) {
      if (Math.abs(velocity) > STILL) {
        spin += velocity * dt;
        velocity *= Math.pow(FRICTION, dt * 60);
        paint();
      } else if (!hovering) {
        /* The idle drift stops while the pointer is over the ring. A card that
           is still sliding is a moving target: you aim at it, it is no longer
           there, and the click lands on its neighbour or on nothing. Holding
           still under the hand is what makes the ring clickable rather than
           merely animated. A throw still runs to a stop, because that motion
           was asked for. */
        velocity = 0;
        spin += IDLE_SPIN * dt;
        paint();
      }
    }
    raf = requestAnimationFrame(frame);
  }

  /* ------------------------------------------------------------------- drag */
  stage.addEventListener('pointerenter', () => { hovering = true; });
  stage.addEventListener('pointerleave', () => { hovering = false; });

  stage.addEventListener('pointerdown', (e) => {
    dragging = true;
    dragged = false;
    velocity = 0;
    startX = lastX = e.clientX;
    startY = lastY = e.clientY;
    lastT = performance.now();
    /* Deliberately NOT capturing the pointer here.
     *
     * Capturing on press retargets everything that follows to the stage —
     * including the `click` the browser synthesises on release. The card's own
     * handler then never runs, and the ring can only be opened from the
     * keyboard, where activation never goes through a pointer at all. Capture
     * is taken later, the moment a press turns out to be a drag, which is the
     * only time it is needed: to keep receiving moves if the pointer leaves the
     * stage mid-turn. A press that never travels stays uncaptured and its click
     * lands on the card, which is the whole point of the card. */
    stage.classList.add('is-held');
  });

  stage.addEventListener('pointermove', (e) => {
    if (!dragging) return;
    const dx = e.clientX - lastX;
    const dy = e.clientY - lastY;
    const now = performance.now();
    const dt = Math.max((now - lastT) / 1000, 1 / 240);

    spin += dx * 0.28;
    /* Dragging down tips the top toward you, which is the direction the hand
       expects when it is pulling the near edge of a turntable downward. */
    tilt = Math.max(-TILT_LIMIT, Math.min(TILT_LIMIT, tilt + dy * 0.12));
    velocity = (dx * 0.28) / dt;

    if (!dragged
      && (Math.abs(e.clientX - startX) > DRAG_SLOP || Math.abs(e.clientY - startY) > DRAG_SLOP)) {
      dragged = true;
      /* Now it is a drag, so take the pointer: the turn must carry on even if
         the hand runs off the edge of the stage. Taking it here rather than on
         press is what leaves a plain click free to reach its card. */
      try { stage.setPointerCapture(e.pointerId); captured = e.pointerId; } catch { /* not capturable */ }
    }
    lastX = e.clientX; lastY = e.clientY; lastT = now;
    paint();
  });

  const release = (e) => {
    if (!dragging) return;
    dragging = false;
    if (captured) {
      try { stage.releasePointerCapture(captured); } catch { /* already gone */ }
      captured = 0;
    }
    stage.classList.remove('is-held');
    /* The click that follows this press has not fired yet. Clearing the flag on
       the next frame lets the card's own handler see it first. */
    if (dragged) requestAnimationFrame(() => requestAnimationFrame(() => { dragged = false; }));
  };
  stage.addEventListener('pointerup', release);
  stage.addEventListener('pointercancel', release);

  /* Keyboard reaches the same two axes, so the ring is not pointer-only. */
  stage.addEventListener('keydown', (e) => {
    const k = e.key;
    if (k === 'ArrowLeft' || k === 'ArrowRight') {
      e.preventDefault(); e.stopPropagation();
      spin += (k === 'ArrowLeft' ? -1 : 1) * step;
      velocity = 0; paint();
    }
    if (k === 'ArrowUp' || k === 'ArrowDown') {
      e.preventDefault(); e.stopPropagation();
      tilt = Math.max(-TILT_LIMIT, Math.min(TILT_LIMIT, tilt + (k === 'ArrowUp' ? -6 : 6)));
      paint();
    }
  });

  /* ------------------------------------------------------------------- frame */
  /* No head at all: no title, no instruction line. The section is the ring and
     nothing else. `event-orbit` is listed among the block types that take the
     slide full-bleed in SlideView, so the deck does not print the section's name
     above it either — the page would otherwise be titled twice. All of that
     height goes to the ring. */
  root.appendChild(stage);

  ring.style.setProperty('--radius', `${radius}px`);
  paint();
  if (!REDUCED?.matches) raf = requestAnimationFrame(frame);

  /* The loop outlives the slide unless it is taken down by hand — a section that
     has been navigated away from must not keep a frame callback alive nor hold a
     reference to its nodes. */
  const watch = new MutationObserver(() => {
    if (!root.isConnected) {
      if (raf) cancelAnimationFrame(raf);
      raf = null;
      watch.disconnect();
    }
  });
  watch.observe(document.body, { childList: true, subtree: true });

  return root;
}
