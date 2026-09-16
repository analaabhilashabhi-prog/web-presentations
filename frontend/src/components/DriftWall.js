import { h } from '../utils/dom.js';
import { icon } from '../utils/icons.js';

/**
 * A wall of tiles drifting up and down a tilted 3D plane, with the title
 * punched through the middle of it.
 *
 * Ported from the React/DriftWall component. What had to change:
 *
 *   - Tiles take an `assetId`, not `/images/<name>.jpg`. A literal path is
 *     resolved against whoever serves the page, so the wall would be full on
 *     the machine that authored it and empty for everyone opening the deployed
 *     link. Ids resolve server-side to real upload URLs.
 *   - `lucide-react` and the Google Fonts @import are gone; nothing is fetched
 *     at presentation time, so the deck still renders with no network.
 *   - The interleave groups by `category`, not by `tag`. Round-robin over the
 *     captions makes a bucket of one out of every "Placed at Cognizant" and
 *     "Placed at TCS" and emits them consecutively — the clumping it exists to
 *     prevent. `category` is the coarse field the same data already carries.
 *   - The animation frame is cancelled when the wall leaves the document. The
 *     deck rebuilds its DOM on every navigation, so a loop that only stopped on
 *     unmount would leave one running per slide visited.
 */

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

const reducedMotion = () =>
  window.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true;

/** Deterministic per-column speed spread — same wall on every machine. */
const columnFactor = (index, variance) => {
  const pseudo = ((index * 0.6180339887 + 0.35) % 1) * 2 - 1;
  return 1 + variance * pseudo;
};

/** Round-robin by category so one subject never stacks up a column. */
function interleave(items) {
  const groups = new Map();
  for (const item of items) {
    const key = item.category || item.tag || '—';
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(item);
  }
  const queues = [...groups.values()];
  const out = [];
  while (out.length < items.length) {
    let moved = false;
    for (const q of queues) if (q.length) { out.push(q.shift()); moved = true; }
    if (!moved) break;
  }
  return out;
}

/* ------------------------------------------------------------------ lightbox */
function openLightbox(item) {
  const close = () => {
    document.removeEventListener('keydown', onKey);
    backdrop.remove();
  };
  const onKey = (event) => { if (event.key === 'Escape') { event.stopPropagation(); close(); } };

  const card = h('div', { class: 'dw-modal__card', onclick: (e) => e.stopPropagation() },
    h('button', { class: 'dw-modal__close', type: 'button', 'aria-label': 'Close', onclick: close },
      icon('close', { class: 'ic ic--sm' })),
    h('div', { class: 'dw-modal__media' },
      h('img', { src: item.src, alt: item.title || item.tag || '' })),
    h('div', { class: 'dw-modal__meta' },
      h('span', { class: 'dw-modal__tag' }, item.category || 'Technical Hub'),
      h('h3', { class: 'dw-modal__title' }, item.title || item.tag || ''),
    ),
  );

  const backdrop = h('div', {
    class: 'dw-modal', role: 'dialog', 'aria-modal': 'true', onclick: close,
  }, card);

  document.addEventListener('keydown', onKey);
  document.body.appendChild(backdrop);
  requestAnimationFrame(() => backdrop.classList.add('is-in'));
}

