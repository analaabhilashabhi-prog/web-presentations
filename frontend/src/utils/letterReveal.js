/**
 * Per-letter text entrance.
 *
 * Letters start scaled up and blurred and settle into place one after another,
 * in forward reading order. The stagger runs on a GLOBAL letter index, so it
 * never resets at a word or a line: the whole block reads as one sweep.
 *
 * The specification this implements is written for React. This deck is vanilla
 * ES modules with the `h()` helper, so the semantics are kept exactly — the
 * values, the easing, the observer thresholds, the instant reset — and only the
 * plumbing differs: a node and a small controller object instead of a component
 * and hooks. "Never route this through component state" becomes "write straight
 * to the node inside rAF", which is the same instruction.
 */

const DEFAULT_EASE = 'cubic-bezier(0.33, 1, 0.68, 1)';

/** The presets in use, quoted from the brief. */
export const REVEAL_PRESETS = {
  /* Tuned away from the brief on instruction: at stagger 18 against a 850ms
     letter the whole word was in flight at once, so it did not read as a
     reveal at all — it arrived as one blurred block. A stagger that is a real
     fraction of the duration is what makes it sequential, and a softer start
     state lets each letter become legible partway through its own travel
     instead of only at the end. */
  heading: { stagger: 52, duration: 760, startScale: 1.6, startBlur: 14 },
  lead: { stagger: 26, duration: 640, startScale: 1.4, startBlur: 10 },
  body: { stagger: 18, duration: 560, startScale: 1.3, startBlur: 8 },
  dotted: { stagger: 46, duration: 900, renderAsDots: true },
  default: { stagger: 34, duration: 720, startScale: 1.5, startBlur: 12 },
};

const reduceQuery = typeof window !== 'undefined' && window.matchMedia
  ? window.matchMedia('(prefers-reduced-motion: reduce)')
  : null;

const clamp01 = (n) => Math.min(1, Math.max(0, n));

/* ------------------------------------------------------------------ dots */

/**
 * Halftone glyphs, cached per character. The cache is cleared once the real
 * webfont has loaded, because anything built before that was drawn from the
 * fallback face and would not match.
 */
const dotCache = new Map();
let fontsSettled = false;

if (typeof document !== 'undefined' && document.fonts?.ready) {
  document.fonts.ready.then(() => {
    fontsSettled = true;
    dotCache.clear();
    document.querySelectorAll('[data-letter-reveal-dots]').forEach((node) => {
      node.__letterReveal?.rebuild();
    });
  });
}

const DOT_FONT = '900 100px "HelveticaNowDisplay-Medium", "Helvetica Neue", '
  + '-apple-system, BlinkMacSystemFont, Arial, sans-serif';

function buildGlyph(char) {
  if (dotCache.has(char)) return dotCache.get(char);

  if (char === ' ') {
    const spacer = { width: 34, circles: [] };
    dotCache.set(char, spacer);
    return spacer;
  }

  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  ctx.font = DOT_FONT;
  const textWidth = ctx.measureText(char).width;
  canvas.width = Math.max(80, Math.ceil(textWidth + 40));
  canvas.height = 130;

  const g = canvas.getContext('2d', { willReadFrequently: true });
  g.font = DOT_FONT;
  g.fillStyle = '#ffffff';
  g.textBaseline = 'alphabetic';
  g.fillText(char, 20, 92);

  const { data, width: W, height: H } = g.getImageData(0, 0, canvas.width, canvas.height);
  const alphaAt = (x, y) => (x < 0 || y < 0 || x >= W || y >= H ? 0 : data[(y * W + x) * 4 + 3] / 255);

  const STEP = 4.4;
  const circles = [];
  let minX = Infinity;
  let maxX = -Infinity;

  for (let y = 0; y < H; y += STEP) {
    for (let x = 0; x < W; x += STEP) {
      // Average the 3x3 neighbourhood for coverage.
      let sum = 0;
      for (let dy = -1; dy <= 1; dy += 1) {
        for (let dx = -1; dx <= 1; dx += 1) sum += alphaAt(Math.round(x) + dx, Math.round(y) + dy);
      }
      const coverage = sum / 9;
      if (coverage <= 0.08) continue;
      const radius = Math.min(2.0, Math.max(0.85, coverage * 2.0 * 1.15));
      const level = Math.round(225 + coverage * 30);
      circles.push({ x, y, r: radius, fill: `rgb(${level},${level},${level})` });
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
    }
  }

  if (!circles.length) {
    const empty = { width: 34, circles: [] };
    dotCache.set(char, empty);
    return empty;
  }

  // Normalise horizontally to the ink with 2px of padding. The vertical window
  // is fixed at 12..122 for every glyph so all letters sit on one baseline.
  const padded = Math.max(0, minX - 2);
  const width = (maxX + 2) - padded;
  const glyph = {
    width,
    circles: circles.map((c) => ({ ...c, x: c.x - padded, y: c.y - 12 })),
  };
  dotCache.set(char, glyph);
  return glyph;
}

