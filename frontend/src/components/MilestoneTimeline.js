import { h } from '../utils/dom.js';
import { icon } from '../utils/icons.js';
import { registerStepper } from '../utils/slideSteps.js';

/**
 * A timeline the presenter walks in place: the same key that turns the page
 * advances one stop, and the deck only moves on once the last stop is spent.
 *
 * The year is an odometer. Scrolling 2015 → 2016 must roll the 5 to a 6 and
 * leave the 2, the 0 and the 1 perfectly still — a whole-number crossfade reads
 * as a slide changing, which is the one thing this block exists not to do. So
 * each character sits in its own cell and a cell that is not changing is never
 * touched.
 */

const DIGIT = /^[0-9]$/;

/* A wheel gesture is not one event. A mouse notch is a single ~100px delta; a
   trackpad flick is a burst of small ones followed by a second or more of
   decaying momentum. Counting events would run through five years on one flick,
   and a bare cooldown would still let the tail through once it expired. So a
   step needs enough travel to count as intent, and the cooldown afterwards
   discards the momentum rather than banking it. */
const WHEEL_THRESHOLD = 48;
const WHEEL_COOLDOWN = 520;

/**
 * The night sky, drawn as three parallax layers of `box-shadow` dots.
 *
 * Seeded rather than random: the deck is walked forwards and backwards in front
 * of a room, and a field of stars that reshuffled every time the slide was
 * revisited would read as a glitch. The same seed gives the same sky on every
 * machine and every render.
 *
 * box-shadow rather than canvas because it costs nothing to keep running — the
 * layer is composited once and then only translated, so the drift is free on
 * the GPU and there is no animation frame competing with the odometer.
 */
function starLayer(count, seed, size, spread) {
  let s = seed;
  const next = () => {
    // Park–Miller: small, deterministic, and good enough to scatter dots.
    s = (s * 16807) % 2147483647;
    return s / 2147483647;
  };
  const shadows = [];
  for (let i = 0; i < count; i++) {
    // Two tiles tall, so the layer can scroll a full tile and repeat seamlessly.
    const x = Math.round(next() * spread);
    const y = Math.round(next() * spread);
    const dim = 0.35 + next() * 0.55;
    shadows.push(`${x}px ${y}px 0 rgba(255,255,255,${dim.toFixed(2)})`, `${x}px ${y + spread}px 0 rgba(255,255,255,${dim.toFixed(2)})`);
  }
  return h('span', {
    class: 'milestones__stars',
    'aria-hidden': 'true',
    style: {
      width: `${size}px`,
      height: `${size}px`,
      boxShadow: shadows.join(','),
      '--star-span': `${spread}px`,
    },
  });
}

function skyLayers() {
  return h(
    'div',
    { class: 'milestones__sky', 'aria-hidden': 'true' },
    // Two soft clouds of brand colour, drifting on their own long cycles. They
    // are what makes it read as a galaxy rather than as static noise.
    h('span', { class: 'milestones__nebula milestones__nebula--a' }),
    h('span', { class: 'milestones__nebula milestones__nebula--b' }),
    h('div', { class: 'milestones__star-field milestones__star-field--far' }, starLayer(90, 1337, 1, 1600)),
    h('div', { class: 'milestones__star-field milestones__star-field--mid' }, starLayer(50, 4242, 2, 1600)),
    h('div', { class: 'milestones__star-field milestones__star-field--near' }, starLayer(22, 90210, 3, 1600)),
  );
}

/**
 * The strip a cell rolls through to get from one glyph to the next.
 *
 * Two digits roll the way a mechanical counter does — through every digit
 * between them, forward, wrapping past 9. That is what makes 2019 → 2020 read
 * correctly: the units travel 9 → 0 in the same direction as the tens 1 → 2,
 * rather than spinning back nine places to arrive at the same answer.
 *
 * Anything else (a year giving way to NEXT) has no numeric distance to travel,
 * so it is a single hop. Built per transition rather than held as one long
 * strip, because a strip covering every glyph a position ever shows would put
 * 2025's 5 nine cells back from 2024's 4 and roll the wrong way down the deck.
 */
function rollPath(from, to, forward) {
  if (from === to) return [from];
  if (!DIGIT.test(from) || !DIGIT.test(to)) return [from, to];

  const path = [from];
  let value = Number(from);
  const target = Number(to);
  // Bounded by construction: mod 10 reaches any digit within nine steps.
  while (value !== target) {
    value = forward ? (value + 1) % 10 : (value + 9) % 10;
    path.push(String(value));
  }
  return path;
}

/** One character of the label, with its own strip and its own current glyph. */
function odometerCell(glyph) {
  const strip = h('span', { class: 'milestones__strip' }, h('span', { class: 'milestones__glyph' }, glyph));
  const cell = h('span', { class: 'milestones__cell' }, strip);
  return { cell, strip, current: glyph };
}

