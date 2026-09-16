import { h } from '../utils/dom.js';
import { icon } from '../utils/icons.js';
import { upload } from '../utils/media.js';
import { PlacementWall } from './PlacementWall.js';

/**
 * The campus, as a tilted wall of drifting photographs — and, behind one
 * button, the whole set filed and filterable.
 *
 * Two states in one slide. It opens on the wall: columns of photographs leaning
 * across the frame, adjacent columns drifting in opposite directions, with the
 * section's name and one button held still in the middle of it. Press the
 * button and the wall steps back and the filtered gallery takes the slide;
 * press Back and the wall returns, still moving.
 *
 * Ported from the reactbits Pro `TiltedTiles` sketch. What changed, and why:
 *
 *   - React, shadcn and Tailwind are gone, for the third time and the same
 *     reason: the deck ships no runtime dependencies, has no build step and no
 *     network at presentation time, so `npx shadcn add` has nothing to add to.
 *   - The sketch drives the drift off the page's scroll position. A slide does
 *     not scroll, so the wall carries its own offset: it drifts on its own and
 *     the wheel pushes it, with the momentum running out on its own.
 *   - Its columns are equal-height tiles. These photographs run from 0.9 to 2.3
 *     in aspect and most of them are small, so a fixed tile would crop
 *     somebody's canteen or stretch a hostel. The column fixes the *width* and
 *     every tile's height is its own ratio times that — the same rule the
 *     justified gallery follows, and the reason nothing on this slide is ever
 *     cropped.
 *
 * The gallery is not a second implementation of anything: it is
 * `PlacementWall`, the deck's justified photo wall, handed a block built out of
 * this one's own groups. Rows that never crop, chips built from the group
 * names, a stage that scrolls — all of it already solved, and solved once.
 */

/* The wall's geometry. The grid is rotated, so it has to be larger than the
   frame it is rotated inside — at 14 degrees a 1600x860 box needs about 1.45x
   to keep its corners off screen. */
const TILT = -14;        // degrees
const COVER = 1.55;
const COL_W = 300;       // px, the width every tile in a column takes
const GAP = 22;

/* The drift. Columns alternate direction and vary in speed, which is what stops
   the wall reading as one sheet sliding past. */
const BASE_SPEED = 13;   // px per second, the slowest column
const SPREAD = 7;        // px per second between one column and the next
const WHEEL_GAIN = 0.55;
const FRICTION = 0.92;   // per frame at 60fps, applied against real elapsed time

const REDUCED = window.matchMedia?.('(prefers-reduced-motion: reduce)');

