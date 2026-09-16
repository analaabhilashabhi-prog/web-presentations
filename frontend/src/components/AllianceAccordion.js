import { h } from '../utils/dom.js';
import { icon } from '../utils/icons.js';

/**
 * The MOUs, as an accordion.
 *
 * The row opens on a card with no photograph on it at all — a heading and a
 * line of prose that arrive in reading order. Move onto any other card and it
 * runs out to full width: its photograph, and over the photograph a black plate
 * carrying the institute's name and what was signed with it. Take the pointer
 * off the row and the intro card comes back, animating again.
 *
 * Ported from the reactbits `AccordionGallery` sketch (React + GSAP). What
 * changed, and why:
 *
 *   - React and GSAP are gone. The deck ships no runtime dependencies and there
 *     is no build step, so the sketch's two would have had to be vendored into
 *     the page for one section. They earn nothing here: every tween in that
 *     timeline starts at time 0 with the same duration and easing, which is the
 *     definition of a CSS transition. The caption's stagger is a
 *     transition-delay, and so is the intro card's line-by-line reveal.
 *   - Because of that, the *only* per-panel state JS writes is one class and two
 *     numbers — the tilt angle and the parallax shift, which both depend on how
 *     far a panel sits from the open one. Grayscale, dimming, every reveal and
 *     the flex weights are all reached from `.is-open` in the stylesheet.
 *   - `--ag-gray` / `--ag-dim` were tweened as custom properties. A plain custom
 *     property does not interpolate without `@property` registration, so the
 *     sketch's dimming only animated under GSAP's own ticker. Here the dim is a
 *     real element whose opacity transitions, and grayscale is a `filter` on a
 *     class — both interpolate on their own.
 *   - A panel's picture is optional. The sketch requires one per panel; here an
 *     agreement whose photograph has not arrived yet still gets a card, set as
 *     type on a plate in its own colour, and the photograph drops in later
 *     without the layout moving.
 *   - Panels take an `assetId` resolved server-side, not a URL. The sketch's
 *     picsum.photos images would be blank in the room: there is no network at
 *     presentation time.
 *   - Closed panels keep their name, set vertically up the slat. The sketch
 *     hides every caption but the open one, which reads fine on a web page you
 *     are pointing at and badly from the back of a room, where the rest of the
 *     row becomes anonymous grey bars.
 *   - `height: 460px` became the slide's own height. A fixed row would letterbox
 *     on one display and overflow on the next.
 *
 * Four ways to drive it, because a presenter's hand is not always on the mouse:
 * hover, the arrow buttons, the wheel, and the arrow keys.
 *
 * Kept intact: the expand-ratio maths, the parallax drift, the tilt on closed
 * panels, the desaturation, the caption stagger and the mobile fallback.
 */

/* The sketch's defaults, kept so a block that omits a field behaves as the
   component it was ported from. */
const DURATION = 0.6;   // seconds
const PARALLAX = 0.5;
const TILT = 8;         // degrees on closed panels
const STAGGER = 0.06;   // seconds between the caption's bar and its text

/* One notch of a mouse wheel is one card. A trackpad delivers a hundred events
   for the gesture a mouse delivers in one, so the step is gated on a cooldown
   rather than counted — the same arrangement the milestone timeline uses, and
   for the same reason. */
const WHEEL_THRESHOLD = 24;
const WHEEL_COOLDOWN = 480;