function reducedMotion() {
  return window.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true;
}

/**
 * Rolls one cell to a new glyph and collapses the strip back to a single child
 * once it lands, so the next transition starts from a known state rather than
 * from wherever the last one stopped.
 */
function rollCell(entry, glyph, forward) {
  if (entry.current === glyph) return; // the whole point: leave it alone
  const path = rollPath(entry.current, glyph, forward);
  entry.current = glyph;

  const settle = () => {
    entry.strip.style.transition = 'none';
    entry.strip.style.transform = 'translateY(0)';
    entry.strip.replaceChildren(h('span', { class: 'milestones__glyph' }, glyph));
    // Read back so the cleared transition is committed before the next roll.
    void entry.strip.offsetHeight;
    entry.strip.style.transition = '';
  };

  entry.strip.replaceChildren(...path.map((g) => h('span', { class: 'milestones__glyph' }, g)));
  entry.strip.style.transition = 'none';
  entry.strip.style.transform = 'translateY(0)';

  if (reducedMotion()) {
    settle();
    return;
  }

  // Longer strips are given more time, but not proportionally — a nine-place
  // roll that took nine times as long as a one-place roll would still be
  // travelling when the presenter is on the next sentence.
  const distance = path.length - 1;
  const duration = Math.min(1100, 420 + distance * 70);

  requestAnimationFrame(() => {
    entry.strip.style.transition = `transform ${duration}ms cubic-bezier(.22,.68,0,1)`;
    entry.strip.style.transform = `translateY(calc(${-distance} * var(--od-cell)))`;
    entry.timer && clearTimeout(entry.timer);
    entry.timer = setTimeout(settle, duration + 40);
  });
}

