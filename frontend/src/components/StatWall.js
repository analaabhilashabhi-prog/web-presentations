import { h, svg } from '../utils/dom.js';

/**
 * A wall of figures, each in its own tile with a drawing of itself.
 *
 * The tile follows the supplied bento reference: a tinted panel carrying the
 * drawing, the figure's name beneath it, and a line of context under that. The
 * drawings are built from the deck's own colours rather than the reference's
 * blues, and every one of them is CSS and SVG — nothing is an image, so it
 * stays sharp on a projector and needs no network.
 *
 * Numbers count up when the tile arrives. The count is driven from the value
 * actually published, so it can never drift from the figure beneath it. Ratios
 * ("1:19") are not counted — there is nothing to count towards — and are
 * revealed instead.
 *
 * Percentages are drawn from the published `percent`, not re-derived. The
 * source document rounds them, and a recomputed figure would silently disagree
 * with the number printed beside it.
 */

const EASE_OUT = (t) => 1 - (1 - t) ** 3;

/** Counts an element from zero to its number once, over `ms`. */
function countUp(el, target, ms = 1400) {
  const value = Number(String(target).replace(/[^0-9.]/g, ''));
  if (!Number.isFinite(value) || value <= 0) { el.textContent = String(target); return; }
  const decimals = String(target).includes('.') ? 1 : 0;
  let start = null;
  const step = (now) => {
    if (start === null) start = now;
    const t = Math.min(1, (now - start) / ms);
    el.textContent = (value * EASE_OUT(t)).toFixed(decimals);
    if (t < 1) requestAnimationFrame(step);
    else el.textContent = String(target);
  };
  el.textContent = decimals ? '0.0' : '0';
  requestAnimationFrame(step);
}

/* ------------------------------------------------------------- drawings */

/** One large figure, with a ring that breathes behind it. */
function vizCount(tile) {
  const num = h('span', { class: 'stat-count__no' }, '0');
  const node = h(
    'div',
    { class: 'stat-viz stat-viz--count' },
    h('span', { class: 'stat-count__ring', 'aria-hidden': 'true' }),
    h('span', { class: 'stat-count__ring stat-count__ring--2', 'aria-hidden': 'true' }),
    h('div', { class: 'stat-count' }, num),
  );
  node.__count = [[num, tile.value]];
  return node;
}

/** A set of bars, each growing to its share of the largest. */
function vizBars(tile) {
  const max = Math.max(...tile.series.map((s) => Number(s.value) || 0), 1);
  const counts = [];
  const cols = tile.series.map((point, i) => {
    const pct = ((Number(point.value) || 0) / max) * 100;
    const num = h('span', { class: 'stat-bar__no' }, '0');
    counts.push([num, point.value]);
    return h(
      'div',
      { class: 'stat-bar', style: { '--j': String(i) } },
      num,
      h('div', { class: 'stat-bar__track' },
        h('div', { class: 'stat-bar__fill', style: { '--h': `${pct}%` } })),
      h('span', { class: 'stat-bar__label' }, point.label),
    );
  });
  const node = h('div', { class: 'stat-viz stat-viz--bars' }, ...cols);
  node.__count = counts;
  return node;
}

/** Two shares of one whole, as a single divided rail. */
function vizSplit(tile) {
  const counts = [];
  const total = tile.series.reduce((n, s) => n + (Number(s.value) || 0), 0) || 1;
  const segs = tile.series.map((point, i) => {
    const share = ((Number(point.value) || 0) / total) * 100;
    return h('div', {
      class: `stat-split__seg stat-split__seg--${i}`,
      style: { '--w': `${share}%`, '--j': String(i) },
    });
  });
  const legend = tile.series.map((point, i) => {
    const num = h('span', { class: 'stat-split__no' }, '0');
    counts.push([num, point.value]);
    return h(
      'div',
      { class: `stat-split__key stat-split__key--${i}`, style: { '--j': String(i) } },
      h('span', { class: 'stat-split__dot', 'aria-hidden': 'true' }),
      h('div', { class: 'stat-split__text' },
        h('div', { class: 'stat-split__line' }, num,
          point.percent ? h('span', { class: 'stat-split__pct' }, point.percent) : null),
        h('span', { class: 'stat-split__label' }, point.label)),
    );
  });
  const node = h(
    'div',
    { class: 'stat-viz stat-viz--split' },
    h('div', { class: 'stat-split__rail' }, ...segs),
    h('div', { class: 'stat-split__keys' }, ...legend),
  );
  node.__count = counts;
  return node;
}

