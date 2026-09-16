import { h } from '../utils/dom.js';
import { registerStepper } from '../utils/slideSteps.js';

/**
 * Two frames: a masonry wall of moments behind a hollow title, then the
 * anniversary image full-bleed.
 *
 * Ported from a React sketch. What changed, and why:
 *
 *   - Tiles take an `assetId`, not a path. The sketch built `uploads/Images/...`
 *     strings, which resolve against whoever is serving the page — the wall
 *     would be complete on the machine that authored it and empty for everyone
 *     who opened the deployed link. Ids resolve server-side to real upload URLs.
 *   - The Google Fonts @import is gone; nothing is fetched at presentation time.
 *   - `height: 100vh` per frame became 100% of the block. The slide is laid out
 *     at a nominal 1600 and scaled as a whole, so a viewport unit inside it
 *     measures the window rather than the canvas.
 *   - Two scrolling frames became two steps. The deck is paged, so the same key
 *     that turns the page reveals the anniversary frame first.
 *
 * Kept intact: the tag interleave, reveal-on-view, the hover pill, and
 * drag-to-swap — all of which are self-contained and worth having.
 */

/* The sketch interleaved tiles here, on every render. It is done once at publish
   time instead and the stored order is honoured verbatim.
   Two reasons. Interleaving by the caption is wrong the moment captions are
   specific — "AWS CoE", "Cadence CoE", "Placed at Google" are twenty-odd
   buckets of one, so a round robin emits them consecutively and the wall grows
   exactly the clumps the interleave was meant to break up; the grouping has to
   be coarser than the label, which is a content decision. And a deck should
   show the same wall every time it is opened, not reshuffle behind the
   presenter. */

/**
 * Sizes the columns so the tiles actually fill the wall.
 *
 * A fixed column width only fills at one tile count. Dropping the wall from 80
 * tiles to 54 left it 58% covered — the same photographs, laid out in the same
 * 150px columns, simply ran out before the bottom. Column width is what decides
 * the area a tile covers, so it has to be solved for, not chosen.
 *
 * Each tile is `w` wide and `w / aspect` tall, so `n` tiles laid into
 * `W / w` columns stack to `n · w² / (W · aspect)`. Setting that equal to the
 * wall's height and solving gives the width below. The measured aspect is used
 * once the images have decoded, because a wall of 16:9 group photographs and a
 * wall of portraits want very different columns.
 */
function fitColumns(wall, count) {
  const W = wall.clientWidth;
  const H = wall.clientHeight;
  if (!W || !H || !count) return;

  const images = [...wall.querySelectorAll('img')].filter((i) => i.naturalWidth > 0);
  const aspect = images.length
    ? images.reduce((sum, i) => sum + i.naturalWidth / i.naturalHeight, 0) / images.length
    : 1.5;

  /* Deliberately *wider* than the exact solution, so the wall overfills and the
     ragged end is clipped by the frame instead of stopping short of it.
     Wider, not narrower — a tile's area grows with the square of the column
     width while the column count only falls linearly, so narrowing the columns
     empties the wall rather than filling it. Measured: 0.88 left a 110px gap at
     the foot of the last visible column and 0.80 made it 244px.
     Only a little wider, because the wall itself already runs 340px past the
     frame — the margin is in the height now, and stacking both made the tiles
     large enough that the mosaic thinned out to five columns. */
  const OVERFILL = 0.98;
  const ideal = Math.sqrt((W * H * aspect) / count) * OVERFILL;
  // Floor and ceiling are legibility, not maths: below ~200px a group photograph
  // is a smudge, and above ~280px the wall stops reading as a mosaic.
  wall.style.columnWidth = `${Math.round(Math.max(200, Math.min(280, ideal)))}px`;
}

const reducedMotion = () =>
  window.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true;

