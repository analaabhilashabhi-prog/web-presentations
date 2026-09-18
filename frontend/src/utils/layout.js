/**
 * Canvas layout maths, shared by the viewer and the editor.
 *
 * The canvas is a 12-column grid. Every block carries {x, y, w, h} in grid
 * units; h is a minimum height (rows grow to fit content, so text never
 * clips). All coordinates are integers, which is what makes dragging snap.
 */
export const COLUMNS = 12;
/** A small row unit keeps content-height and reserved-height close together,
 *  so nothing sits in a pocket of dead space. Rows still grow to fit. */
export const ROW_HEIGHT = 28;
export const GAP = 16;
/** One column and one row: a logo or an icon must be allowed to be small. */
export const MIN_W = 1;
export const MIN_H = 1;

export const DEFAULT_SIZE = {
  text: { w: 6, h: 5 },
  image: { w: 6, h: 8 },
  video: { w: 8, h: 8 },
  profile: { w: 4, h: 11 },
  heading: { w: 12, h: 2 },
  paragraph: { w: 12, h: 3 },
  bullets: { w: 12, h: 4 },
  quote: { w: 12, h: 6 },
  stats: { w: 12, h: 3 },
  cards: { w: 12, h: 10 },
  gallery: { w: 12, h: 9 },
  divider: { w: 12, h: 1 },
  // Page-builder elements. Heights match what the element actually occupies at
  // its default settings — a row is a minimum, so under-reserving grows to fit
  // while over-reserving would leave a pocket of dead space.
  hero: { w: 12, h: 9 },
  kpi: { w: 12, h: 4 },
  icon: { w: 2, h: 4 },
  buttons: { w: 6, h: 3 },
  logo: { w: 3, h: 5 },
  box: { w: 6, h: 10 },
  'milestone-timeline': { w: 12, h: 15 },
  'leadership-panels': { w: 12, h: 15 },
  'gallery-wall': { w: 12, h: 15 },
  'course-deck': { w: 12, h: 15 },
  'drift-wall': { w: 12, h: 15 },
  'platforms': { w: 12, h: 15 },
  'alliance-accordion': { w: 12, h: 15 },
  'skew-carousel': { w: 12, h: 15 },
  'tilted-tiles': { w: 12, h: 15 },
  'card-fan': { w: 12, h: 15 },
  'photo-ring': { w: 12, h: 15 },
  'event-orbit': { w: 12, h: 15 },
  'training-shelf': { w: 12, h: 15 },
  'curriculum-deck': { w: 12, h: 15 },
  'photo-collage': { w: 12, h: 15 },
  'event-wheel': { w: 12, h: 15 },
  'photo-folder': { w: 12, h: 15 },
  'project-showcase': { w: 12, h: 15 },
  'thread-board': { w: 12, h: 15 },
};

/** Layout boxes may nest, but not without end — the server enforces the same. */
export const MAX_BOX_DEPTH = 3;

export const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

export function overlaps(a, b) {
  return a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
}

export function layoutOf(block, index = 0) {
  const size = DEFAULT_SIZE[block.type] || { w: 12, h: 4 };
  const l = block.layout || {};
  const w = clamp(Math.round(l.w ?? size.w), 1, COLUMNS);
  return {
    x: clamp(Math.round(l.x ?? 0), 0, COLUMNS - w),
    y: Math.max(0, Math.round(l.y ?? index * 4)),
    w,
    h: Math.max(1, Math.round(l.h ?? size.h)),
  };
}

/**
 * Guarantees every block has coordinates. The server migrates stored content,
 * but this keeps the canvas valid if anything arrives without a layout — a
 * flow of full-width rows, which is what pre-canvas content was.
 */
export function ensureLayouts(blocks) {
  let cursor = 0;
  for (const block of blocks) {
    if (block.layout) {
      const l = layoutOf(block);
      block.layout = l;
      cursor = Math.max(cursor, l.y + l.h);
      continue;
    }
    const size = DEFAULT_SIZE[block.type] || { w: 12, h: 4 };
    block.layout = { x: 0, y: cursor, w: COLUMNS, h: size.h };
    cursor += size.h;
  }
  return blocks;
}

/** Reading order: top row first, then left to right. Drives DOM order. */
export function inReadingOrder(blocks) {
  return [...blocks].sort((a, b) => {
    const la = layoutOf(a);
    const lb = layoutOf(b);
    return la.y - lb.y || la.x - lb.x;
  });
}

/**
 * Pushes overlapping blocks downward, giving `priorityId` (the block the admin
 * just dropped) the position it asked for.
 */
export function resolveCollisions(blocks, priorityId = null) {
  const ordered = [...blocks].sort((a, b) => {
    if (a.id === priorityId) return -1;
    if (b.id === priorityId) return 1;
    const la = layoutOf(a);
    const lb = layoutOf(b);
    return la.y - lb.y || la.x - lb.x;
  });

  const placed = [];
  for (const block of ordered) {
    const layout = layoutOf(block);
    let guard = 0;
    while (placed.some((other) => overlaps(layout, other.layout)) && guard < 500) {
      layout.y += 1;
      guard += 1;
    }
    block.layout = layout;
    placed.push({ id: block.id, layout });
  }
  return blocks;
}

/** Pulls every block as far up as it can go, removing dead vertical space. */
export function compact(blocks) {
  const ordered = [...blocks].sort((a, b) => {
    const la = layoutOf(a);
    const lb = layoutOf(b);
    return la.y - lb.y || la.x - lb.x;
  });

  const placed = [];
  for (const block of ordered) {
    const layout = layoutOf(block);
    while (layout.y > 0) {
      const candidate = { ...layout, y: layout.y - 1 };
      if (placed.some((other) => overlaps(candidate, other.layout))) break;
      layout.y = candidate.y;
    }
    block.layout = layout;
    placed.push({ id: block.id, layout });
  }
  return blocks;
}

/**
 * Finds a balanced slot for a new block: scans rows top-down and columns
 * left-to-right for the first free w×h area, so a half-width block lands
 * beside an existing one instead of below it.
 */
export function autoPlace(blocks, size) {
  const w = clamp(size.w, 1, COLUMNS);
  const h = Math.max(1, size.h);
  const existing = blocks.map((block) => layoutOf(block));
  const maxY = existing.reduce((max, l) => Math.max(max, l.y + l.h), 0);

  for (let y = 0; y <= maxY; y += 1) {
    for (let x = 0; x <= COLUMNS - w; x += 1) {
      const candidate = { x, y, w, h };
      if (!existing.some((other) => overlaps(candidate, other))) return candidate;
    }
  }
  return { x: 0, y: maxY, w, h };
}

/** Total rows the canvas occupies — used to size the editor grid. */
export function canvasRows(blocks) {
  return blocks.reduce((max, block) => {
    const l = layoutOf(block);
    return Math.max(max, l.y + l.h);
  }, 0);
}

/** Applies a block's grid coordinates to its element. */
export function applyGridStyle(element, layout) {
  element.style.gridColumn = `${layout.x + 1} / span ${layout.w}`;
  element.style.gridRow = `${layout.y + 1} / span ${layout.h}`;
}