export function DriftWall(block, { editing = false } = {}) {
  const source = (block.items || []).filter((i) => i.asset?.url);
  if (!source.length) {
    return h('div', { class: 'dw-root dw-root--empty ph-root' }, 'No images placed yet.');
  }

  const items = interleave(source.map((i) => ({
    src: i.asset.url, title: i.title || '', tag: i.tag || '', category: i.category || '',
  })));

  const columns = clamp(Number(block.columns) || 8, 2, 14);
  const tileW = clamp(Number(block.tileWidth) || 230, 80, 480);
  const tileH = clamp(Number(block.tileHeight) || 150, 60, 400);
  const gap = clamp(Number(block.gap) || 18, 0, 60);
  const speed = clamp(Number(block.speed) || 42, 0, 200);
  const variance = clamp(Number(block.variance) ?? 0.35, 0, 1);
  const parallax = clamp(Number(block.parallax) ?? 0.4, 0, 2);
  const tilt = clamp(Number(block.tilt) ?? 4, -30, 30);
  const depth = clamp(Number(block.depth) ?? 90, 0, 600);

  const reduced = reducedMotion();

  /* --------------------------------------------------------- the columns */
  const buckets = Array.from({ length: columns }, () => []);
  items.forEach((item, i) => buckets[i % columns].push(item));

  const plane = h('div', { class: 'dw-plane' });
  const tracks = [];
  const meta = [];
  const unit = tileH + gap;

  buckets.forEach((bucket, c) => {
    const base = bucket.length ? bucket : items;
    // Enough copies that a column is never seen to end while it scrolls. This
    // first estimate assumes a uniform tile; the real height is measured once
    // the pictures have decoded, because each tile is now as tall as its own
    // photograph.
    const copyHeight = Math.max(unit, base.length * unit);
    const copies = Math.max(3, Math.ceil((900 * 2.2) / copyHeight) + 2);
    meta.push({ copyHeight, copies });

    const track = h('div', { class: 'dw-track' });
    for (let copy = 0; copy < copies; copy++) {
      for (const item of base) {
        const image = h('img', {
          src: item.src, alt: item.title || item.tag || '',
          loading: 'lazy', decoding: 'async', draggable: 'false',
        });
        const tile = h('div', {
          class: 'dw-tile', tabindex: '0', role: 'button',
          'aria-label': item.title || item.tag || 'Image',
          onclick: () => openLightbox(item),
          onkeydown: (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openLightbox(item); } },
          onpointerenter: () => { hoveredCol = c; },
          onfocus: () => { hoveredCol = c; },
          onblur: () => { hoveredCol = -1; },
        },
          h('span', { class: 'dw-tile__inner' },
            image,
            h('span', { class: 'dw-tile__scrim', 'aria-hidden': 'true' }),
            item.tag || item.title
              ? h('span', { class: 'dw-pill' },
                  h('span', { class: 'dw-pill__rule' }),
                  h('span', { class: 'dw-pill__text' }, item.tag || item.title))
              : null,
          ),
        );
        // A file that will not load must not leave a hole drifting up the wall.
        image.addEventListener('error', () => tile.remove(), { once: true });
        track.appendChild(tile);
      }
    }
    tracks.push(track);
    plane.appendChild(h('div', { class: 'dw-col' }, track));
  });

  /* ------------------------------------------------------------ the motion */
  let hoveredCol = -1;
  let wallHovered = false;
  const offsets = meta.map((m, c) => m.copyHeight * ((c * 0.37) % 1));
  const velocities = meta.map(() => 0);
  const baseVelocity = meta.map((_, c) =>
    speed * columnFactor(c, variance) * (c % 2 === 0 ? 1 : -1));

  const pointer = { x: 0, y: 0 };
  const damped = { x: 0, y: 0 };
  let raf = null;
  let last = null;

  /**
   * Re-reads how tall one repeat of a column actually is.
   *
   * Tiles are sized by their own pictures now, so the loop length cannot be
   * calculated from a nominal tile height — it has to be measured. Every copy
   * in a track holds the same items, so one repeat is the track's content
   * height divided by the number of copies. The current offset is folded back
   * into the new length so re-measuring never makes the column jump.
   */
  const remeasure = () => {
    for (let c = 0; c < tracks.length; c++) {
      const height = tracks[c].scrollHeight / meta[c].copies;
      if (!(height > 10)) continue; // nothing decoded yet
      meta[c].copyHeight = height;
      offsets[c] = ((offsets[c] % height) + height) % height;
    }
  };

  const applyPlane = (px, py) => {
    plane.style.transform = `translate(-50%, -50%) scale(1.15) `
      + `rotateX(${tilt + py}deg) rotateY(${px}deg) translateZ(${-depth}px)`;
  };

  const frame = (ts) => {
    // The deck rebuilds its DOM on every navigation. Without this the loop
    // would outlive the wall it drives, once per slide visited.
    if (!root.isConnected) { raf = null; return; }

    if (last === null) last = ts;
    const dt = Math.min(0.05, Math.max(0, ts - last) / 1000);
    last = ts;

    if (parallax > 0 && !reduced) {
      const maxTilt = parallax * 8;
      const damp = 1 - Math.exp(-dt / 0.12);
      damped.x += (pointer.x * maxTilt - damped.x) * damp;
      damped.y += (-pointer.y * maxTilt - damped.y) * damp;
    }
    applyPlane(damped.x, damped.y);

    for (let c = 0; c < tracks.length; c++) {
      if (!reduced) {
        const paused = wallHovered || hoveredCol === c;
        const target = paused ? 0 : baseVelocity[c];
        const ease = 1 - Math.exp(-dt / (target === 0 ? 0.16 : 0.28));
        velocities[c] += (target - velocities[c]) * ease;
        const span = meta[c].copyHeight;
        offsets[c] = (((offsets[c] + velocities[c] * dt) % span) + span) % span;
      }
      tracks[c].style.transform = `translate3d(0, ${-offsets[c]}px, 0)`;
    }
    raf = requestAnimationFrame(frame);
  };

  /* ------------------------------------------------------------------ root */
  const wall = h('div', {
    class: `dw-wall${reduced ? ' dw-wall--reduced' : ''}`,
    role: 'group', 'aria-label': 'Drifting wall of images',
    onpointermove: (event) => {
      if (parallax <= 0 || reduced) return;
      const r = wall.getBoundingClientRect();
      if (!r.width || !r.height) return;
      pointer.x = (event.clientX - r.left) / r.width - 0.5;
      pointer.y = (event.clientY - r.top) / r.height - 0.5;
    },
    onpointerenter: () => { wallHovered = true; },
    onpointerleave: () => { wallHovered = false; hoveredCol = -1; pointer.x = 0; pointer.y = 0; },
  }, plane);

  wall.style.setProperty('--dw-tile-w', `${tileW}px`);
  wall.style.setProperty('--dw-tile-h', `${tileH}px`);
  wall.style.setProperty('--dw-gap', `${gap}px`);
  wall.style.setProperty('--dw-radius', `${clamp(Number(block.radius) || 14, 0, 40)}px`);
  wall.style.setProperty('--dw-perspective', `${clamp(Number(block.perspective) || 1200, 200, 4000)}px`);
  wall.style.setProperty('--dw-lift', `${clamp(Number(block.lift) ?? 50, 0, 200)}px`);
  wall.style.setProperty('--dw-dim', String(clamp(Number(block.dim) ?? 0.88, 0.2, 1)));

  const hero = h('div', { class: 'dw-hero' },
    h('h1', { class: 'dw-hero__title' },
      block.titleTop ? h('span', { class: 'dw-hero__top' }, block.titleTop) : null,
      block.titleTop && block.titleBottom ? ' ' : null,
      block.titleBottom ? h('span', { class: 'dw-hero__bottom' }, block.titleBottom) : null,
    ),
    block.tagline ? h('p', { class: 'dw-hero__tagline' }, block.tagline) : null,
  );

  const root = h('div', { class: 'dw-root ph-root' }, wall, hero);

  applyPlane(0, 0);

  /* Images arrive over several seconds and each one changes its column's
     length. Re-measuring on a few settling passes costs nothing and is what
     keeps the loop seamless; doing it on all ~340 load events would not. */
  let settle = null;
  const scheduleRemeasure = () => {
    clearTimeout(settle);
    settle = setTimeout(remeasure, 250);
  };
  wall.querySelectorAll('img').forEach((img) => {
    if (!img.complete) img.addEventListener('load', scheduleRemeasure, { once: true });
  });
  [600, 1500, 3000].forEach((ms) => setTimeout(() => { if (root.isConnected) remeasure(); }, ms));

  if (!editing) requestAnimationFrame((ts) => { raf = requestAnimationFrame(frame); frame(ts); });

  return root;
}