/**
 * Two shares of one whole, as a ring.
 *
 * A ring rather than the divided rail it replaces: a rail states a proportion,
 * a ring shows it as an amount of a circle, which is what the eye reads a
 * two-way split as. It also suits the tile — the panel is wider than it is
 * tall, so the ring takes the left and the figures stand beside it instead of
 * stacking under a thin bar with air above and below.
 *
 * The arcs are drawn by dash length, so they can be swept round from nothing
 * on arrival. The centre carries the whole they are shares of, which is the one
 * number that is true of both halves and privileges neither.
 */
function vizDonut(tile) {
  const R = 48;
  const C = 2 * Math.PI * R;
  const total = tile.series.reduce((n, s) => n + (Number(s.value) || 0), 0) || 1;

  let run = 0;
  const arcs = tile.series.map((point, i) => {
    const len = (C * (Number(point.value) || 0)) / total;
    const arc = svg('circle', {
      cx: 60, cy: 60, r: R, fill: 'none',
      class: `stat-donut__seg stat-donut__seg--${i}`,
    });
    arc.style.setProperty('--len', String(len));
    arc.style.setProperty('--gap', String(C - len));
    arc.style.setProperty('--off', String(-run));
    arc.style.setProperty('--j', String(i));
    run += len;
    return arc;
  });

  const track = svg('circle', { cx: 60, cy: 60, r: R, fill: 'none', class: 'stat-donut__track' });
  const ring = svg('svg', { viewBox: '0 0 120 120', class: 'stat-donut__svg' }, track, ...arcs);

  const counts = [];
  const totalNo = h('span', { class: 'stat-donut__total' }, '0');
  counts.push([totalNo, String(total)]);

  const keys = tile.series.map((point, i) => {
    const num = h('span', { class: 'stat-split__no' }, '0');
    counts.push([num, point.value]);
    return h(
      'div',
      { class: `stat-split__key stat-split__key--${i}`, style: { '--j': String(i) } },
      h('span', { class: 'stat-split__dot', 'aria-hidden': 'true' }),
      h('div', { class: 'stat-split__text' },
        h('div', { class: 'stat-split__line' }, num,
          point.percent ? h('span', { class: 'stat-split__pct' }, point.percent) : null),
        h('span', { class: 'stat-split__label' }, point.label)),
    );
  });

  const node = h(
    'div',
    { class: 'stat-viz stat-viz--donut' },
    h('div', { class: 'stat-donut' }, ring,
      h('div', { class: 'stat-donut__hole' }, totalNo,
        h('span', { class: 'stat-donut__cap' }, 'Total'))),
    h('div', { class: 'stat-donut__keys' }, ...keys),
  );
  node.__count = counts;
  return node;
}

/**
 * Concentric rings — one ring per item, not one circle divided between them.
 *
 * Geometry from the supplied component: size 250, strokeWidth 18, ringGap 8.
 * The outermost radius is (size - strokeWidth) / 2 so the stroke sits inside
 * the box rather than being clipped by it, and each ring inside steps in by
 * strokeWidth + ringGap.
 *
 * Every ring is a share of the same whole, so each arc is that item's fraction
 * of the total and the rings can be read against one another at a glance — a
 * long outer arc against a short inner one is the split, without having to
 * follow a single circle round past a join. The centre carries the whole, the
 * one number true of every ring and privileging none.
 */
function vizRings(tile) {
  const SIZE = 250;
  const STROKE = 18;
  const GAP = 8;
  const total = tile.series.reduce((n, s) => n + (Number(s.value) || 0), 0) || 1;

  const counts = [];
  const parts = [];

  tile.series.forEach((point, i) => {
    const r = (SIZE - STROKE) / 2 - i * (STROKE + GAP);
    const C = 2 * Math.PI * r;
    const len = (C * (Number(point.value) || 0)) / total;

    parts.push(svg('circle', {
      cx: SIZE / 2, cy: SIZE / 2, r, fill: 'none',
      class: 'stat-rings__track',
    }));

    const arc = svg('circle', {
      cx: SIZE / 2, cy: SIZE / 2, r, fill: 'none',
      class: `stat-rings__arc stat-rings__arc--${i}`,
    });
    arc.style.setProperty('--len', String(len));
    arc.style.setProperty('--gap', String(C - len));
    arc.style.setProperty('--j', String(i));
    parts.push(arc);
  });

  const chart = svg('svg', { viewBox: `0 0 ${SIZE} ${SIZE}`, class: 'stat-rings__svg' }, ...parts);

  const totalNo = h('span', { class: 'stat-donut__total' }, '0');
  counts.push([totalNo, String(total)]);

  const keys = tile.series.map((point, i) => {
    const num = h('span', { class: 'stat-split__no' }, '0');
    counts.push([num, point.value]);
    return h(
      'div',
      { class: `stat-split__key stat-split__key--${i}`, style: { '--j': String(i) } },
      h('span', { class: 'stat-split__dot', 'aria-hidden': 'true' }),
      h('div', { class: 'stat-split__text' },
        h('div', { class: 'stat-split__line' }, num,
          point.percent ? h('span', { class: 'stat-split__pct' }, point.percent) : null),
        h('span', { class: 'stat-split__label' }, point.label)),
    );
  });

  const node = h(
    'div',
    { class: 'stat-viz stat-viz--rings' },
    h('div', { class: 'stat-rings' }, chart,
      h('div', { class: 'stat-donut__hole' }, totalNo,
        h('span', { class: 'stat-donut__cap' }, 'Total'))),
    h('div', { class: 'stat-donut__keys' }, ...keys),
  );
  node.__count = counts;
  return node;
}