export function MilestoneTimeline(block, { editing = false } = {}) {
  const stops = (block.stops || []).filter((stop) => stop?.label && stop?.title);
  if (!stops.length) {
    return h('div', { class: 'milestones milestones--empty ph-root' }, 'No milestones yet.');
  }

  let active = 0;

  /* ------------------------------------------------------------- odometer */
  // Every stop's label is padded to one width so the cells never reflow — a
  // four-cell row that became three would shift the whole word sideways.
  const width = stops.reduce((max, stop) => Math.max(max, stop.label.length), 0);
  const glyphsOf = (stop) => stop.label.padEnd(width, ' ').slice(0, width).split('');

  const cells = glyphsOf(stops[0]).map(odometerCell);
  const odometer = h(
    'div',
    { class: 'milestones__odometer', 'aria-hidden': 'true' },
    ...cells.map((entry) => entry.cell),
  );

  /* ---------------------------------------------------------- detail panel */
  const detailTitle = h('h3', { class: 'milestones__title' });
  const detailList = h('ul', { class: 'milestones__bullets' });
  const detail = h('div', { class: 'milestones__detail' }, detailTitle, detailList);

  /* ------------------------------------------------------------------ rail */
  const dots = stops.map((stop, i) =>
    h('button', {
      class: 'milestones__dot',
      type: 'button',
      title: stop.label,
      'aria-label': `${stop.label} — ${stop.title}`,
      onclick: () => setStop(i),
    }, h('span', { class: 'milestones__dot-tick' })),
  );
  // Only the ends and the stop in hand are labelled. Thirteen labels along one
  // rail collide at any size the slide is actually shown at.
  const railLabels = h(
    'div',
    { class: 'milestones__rail-labels' },
    h('span', {}, stops[0].label),
    h('span', {}, stops[stops.length - 1].label),
  );
  const railFill = h('span', { class: 'milestones__rail-fill' });
  const rail = h(
    'div',
    { class: 'milestones__rail' },
    h('span', { class: 'milestones__rail-track' }, railFill),
    h('div', { class: 'milestones__dots' }, ...dots),
  );

  const counter = h('span', { class: 'milestones__counter' });

  /* ------------------------------------------------------------------ paint */
  function setStop(next, delta = next - active) {
    const target = Math.max(0, Math.min(stops.length - 1, next));
    const stop = stops[target];
    const forward = delta >= 0;

    /* Colour the digits that actually moved, and only those.
       One digit changing (2020 → 2021) marks the units in the logo's yellow.
       Two changing (2019 → 2020) reads as a bigger event, so the least
       significant one keeps the yellow and the one above it takes the green —
       one of each, as asked. Everything that stood still stays in the plain ink,
       which is what makes the moving digits legible as the thing that moved. */
    const nextGlyphs = glyphsOf(stop);
    const moved = nextGlyphs
      .map((glyph, i) => (cells[i].current !== glyph && DIGIT.test(glyph) ? i : -1))
      .filter((i) => i >= 0);
    const lastMoved = moved.length ? moved[moved.length - 1] : -1;

    /* The last stop is a word, not a year — NEXT, where there is no digit to
       tint. Its final letter carries the logo's own two colours instead, which
       marks the end of the walk as something other than one more year. */
    const wordStop = !nextGlyphs.some((glyph) => DIGIT.test(glyph));
    let lastLetter = -1;
    for (let i = nextGlyphs.length - 1; i >= 0; i--) {
      if (nextGlyphs[i].trim()) { lastLetter = i; break; }
    }

    cells.forEach((entry, i) => {
      entry.cell.classList.toggle('is-rolled-minor', i === lastMoved);
      entry.cell.classList.toggle('is-rolled-major', moved.includes(i) && i !== lastMoved);
      entry.cell.classList.toggle('is-logo-mark', wordStop && i === lastLetter);
    });

    nextGlyphs.forEach((glyph, i) => rollCell(cells[i], glyph, forward));

    // Retriggered by removing and re-adding the class, so stepping quickly does
    // not leave a panel that never faded in.
    detail.classList.remove('is-in');
    void detail.offsetWidth;
    detailTitle.textContent = stop.title;
    detailList.replaceChildren(
      ...stop.bullets.map((line, i) =>
        h('li', { style: { '--bullet-delay': `${0.06 * i + 0.12}s` } }, line),
      ),
    );
    detail.classList.add('is-in');

    dots.forEach((dot, i) => {
      dot.classList.toggle('is-active', i === target);
      dot.classList.toggle('is-past', i < target);
      dot.setAttribute('aria-current', i === target ? 'step' : 'false');
    });
    railFill.style.width = stops.length > 1 ? `${(target / (stops.length - 1)) * 100}%` : '100%';
    counter.textContent = `${String(target + 1).padStart(2, '0')} / ${stops.length}`;

    active = target;
  }

  /* ------------------------------------------------------------- the stepper
     Declining at either end is what hands the press back to the deck, so the
     presenter walks the years and then straight on to the next section without
     ever reaching for a different key. */
  if (!editing) {
    registerStepper((delta) => {
      const next = active + (delta > 0 ? 1 : -1);
      if (next < 0 || next >= stops.length) return false;
      setStop(next, delta);
      return true;
    });
  }

  const head = h(
    'div',
    { class: 'milestones__head' },
    h('div', { class: 'milestones__kicker' },
      icon('flag', { class: 'ic ic--sm' }),
      h('span', {}, block.kicker || 'Milestones'),
    ),
    block.title ? h('h2', { class: 'milestones__heading' }, block.title) : null,
    counter,
  );

  const dark = block.theme === 'dark';
  const photo = block.asset?.url;

  const root = h(
    'div',
    {
      class: ['milestones ph-root', dark ? 'milestones--dark' : ''].filter(Boolean).join(' '),
      tabindex: '0',
    },
    // Ground, in back-to-front order: the photograph, the scrim that buys the
    // type its contrast, then the sky over both.
    photo
      ? h('div', { class: 'milestones__photo', 'aria-hidden': 'true' },
          h('img', { src: photo, alt: block.alt || '' }))
      : null,
    dark ? h('div', { class: 'milestones__scrim', 'aria-hidden': 'true' }) : null,
    dark && block.sky !== false ? skyLayers() : null,
    h(
      'div',
      { class: 'milestones__inner' },
      head,
      h('div', { class: 'milestones__stage' }, odometer, detail),
      h('div', { class: 'milestones__foot' }, rail, railLabels),
    ),
  );

  /* ------------------------------------------------------------------ scroll
     A wheel gesture is not one event. A trackpad flick delivers dozens, and a
     mouse notch delivers one — so the gesture is gated on a cooldown rather
     than counted, and a year lands per intent instead of per tick. The default
     is prevented because the deck does not scroll: without that, a flick past
     the last stop would start dragging the page behind the slide. */
  let wheelAccum = 0;
  let wheelLock = 0;
  root.addEventListener('wheel', (event) => {
    const delta = event.deltaY || event.deltaX;
    if (!delta) return;
    event.preventDefault();

    const now = event.timeStamp;
    // Inside the cooldown the gesture is still arriving; swallow it so the tail
    // of a flick cannot bank credit toward the next year.
    if (now - wheelLock < WHEEL_COOLDOWN) {
      wheelAccum = 0;
      return;
    }
    // Direction changes start a new gesture rather than cancelling the old one.
    if (Math.sign(delta) !== Math.sign(wheelAccum)) wheelAccum = 0;
    wheelAccum += delta;
    if (Math.abs(wheelAccum) < WHEEL_THRESHOLD) return;

    const next = active + (wheelAccum > 0 ? 1 : -1);
    wheelAccum = 0;
    if (next < 0 || next >= stops.length) return; // let the ends sit still
    wheelLock = now;
    setStop(next, delta);
  }, { passive: false });

  setStop(0, 1);
  return root;
}