function dotNode(char) {
  const glyph = buildGlyph(char);
  if (!glyph.circles.length) {
    const spacer = document.createElement('span');
    spacer.style.display = 'inline-block';
    spacer.style.height = '1.08em';
    spacer.style.width = `${(glyph.width / 110) * 1.08}em`;
    return spacer;
  }
  const NS = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(NS, 'svg');
  svg.setAttribute('viewBox', `0 0 ${glyph.width} 110`);
  svg.style.height = '1.08em';
  svg.style.width = `${(glyph.width / 110) * 1.08}em`;
  svg.style.verticalAlign = '-0.20em';
  svg.style.filter = 'drop-shadow(0 0 18px rgba(255,255,255,0.25))';
  for (const c of glyph.circles) {
    const circle = document.createElementNS(NS, 'circle');
    circle.setAttribute('cx', String(c.x));
    circle.setAttribute('cy', String(c.y));
    circle.setAttribute('r', String(c.r));
    circle.setAttribute('fill', c.fill);
    svg.appendChild(circle);
  }
  return svg;
}

/* --------------------------------------------------------------- reveal */

/**
 * Builds the node and returns { node, reveal, hide, destroy }.
 *
 * @param {string} text            supports \n for hard line breaks
 * @param {object} [options]
 */
export function letterReveal(text, options = {}) {
  const {
    as = 'div',
    className = '',
    style = null,
    trigger = undefined,
    stagger = 14,
    duration = 900,
    startScale = 2,
    startBlur = 20,
    enableScrollScale = false,
    nowrapLines = false,
    renderAsDots = false,
    easing = DEFAULT_EASE,
  } = options;

  const container = document.createElement(as);
  container.setAttribute('aria-label', text);
  container.className = `relative select-none${className ? ` ${className}` : ''}`;
  if (style) Object.assign(container.style, style);
  if (renderAsDots) container.setAttribute('data-letter-reveal-dots', '');

  // The scroll-linked scale needs a wrapper of its own so the transform it
  // writes never fights the per-letter transforms.
  let scaleHost = container;
  if (enableScrollScale) {
    scaleHost = document.createElement('div');
    scaleHost.style.transformOrigin = 'center';
    scaleHost.style.willChange = 'transform';
    container.appendChild(scaleHost);
  }

  const letters = [];
  const lines = String(text).split('\n');
  const multiline = lines.length > 1;
  let globalIndex = 0;

  for (const line of lines) {
    const lineEl = document.createElement('span');
    lineEl.setAttribute('aria-hidden', 'true');
    lineEl.style.display = multiline ? 'block' : 'inline';
    if (nowrapLines) lineEl.style.whiteSpace = 'nowrap';

    for (const word of line.split(' ')) {
      const wordEl = document.createElement('span');
      wordEl.setAttribute('aria-hidden', 'true');
      wordEl.style.display = 'inline-block';
      wordEl.style.whiteSpace = 'nowrap';
      wordEl.style.marginRight = '0.28em';

      for (const char of Array.from(word)) {
        const letterEl = document.createElement('span');
        letterEl.setAttribute('aria-hidden', 'true');
        letterEl.style.display = 'inline-block';
        letterEl.style.transform = 'translateZ(0)';
        /* Set while the reveal is in flight and cleared the moment it lands —
           see `settleTimer` below. `will-change: filter` promotes every glyph to
           a compositor layer of its own and holds it there for as long as the
           declaration stands, which is the whole life of the element. That was
           a headline's worth of layers per slide when a few sections had a
           title card; since every tab in both decks got one (2026-09-17) it is
           a screenful on every navigation. Measured through a card: the settled
           slide behind it ran 7ms a frame and the card itself 21. */
        letterEl.style.willChange = 'opacity, transform, filter';
        if (renderAsDots) letterEl.appendChild(dotNode(char));
        else letterEl.textContent = char;
        letterEl.__index = globalIndex;
        globalIndex += 1;
        letters.push(letterEl);
        wordEl.appendChild(letterEl);
      }
      lineEl.appendChild(wordEl);
    }
    scaleHost.appendChild(lineEl);
  }

  const prefersReduce = () => !!reduceQuery?.matches;

  function paint(revealed) {
    const reduce = prefersReduce();
    for (const el of letters) {
      if (revealed) {
        // Revealed: the only animated direction.
        el.style.transitionProperty = 'opacity, transform, filter';
        el.style.transitionDuration = reduce ? '0ms' : `${duration}ms`;
        el.style.transitionTimingFunction = easing;
        el.style.transitionDelay = reduce ? '0ms' : `${el.__index * stagger}ms`;
        el.style.opacity = '1';
        el.style.transform = 'translateZ(0) scale(1)';
        el.style.filter = 'blur(0px)';
      } else {
        // CRITICAL: the reset is instant, not reversed. Leaving the viewport
        // snaps every letter back with no outbound animation.
        el.style.transitionProperty = 'none';
        el.style.transitionDuration = '0ms';
        el.style.transitionDelay = '0ms';
        el.style.opacity = '0';
        el.style.transform = `translateZ(0) scale(${startScale})`;
        el.style.filter = `blur(${startBlur}px)`;
      }
    }
  }

  let revealTimer = null;
  let settleTimer = null;

  /* The last letter's transition ends at its own delay plus the duration; a
     little after that, nothing is animating and the hint is pure cost. Dropping
     it hands the glyphs back to the ordinary paint path. */
  const settleAfter = () => {
    clearTimeout(settleTimer);
    const last = letters.length ? (letters.length - 1) * stagger + duration : 0;
    settleTimer = setTimeout(() => {
      for (const el of letters) el.style.willChange = '';
    }, last + 120);
  };

  const reveal = () => {
    clearTimeout(revealTimer);
    /* Put the hint back before animating again: a reveal can run more than once
       — the observer re-fires on re-entry, and SkewCarousel rebuilds its ghost
       on every centred card. */
    for (const el of letters) el.style.willChange = 'opacity, transform, filter';
    // Two frames: the instant-reset styles must land before the transition is
    // re-attached, or the browser coalesces them and nothing animates.
    requestAnimationFrame(() => requestAnimationFrame(() => { paint(true); settleAfter(); }));
  };
  const hide = () => {
    clearTimeout(revealTimer);
    clearTimeout(settleTimer);
    paint(false);
  };

  paint(prefersReduce());

  /* ------------------------------------------------------ trigger */
  let observer = null;
  if (typeof trigger === 'boolean') {
    // A supplied trigger wins over the observer.
    if (trigger) revealTimer = setTimeout(reveal, 40);
    else hide();
  } else if (typeof IntersectionObserver !== 'undefined') {
    observer = new IntersectionObserver((records) => {
      for (const record of records) {
        if (record.isIntersecting) reveal();
        else hide();
      }
    }, { threshold: 0.15, rootMargin: '0px 0px -10% 0px' });
    observer.observe(container);
  } else {
    reveal();
  }

  /* ------------------------------------------- scroll-linked scale */
  let frame = null;
  let onScroll = null;
  if (enableScrollScale) {
    const write = () => {
      frame = null;
      const rect = container.getBoundingClientRect();
      const centerY = rect.top + rect.height / 2;
      const progress = clamp01((window.innerHeight - centerY) / window.innerHeight);
      const s = 1.1 - progress * (1.1 - 0.85);
      // Straight to the node, inside rAF: no state, no re-render.
      scaleHost.style.transform = `scale3d(${s}, ${s}, 1)`;
    };
    onScroll = () => { if (frame === null) frame = requestAnimationFrame(write); };
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll, { passive: true });
    write();
  }

  /* ------------------------------------------------ reduced motion */
  const onReduceChange = () => paint(true);
  reduceQuery?.addEventListener?.('change', onReduceChange);

  const controller = {
    node: container,
    reveal,
    hide,
    /** Rebuilds the dotted glyphs once the real webfont has loaded. */
    rebuild() {
      if (!renderAsDots) return;
      for (const el of letters) {
        const char = el.__char;
        if (char === undefined) continue;
        el.replaceChildren(dotNode(char));
      }
    },
    destroy() {
      observer?.disconnect();
      clearTimeout(revealTimer);
      if (onScroll) {
        window.removeEventListener('scroll', onScroll);
        window.removeEventListener('resize', onScroll);
      }
      if (frame !== null) cancelAnimationFrame(frame);
      reduceQuery?.removeEventListener?.('change', onReduceChange);
    },
  };

  // Remember the character so a rebuild can redraw it from the real font.
  if (renderAsDots) {
    let i = 0;
    for (const line of lines) {
      for (const word of line.split(' ')) {
        for (const char of Array.from(word)) { letters[i].__char = char; i += 1; }
      }
    }
  }

  container.__letterReveal = controller;
  return controller;
}