/**
 * Hatched pattern tiles, as the supplied component defines them.
 *
 * Each orientation is a tile drawn in `userSpaceOnUse` units so the hatching
 * keeps one scale across every slice rather than being re-scaled per shape.
 * The diagonals carry two extra lines offset by a full tile so the stroke meets
 * itself across the tile edges — one line alone leaves a visible seam at every
 * repeat.
 */
function patternLines({ id, orientation, stroke, width = 6, height = 6 }) {
  const lines = [];
  const line = (x1, y1, x2, y2) => svg('line', {
    x1, y1, x2, y2, stroke, 'stroke-width': 1.6, 'stroke-linecap': 'square',
  });

  if (orientation === 'horizontal') {
    lines.push(line(0, height / 2, width, height / 2));
  } else if (orientation === 'vertical') {
    lines.push(line(width / 2, 0, width / 2, height));
  } else if (orientation === 'diagonalRightToLeft') {
    lines.push(line(0, 0, width, height));
    lines.push(line(-width, 0, width, height * 2));
    lines.push(line(0, -height, width * 2, height));
  } else {
    // diagonal, bottom-left to top-right
    lines.push(line(0, height, width, 0));
    lines.push(line(-width, height, width, -height));
    lines.push(line(0, height * 2, width * 2, 0));
  }

  return svg('pattern', {
    id, width, height, patternUnits: 'userSpaceOnUse',
  }, ...lines);
}

/** The wedge from one angle to another, drawn from the centre. */
function wedge(cx, cy, r, from, to) {
  const at = (a) => [cx + r * Math.cos(a), cy + r * Math.sin(a)];
  const [x1, y1] = at(from);
  const [x2, y2] = at(to);
  const large = to - from > Math.PI ? 1 : 0;
  return `M ${cx} ${cy} L ${x1.toFixed(3)} ${y1.toFixed(3)} `
    + `A ${r} ${r} 0 ${large} 1 ${x2.toFixed(3)} ${y2.toFixed(3)} Z`;
}

/**
 * A pie whose slices are hatched rather than filled flat.
 *
 * Size 200, from the supplied component. The hatching is what separates the
 * slices here — the deck has two colours to spend, and two flat wedges of navy
 * and orange would read as a split without saying which is which at a glance.
 * A ruled wedge against a barred one stays legible even where the two meet.
 */
function vizPie(tile) {
  const SIZE = 200;
  const R = 92;
  const CX = SIZE / 2;
  const CY = SIZE / 2;
  const ORIENTS = ['diagonal', 'horizontal', 'vertical', 'diagonalRightToLeft'];
  const INKS = ['#0E2455', '#F6872A', '#1A3A5C', '#D45F06'];

  const total = tile.series.reduce((n, s) => n + (Number(s.value) || 0), 0) || 1;
  const uid = `pp-${Math.random().toString(36).slice(2, 8)}`;

  const defs = [];
  const slices = [];
  let angle = -Math.PI / 2;

  tile.series.forEach((point, i) => {
    const id = `${uid}-${i}`;
    const isWide = ORIENTS[i % 4] === 'diagonalRightToLeft';
    defs.push(patternLines({
      id,
      orientation: ORIENTS[i % 4],
      stroke: INKS[i % INKS.length],
      width: isWide ? 8 : 6,
      height: isWide ? 8 : 6,
    }));

    const sweep = (2 * Math.PI * (Number(point.value) || 0)) / total;
    const path = svg('path', {
      d: wedge(CX, CY, R, angle, angle + sweep),
      fill: `url(#${id})`,
      class: `stat-pie__slice stat-pie__slice--${i}`,
    });
    path.style.setProperty('--j', String(i));
    slices.push(path);

    // The outline keeps a hatched wedge from dissolving into its neighbour.
    const edge = svg('path', {
      d: wedge(CX, CY, R, angle, angle + sweep),
      fill: 'none',
      stroke: INKS[i % INKS.length],
      'stroke-width': 2,
      'stroke-linejoin': 'round',
      class: `stat-pie__edge stat-pie__edge--${i}`,
    });
    edge.style.setProperty('--j', String(i));
    slices.push(edge);

    angle += sweep;
  });

  const chart = svg(
    'svg',
    { viewBox: `0 0 ${SIZE} ${SIZE}`, class: 'stat-pie__svg' },
    svg('defs', {}, ...defs),
    ...slices,
  );

  const counts = [];
  const keys = tile.series.map((point, i) => {
    const num = h('span', { class: 'stat-split__no' }, '0');
    counts.push([num, point.value]);
    return h(
      'div',
      { class: `stat-split__key stat-pie__key--${i}`, style: { '--j': String(i) } },
      h('span', { class: `stat-pie__swatch stat-pie__swatch--${i}`, 'aria-hidden': 'true' }),
      h('div', { class: 'stat-split__text' },
        h('div', { class: 'stat-split__line' }, num,
          point.percent ? h('span', { class: 'stat-split__pct' }, point.percent) : null),
        h('span', { class: 'stat-split__label' }, point.label)),
    );
  });

  const node = h(
    'div',
    { class: 'stat-viz stat-viz--pie' },
    h('div', { class: 'stat-pie' }, chart),
    h('div', { class: 'stat-donut__keys' }, ...keys),
  );
  node.__count = counts;
  return node;
}