export function AllianceAccordion(block = {}) {
  const panels = (block.panels || []).slice(0, 8);
  const count = panels.length;

  const root = h('section', {
    class: 'aa-root',
    style: { '--aa-dur': `${DURATION}s`, '--aa-stagger': `${STAGGER}s` },
  });
  if (!count) return root;

  /* The heading sits above the row rather than on a card of its own. An earlier
     cut put it on the first panel, which meant the title was only on screen
     while nothing was being shown — the moment a presenter pointed at an
     agreement, the slide lost its name. */
  if (block.eyebrow || block.title || block.subtitle) {
    root.append(h(
      'header',
      { class: 'aa-head' },
      block.eyebrow ? h('p', { class: 'aa-eyebrow', text: block.eyebrow }) : null,
      block.title ? h('h2', { class: 'aa-title', text: block.title }) : null,
      block.subtitle ? h('p', { class: 'aa-sub', text: block.subtitle }) : null,
    ));
  }

  const row = h('div', {
    class: `aa-row${block.grayscale === false ? ' aa-row--colour' : ''}`,
    role: 'list',
    'aria-label': block.title || 'Memoranda of understanding',
  });

  /* The share of the row the open panel takes, turned into a flex weight.
     With `flex-basis: 0`, a panel's width is its grow over the row's total, so
     for the open one to measure exactly `r` the weight has to be
     `r(n-1)/(1-r)` — which is what this solves. Clamped for the degenerate
     cases the arithmetic cannot survive: `r` of 1 divides by zero, and a single
     panel has no siblings to take the remainder. */
  const ratio = Math.min(Math.max(Number(block.expandRatio) || 0.52, 0.2), 0.9);
  const grow = count > 1 ? (ratio * (count - 1)) / (1 - ratio) : 1;
  root.style.setProperty('--aa-grow', String(round(grow)));

  const els = [];

  panels.forEach((panel, i) => {
    const intro = panel.kind === 'intro';
    const el = h(panel.href ? 'a' : 'div', {
      class: `aa-panel${intro ? ' aa-panel--intro' : ''}`,
      role: 'listitem',
      tabindex: '0',
      href: panel.href || null,
      'aria-label': intro ? panel.heading : panel.label,
      // Its own colour, for the plate an agreement wears until its photograph
      // arrives. Unset falls through to the section's ink rather than to
      // nothing, so a panel is never a hole in the row.
      style: { '--aa-i': String(i), '--aa-tint': panel.tint || null },
    });

    const frame = h('span', { class: 'aa-panel__frame' });
    if (intro) {
      /* Nothing in the frame but the ground. The intro card is type on ink by
         definition — giving it the plate treatment put a monogram of its own
         slat behind its heading. */
    } else if (panel.asset?.url) {
      frame.append(h(
        'span',
        { class: 'aa-panel__media' },
        h('img', {
          src: panel.asset.url,
          alt: panel.alt || panel.label || '',
          draggable: 'false',
          loading: i < 3 ? 'eager' : 'lazy',
        }),
      ));
    } else {
      /* No photograph yet. A plate in the partner's own colour with its initials
         on it — not a grey rectangle, and not a stock picture standing in for a
         document nobody has photographed. */
      frame.append(h(
        'span',
        { class: 'aa-panel__plate', 'aria-hidden': 'true' },
        h('span', { class: 'aa-panel__mono', text: panel.mono || monogram(panel.label || panel.slat) }),
      ));
    }
    // Two layers, not one. The gradient is legibility and is always there; the
    // flat dim is what separates a closed panel from the open one, and is the
    // only part of the two that moves.
    frame.append(h('span', { class: 'aa-panel__scrim', 'aria-hidden': 'true' }));
    frame.append(h('span', { class: 'aa-panel__dim', 'aria-hidden': 'true' }));
    el.append(frame);

    /* The name up the slat — on every panel, the intro card included. It is the
       only thing identifying a closed panel from across a room, and the intro is
       closed for as long as the presenter is pointing at anything else: without
       one it became an anonymous dark bar the moment it lost the pointer. */
    const slat = panel.slat || panel.label || panel.heading;
    if (slat) el.append(h('span', { class: 'aa-panel__slat', 'aria-hidden': 'true', text: slat }));

    if (intro) {
      /* Type only, no picture. Each line carries its own delay so they arrive in
         reading order, and because the whole thing is reached from `.is-open` it
         plays again every time the card comes back. */
      el.append(h(
        'span',
        { class: 'aa-intro', 'aria-hidden': 'true' },
        panel.kicker ? h('span', { class: 'aa-intro__kicker', text: panel.kicker }) : null,
        panel.heading ? h('span', { class: 'aa-intro__head', text: panel.heading }) : null,
        panel.body ? h('span', { class: 'aa-intro__body', text: panel.body }) : null,
      ));
    } else {
      /* The black plate the institute's name sits on. A gradient alone is not
         enough once a photograph is bright at the bottom — a name over a lit
         banner is unreadable however deep the scrim goes. */
      el.append(h(
        'span',
        { class: 'aa-panel__cap', 'aria-hidden': 'true' },
        h('span', { class: 'aa-panel__bar' }),
        h(
          'span',
          { class: 'aa-panel__lines' },
          panel.kicker ? h('span', { class: 'aa-panel__kicker', text: panel.kicker }) : null,
          panel.label ? h('span', { class: 'aa-panel__text', text: panel.label }) : null,
          panel.note ? h('span', { class: 'aa-panel__note', text: panel.note }) : null,
        ),
      ));
    }

    /* A panel that links somewhere is still a panel first: the first click opens
       it and the second follows the link. Without this, pointing at a closed
       panel on a touch screen leaves the slide. */
    el.addEventListener('click', (event) => {
      if (i !== active) { event.preventDefault(); setActive(i); }
    });
    el.addEventListener('mouseenter', () => setActive(i));
    el.addEventListener('focus', () => setActive(i));

    els.push(el);
    row.append(el);
  });

  root.append(row);

  /* The intro card is where the row rests. It wins over a stored index, and it
     is what the row returns to whenever the pointer leaves. */
  const hasIntro = panels.some((p) => p.kind === 'intro');
  const home = hasIntro
    ? panels.findIndex((p) => p.kind === 'intro')
    : Math.min(Math.max(Number(block.defaultIndex) || 0, 0), count - 1);
  let active = home;

  /* The media box is wider than the panel it sits in, which is what gives the
     drift something to move through: at the panel's own width the image would
     run out of frame the moment it shifted. 1.22 is the sketch's figure. */
  let mediaSize = 320;

  // ------------------------------------------------------------- the controls
  const readout = h('span', { class: 'aa-nav__count' });
  const step = (d) => setActive((active + d + count) % count);
  const mkBtn = (dir, label, glyph) => h(
    'button',
    {
      class: 'aa-nav__btn',
      type: 'button',
      'aria-label': label,
      onclick: (event) => { event.stopPropagation(); step(dir); },
    },
    icon(glyph, { class: 'ic' }),
  );
  /* The controls live inside the row, not beside it: the pointer crossing onto
     a button has to not count as leaving the cards, or the row would go home
     between the press and the release. */
  row.append(h(
    'div',
    { class: 'aa-nav' },
    mkBtn(-1, 'Previous agreement', 'chevron-left'),
    readout,
    mkBtn(1, 'Next agreement', 'chevron-right'),
  ));

  // ------------------------------------------------------------------ driving
  /* Off the row, home. This is the behaviour the section is built around: the
     presenter shows an agreement, moves the pointer away, and the slide puts its
     own title back up without being asked. */
  row.addEventListener('mouseleave', () => setActive(home));

  let wheelAccum = 0;
  let wheelLock = 0;
  row.addEventListener('wheel', (event) => {
    const delta = event.deltaY || event.deltaX;
    if (!delta) return;
    // The deck does not scroll; without this a flick past the last card starts
    // dragging the page behind the slide.
    event.preventDefault();
    const now = event.timeStamp;
    // Inside the cooldown the gesture is still arriving; swallow it so the tail
    // of a flick cannot bank credit toward the next card.
    if (now - wheelLock < WHEEL_COOLDOWN) { wheelAccum = 0; return; }
    if (Math.sign(delta) !== Math.sign(wheelAccum)) wheelAccum = 0;
    wheelAccum += delta;
    if (Math.abs(wheelAccum) < WHEEL_THRESHOLD) return;
    wheelAccum = 0;
    wheelLock = now;
    step(delta > 0 ? 1 : -1);
  }, { passive: false });

  row.addEventListener('keydown', (event) => {
    const forward = event.key === 'ArrowRight' || event.key === 'ArrowDown';
    const back = event.key === 'ArrowLeft' || event.key === 'ArrowUp';
    if (!forward && !back) return;
    event.preventDefault();
    const next = (active + (forward ? 1 : -1) + count) % count;
    setActive(next);
    els[next].focus();
  });

  // ----------------------------------------------------------------- painting
  function paint() {
    els.forEach((el, i) => {
      const open = i === active;
      el.classList.toggle('is-open', open);
      if (open) el.setAttribute('aria-current', 'true');
      else el.removeAttribute('aria-current');

      // Closed panels turn away from the open one; the open one is flat.
      el.style.setProperty('--aa-rot', `${open ? 0 : i < active ? TILT : -TILT}deg`);

      // Capped at a panel and a half either side: past that the shift is larger
      // than the overhang and the image's edge walks into the frame.
      const drift = Math.max(-1.5, Math.min(1.5, active - i));
      el.style.setProperty('--aa-shift', `${open ? 0 : round(drift * PARALLAX * mediaSize * 0.06)}px`);
    });
    readout.textContent = `${active + 1} / ${count}`;
  }

  function setActive(i) {
    if (i === active) return;
    active = i;
    paint();
  }

  function measure() {
    const total = row.clientWidth;
    if (!total) return;
    const gap = parseFloat(getComputedStyle(row).columnGap) || 0;
    const usable = Math.max(total - gap * (count - 1), 120);
    mediaSize = Math.max(140, usable * ratio * 1.22);
    root.style.setProperty('--aa-media', `${Math.round(mediaSize)}px`);
    paint();
  }

  /* Measured from the element rather than at build time: the block is built
     before it is in the document, where every width is 0. The observer is left
     attached, as the other sections leave theirs — it is collected with the row
     it is watching when the slide is replaced. */
  requestAnimationFrame(() => {
    measure();
    if (typeof ResizeObserver === 'function') new ResizeObserver(measure).observe(row);
  });

  paint();
  return root;
}

/* The initials on a plate. Two letters where the name has a second word worth
   taking one from — "Automation Anywhere" is AUA, "o9 Solutions, Inc." is O9,
   because the words that only ever say what kind of organisation it is carry
   nothing that tells two partners apart. */
function monogram(name) {
  const words = String(name || '').replace(/[^\p{L}\p{N} ]/gu, ' ').trim().split(/\s+/);
  if (!words[0]) return '';
  const skip = /^(the|of|and|inc|ltd|pvt|llc|institute|university|solutions|cybersecurity)$/i;
  const second = words.slice(1).find((w) => !skip.test(w));
  return (words[0].slice(0, 2) + (second ? second[0] : '')).slice(0, 3).toUpperCase();
}

const round = (n) => Math.round(n * 1000) / 1000;