export function GalleryWall(block, { editing = false } = {}) {
  const source = (block.tiles || []).filter((tile) => tile.asset?.url);
  if (!source.length) {
    return h('div', { class: 'th-root th-root--empty ph-root' }, 'No images placed yet.');
  }

  const tiles = source.map((tile, i) => ({
    id: `t${i}`,
    src: tile.asset.url,
    tag: tile.tag || '',
  }));

  const root = h('div', { class: 'th-root ph-root' });
  const wall = h('div', { class: 'th-wall' });

  /* ------------------------------------------------------- drag to swap */
  let draggingId = null;
  const nodes = new Map();

  const swap = (fromId, toId) => {
    const a = tiles.findIndex((t) => t.id === fromId);
    const b = tiles.findIndex((t) => t.id === toId);
    if (a < 0 || b < 0 || a === b) return;
    [tiles[a], tiles[b]] = [tiles[b], tiles[a]];
    // Reorder the DOM to match rather than rebuilding: the nodes carry their
    // reveal state and their decoded images, and both would be thrown away.
    tiles.forEach((tile) => wall.appendChild(nodes.get(tile.id)));
  };

  tiles.forEach((tile) => {
    const image = h('img', {
      src: tile.src,
      alt: tile.tag || 'Technical Hub',
      loading: 'lazy',
      decoding: 'async',
      draggable: 'false',
    });

    const figure = h('figure', {
      class: 'th-tile',
      draggable: 'true',
      tabindex: '0',
      ondragstart: (event) => {
        draggingId = tile.id;
        figure.classList.add('is-dragging');
        if (event.dataTransfer) {
          event.dataTransfer.effectAllowed = 'move';
          try { event.dataTransfer.setData('text/plain', tile.id); } catch { /* older browsers */ }
        }
      },
      ondragover: (event) => event.preventDefault(),
      ondrop: (event) => {
        event.preventDefault();
        if (draggingId) swap(draggingId, tile.id);
      },
      ondragend: () => {
        figure.classList.remove('is-dragging');
        draggingId = null;
      },
    },
      image,
      tile.tag
        ? h('figcaption', { class: 'th-pill' },
            h('span', { class: 'th-pill__rule' }),
            h('span', { class: 'th-pill__label' }, tile.tag),
          )
        : null,
    );

    // A missing file must not leave a hole in the wall.
    image.addEventListener('error', () => figure.remove(), { once: true });

    nodes.set(tile.id, figure);
    wall.appendChild(figure);
  });

  /* --------------------------------------------------------- the reveal */
  if (reducedMotion()) {
    nodes.forEach((node) => node.classList.add('is-visible'));
  } else if (typeof IntersectionObserver === 'function') {
    const observer = new IntersectionObserver((entries, obs) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        entry.target.classList.add('is-visible');
        obs.unobserve(entry.target);
      }
    }, { threshold: 0.02 });
    requestAnimationFrame(() => nodes.forEach((node) => observer.observe(node)));
    /* The wall does not scroll — it is a slide. Anything still unrevealed once
       the entrance has had its moment is shown regardless, so a tile can never
       be left invisible because it happened to sit outside the root. */
    setTimeout(() => nodes.forEach((node) => node.classList.add('is-visible')), 1400);
  } else {
    nodes.forEach((node) => node.classList.add('is-visible'));
  }

  /* Fitted now, again as the images decode (the measured aspect changes the
     answer), and again whenever the block is resized — presenting rescales the
     slide and the nav collapses at a breakpoint. */
  const refit = () => fitColumns(wall, tiles.length);
  requestAnimationFrame(refit);
  let decoded = 0;
  wall.querySelectorAll('img').forEach((img) => {
    if (img.complete) { decoded += 1; return; }
    img.addEventListener('load', () => {
      decoded += 1;
      // Refit on the first handful and then once they are all in, rather than
      // on every one of eighty loads.
      if (decoded < 6 || decoded === tiles.length) refit();
    }, { once: true });
  });
  if (typeof ResizeObserver === 'function') {
    const ro = new ResizeObserver(refit);
    requestAnimationFrame(() => ro.observe(wall));
  }

  const hero = h('div', { class: 'th-hero' },
    block.eyebrow ? h('p', { class: 'th-hero__eyebrow' }, block.eyebrow) : null,
    block.title ? h('h1', { class: 'th-hero__title' }, block.title) : null,
    block.subtitle ? h('p', { class: 'th-hero__sub' }, block.subtitle) : null,
  );

  const wallFrame = h('section', { class: 'th-frame th-frame--wall' }, wall, hero);
  root.appendChild(wallFrame);

  /* ------------------------------------------------- frame two: the decade */
  let decadeFrame = null;
  if (block.decade?.asset?.url) {
    const d = block.decade;
    decadeFrame = h('section', { class: 'th-frame th-frame--decade', 'aria-hidden': 'true' },
      h('img', {
        class: 'th-decade__img',
        src: d.asset.url,
        alt: d.alt || d.line || 'Anniversary',
        decoding: 'async',
      }),
      h('div', { class: 'th-decade__scrim', 'aria-hidden': 'true' }),
      h('div', { class: 'th-decade__caption' },
        d.mark ? h('span', { class: 'th-decade__mark' }, d.mark) : null,
        h('div', {},
          d.years ? h('p', { class: 'th-decade__years' }, d.years) : null,
          d.line ? h('p', { class: 'th-decade__line' }, d.line) : null,
        ),
      ),
    );
    root.appendChild(decadeFrame);
  }

  /* The two frames are two beats of one slide. Forward from the wall reveals
     the anniversary; forward again is spent and the deck turns. */
  let frame = 0;
  const setFrame = (next) => {
    frame = next;
    root.classList.toggle('is-decade', frame === 1);
    if (decadeFrame) decadeFrame.setAttribute('aria-hidden', String(frame !== 1));
    wallFrame.setAttribute('aria-hidden', String(frame !== 0));
  };

  if (!editing && decadeFrame) {
    registerStepper((delta) => {
      const next = frame + (delta > 0 ? 1 : -1);
      if (next < 0 || next > 1) return false;
      setFrame(next);
      return true;
    });
  }

  setFrame(0);
  return root;
}