/** Convenience: build with one of the quoted presets. */
export function letterRevealPreset(text, preset = 'default', options = {}) {
  return letterReveal(text, { ...REVEAL_PRESETS[preset], ...options });
}

export { fontsSettled };

/**
 * Sizes a line of display type to fill its container.
 *
 * A fixed size cannot work for titles of different lengths: whatever fills the
 * screen for "Governing Body" overflows for "Profile of the Society". Measure
 * the text at a known size, then scale by the ratio — every title then lands at
 * the same optical width regardless of how many letters it has.
 *
 * Measured while the letters are still hidden, which is safe: they are hidden
 * with opacity and transform, and neither affects layout width.
 */
export function fitToWidth(node, { fill = 0.92, min = 40, max = 260, probe = 120 } = {}) {
  // The parent is resolved lazily, not captured here: this is called while the
  // node is still detached — it is placed into the tree afterwards — so reading
  // parentElement now returns null and the fit silently never runs.
  const apply = () => {
    const host = node.parentElement;
    if (!host) return;
    const avail = host.clientWidth * fill;
    if (!avail) return;
    node.style.fontSize = `${probe}px`;
    const measured = node.scrollWidth;
    if (!measured) return;
    const size = Math.max(min, Math.min(max, probe * (avail / measured)));
    node.style.fontSize = `${size}px`;
  };

  // The node is built before it is in the document, so wait for a frame that
  // has a laid-out parent before measuring.
  const settle = (tries = 0) => {
    if (node.parentElement?.clientWidth) { apply(); return; }
    if (tries > 60) return;
    requestAnimationFrame(() => settle(tries + 1));
  };
  requestAnimationFrame(() => settle());

  if (window.ResizeObserver) {
    const ro = new ResizeObserver(() => apply());
    // Observe the card once it exists, for the same reason.
    requestAnimationFrame(() => { if (node.parentElement) ro.observe(node.parentElement); });
    return () => ro.disconnect();
  }
  const onResize = () => apply();
  window.addEventListener('resize', onResize, { passive: true });
  return () => window.removeEventListener('resize', onResize);
}