/** A ratio — one against many, drawn as a figure against a field of them. */
function vizRatio(tile) {
  const right = Number(String(tile.value).split(':')[1]) || 0;
  const dots = Array.from({ length: Math.min(right, 24) }, (_, i) => h('span', {
    class: 'stat-ratio__dot', style: { '--j': String(i) },
  }));
  return h(
    'div',
    { class: 'stat-viz stat-viz--ratio' },
    h('div', { class: 'stat-ratio__value' }, tile.value),
    h('div', { class: 'stat-ratio__field' },
      h('span', { class: 'stat-ratio__one', 'aria-hidden': 'true' }),
      h('div', { class: 'stat-ratio__dots' }, ...dots)),
  );
}

const DRAW = { count: vizCount, bars: vizBars, split: vizSplit, donut: vizDonut, rings: vizRings, pie: vizPie, ratio: vizRatio };

export function StatWall(block, { editing = false } = {}) {
  const tiles = (block.tiles || []).slice(0, 8);

  if (!tiles.length) {
    return h(
      'div',
      { class: 'statwall statwall--empty' },
      h('p', { class: 'media-empty__hint' }, editing ? 'No figures on this wall yet.' : ''),
    );
  }

  const pending = [];

  const cards = tiles.map((tile, index) => {
    const viz = (DRAW[tile.viz] || vizCount)(tile);
    // h() puts unknown object children through String(); the counts ride on a
    // property instead, collected here and started when the tile arrives.
    const counts = viz.__count || [];
    const card = h(
      'article',
      {
        class: `stat-tile stat-tile--${tile.viz}`,
        style: { '--i': String(index), gridColumn: `span ${tile.span || 2}` },
      },
      h('div', { class: 'stat-tile__panel' }, viz),
      h('h3', { class: 'stat-tile__title' }, tile.title),
      tile.caption ? h('p', { class: 'stat-tile__caption' }, tile.caption) : null,
    );
    pending.push([card, counts, index]);
    return card;
  });

  /* The figures start once the tile has actually arrived — a number counting
     behind a slide's title card would be over before anyone saw it. The hold
     is read off the slide, so a section with no title card counts straight
     away. */
  if (typeof IntersectionObserver !== 'undefined') {
    const io = new IntersectionObserver((records) => {
      for (const record of records) {
        if (!record.isIntersecting) continue;
        const entry = pending.find(([card]) => card === record.target);
        if (!entry || entry[3]) continue;
        entry[3] = true;
        const slide = record.target.closest('.slide');
        const hold = slide
          ? parseFloat(getComputedStyle(slide).getPropertyValue('--intro-hold')) || 0
          : 0;
        const delay = hold * 1000 + entry[2] * 120 + 320;
        setTimeout(() => entry[1].forEach(([el, value]) => countUp(el, value)), delay);
        record.target.classList.add('is-in');
      }
    }, { threshold: 0.2, rootMargin: '0px 0px -8% 0px' });
    pending.forEach(([card]) => io.observe(card));
  } else {
    pending.forEach(([card, counts]) => {
      card.classList.add('is-in');
      counts.forEach(([el, value]) => { el.textContent = String(value); });
    });
  }

  return h(
    'div',
    { class: 'statwall' },
    block.kicker || block.standfirst
      ? h(
        'header',
        { class: 'statwall__head' },
        block.kicker ? h('p', { class: 'statwall__kicker' }, block.kicker) : null,
        block.standfirst ? h('p', { class: 'statwall__standfirst' }, block.standfirst) : null,
      )
      : null,
    h('div', { class: 'statwall__grid' }, ...cards),
    block.note ? h('p', { class: 'statwall__note' }, block.note) : null,
  );
}