export function TiltedTiles(block = {}, options = {}) {
  const tiles = (block.tiles || []).filter((t) => t && t.src);
  const root = h('section', { class: 'tt-root' });
  if (!tiles.length) return root;

  const base = String(block.base || 'Infrastructure').replace(/^\/+|\/+$/g, '');

  // ------------------------------------------------------------------ the wall
  const wall = h('div', { class: 'tt-wall', 'aria-hidden': 'true' });

  /* Enough columns to cross the rotated frame, and every column the same width
     so the wall reads as a grid rather than as a set of ribbons. */
  const cols = Math.max(4, Math.ceil((1600 * COVER) / (COL_W + GAP)));
  const columns = [];
  for (let c = 0; c < cols; c++) {
    const track = h('div', { class: 'tt-col__track' });
    const col = h('div', { class: 'tt-col' }, track);
    columns.push({ col, track, speed: BASE_SPEED + (c % 4) * SPREAD, dir: c % 2 ? 1 : -1, height: 0 });
    wall.append(col);
  }

  /* Each column is filled until its run is taller than the frame it has to
     cross, then that run is drawn twice and wrapped on its own height. The run
     has to clear the frame or the second copy arrives late and the column shows
     a gap at the turn — forty-six photographs over eight columns is under six
     each, which is a run about 1,100px tall against a rotated frame of nearly
     1,400. So the list is walked round, each column starting at a different
     point in it: a photograph appears twice on the wall, never twice in a
     column, and never beside itself.
     The wall is a backdrop; the gallery behind the button is where every
     photograph is shown once and in its own group. */
  const RUN = 1700;
  let n = 0;
  columns.forEach((c, ci) => {
    let run = 0;
    let i = ci * 3;                       // a different starting point per column
    while (run < RUN && n < 400) {
      const tile = tiles[((i % tiles.length) + tiles.length) % tiles.length];
      const node = tileNode(tile, n);
      c.track.append(node);
      run += Math.round(COL_W / ratioOf(tile)) + GAP;
      i += 1;
      n += 1;
    }
  });
  /* The second copy. The wrap is a modulo of one run's height, so it is always
     covering the gap the first one leaves as it climbs out of frame — there is
     no seam to hide. */
  columns.forEach((c) => {
    [...c.track.children].forEach((node) => c.track.append(node.cloneNode(true)));
  });

  function ratioOf(tile) {
    return tile.w && tile.h ? tile.w / tile.h : 1.5;
  }

  function tileNode(tile, i) {
    const ratio = ratioOf(tile);
    return h(
      'figure',
      { class: 'tt-tile', style: { height: `${Math.round(COL_W / ratio)}px` } },
      h('img', {
        src: upload(`${base}/${tile.src}`),
        alt: '',
        draggable: 'false',
        loading: i < 12 ? 'eager' : 'lazy',
        decoding: 'async',
        onerror: (event) => event.currentTarget.closest('.tt-tile')?.remove(),
      }),
    );
  }

  root.append(wall);
  root.append(h('div', { class: 'tt-veil', 'aria-hidden': 'true' }));

  // ---------------------------------------------------------------- the middle
  const cta = h(
    'button',
    { class: 'tt-cta', type: 'button', onclick: () => show(true) },
    h('span', { class: 'tt-cta__text' }, block.ctaLabel || 'See the infrastructure'),
    icon('arrow-right', { class: 'ic' }),
  );
  const centre = h(
    'div',
    { class: 'tt-centre' },
    block.eyebrow ? h('p', { class: 'tt-eyebrow', text: block.eyebrow }) : null,
    block.title ? h('h2', { class: 'tt-title', text: block.title }) : null,
    block.lead ? h('p', { class: 'tt-lead', text: block.lead }) : null,
    cta,
  );
  root.append(centre);

  // --------------------------------------------------------------- the gallery
  /* Built on first press, not up front: it lays out forty-six photographs and
     mounts a lightbox, and a presenter who never opens it should not pay for
     any of that. */
  let gallery = null;
  function buildGallery() {
    const inner = PlacementWall({
      type: 'placement-wall',
      base,
      allLabel: block.allLabel || 'All facilities',
      eyebrow: block.eyebrow,
      title: block.title,
      lead: '',
      chapters: [{
        key: 'facilities',
        name: block.title || 'Infrastructure',
        blurb: '',
        kind: 'photo',
        icon: 'building',
        groups: block.groups || [],
      }],
    }, options);
    return h(
      'div',
      { class: 'tt-gallery' },
      h('button', {
        class: 'tt-back',
        type: 'button',
        onclick: () => show(false),
      }, icon('chevron-left', { class: 'ic' }), h('span', {}, block.backLabel || 'Back to the campus')),
      inner,
    );
  }

  let open = false;
  function show(next) {
    if (next === open) return;
    open = next;
    if (open && !gallery) {
      gallery = buildGallery();
      root.append(gallery);
    }
    root.classList.toggle('is-open', open);
    /* Nothing behind the gallery may be reached by tab or by a pointer, and
       nothing in front of the wall may be either. */
    centre.inert = open;
    if (gallery) gallery.inert = !open;
    if (open) stop(); else start();
  }

  // ----------------------------------------------------------------- the drift
  let t = 0;          // seconds of drift accumulated
  let push = 0;       // px/s of extra travel from the wheel, decaying
  let raf = 0;
  let last = 0;

  function paint() {
    columns.forEach((c) => {
      if (!c.height) return;
      const y = (((t * c.speed + push * 0.001) * c.dir) % c.height + c.height) % c.height;
      c.track.style.transform = `translate3d(0, ${-y.toFixed(1)}px, 0)`;
    });
  }

  function frame(now) {
    raf = 0;
    const gap = last ? now - last : 0;
    const dt = gap > 0 && gap < 200 ? Math.min(0.05, gap / 1000) : 0.016;
    last = now;
    t += dt;
    if (push) {
      t += (push * dt) / 1000;
      push *= FRICTION ** (dt * 60);
      if (Math.abs(push) < 1) push = 0;
    }
    paint();
    raf = requestAnimationFrame(frame);
  }

  function start() {
    if (raf || REDUCED?.matches) return;
    last = 0;
    raf = requestAnimationFrame(frame);
  }
  function stop() {
    if (raf) cancelAnimationFrame(raf);
    raf = 0;
  }

  root.addEventListener('wheel', (event) => {
    if (open) return;          // the gallery scrolls itself
    if (!event.deltaY) return;
    // The deck does not scroll; without this a flick drags the page behind it.
    event.preventDefault();
    push += event.deltaY * WHEEL_GAIN * 40;
    push = Math.max(-9000, Math.min(9000, push));
    start();
  }, { passive: false });

  /* One run's height per column, measured once the images have a box. Until it
     is known the wrap has nothing to wrap against, so the wall simply sits
     still rather than jumping when the first measurement lands. */
  function measure() {
    columns.forEach((c) => {
      const kids = [...c.track.children];
      const half = kids.slice(0, kids.length / 2);
      c.height = half.reduce((n, el) => n + el.offsetHeight + GAP, 0);
    });
    paint();
  }

  requestAnimationFrame(() => {
    measure();
    start();
    if (typeof ResizeObserver === 'function') new ResizeObserver(measure).observe(root);
  });

  /* The loop outlives the slide otherwise: the router replaces the whole page
     on every navigation and nothing here would ever be told. */
  const watcher = new MutationObserver(() => {
    if (!root.isConnected) { stop(); watcher.disconnect(); }
  });
  watcher.observe(document.body, { childList: true, subtree: true });

  return root;
}
