import { h } from '../utils/dom.js';
import { upload } from '../utils/media.js';
import { registerStepper } from '../utils/slideSteps.js';
import { pointerHold } from '../utils/pointerHold.js';

/**
 * Trusted By — the institutions' marks as a fan of cards in depth.
 *
 * Built to a reference image the user supplied: a row of tall cards standing
 * in perspective, the one in the middle square-on and full size, its
 * neighbours turned toward it, set back and dimmed, the ones beyond them more
 * so. Its cards carry a photograph, a name and a paragraph of travel copy;
 * these carry a logo on a white plate and the institution's name under it, and
 * nothing else — "that's all I want". The reference stands on a dark map; this
 * stands on Torii's light sheet with its two measured colours washing behind.
 *
 * ONE NUMBER MOVES, and everything on the slide is a pure function of it.
 * `pos` is the row's position in cards, eased toward `target` in a rAF loop,
 * and every card is placed each frame from its distance to `pos` taken the
 * SHORT WAY ROUND — the row is a ring with no ends, so one step back from the
 * first card is the last and the row is never seen to stop. The wheel writes
 * `target`, the arrow keys write it through `slideSteps`, a press on a card
 * writes it, and the autoplay writes it; none of them has an opinion about how
 * the row moves, which is what makes it move one way. Nothing here reads back
 * a value it wrote, and no CSS transition touches a card's transform — a
 * transition cannot be interrupted mid-flight without a jump, and a wheel is
 * nothing but interruptions.
 *
 * "EVERY LOGO CLEARLY": the plate is 400x320 and the mark is `contain`ed in
 * it with 30px of air, sized by the plate and never stretched; the card in
 * the middle is at scale 1 and its neighbours only to 0.86, so a mark is
 * legible two cards out and full size the moment its card arrives. Nothing
 * is blurred — a `filter` on a moving card is the expense this deck measured
 * on the scroll stack and took off; depth is turn, setback and dimming.
 */

/* The card, in canvas px. The reference's is about 23% of its frame's width
   and 70% of its height; this is 400x480 on a 1600x860 canvas, shorter than
   the reference's because there is no paragraph under the name. */
const CARD_W = 400;
/* 400, not the 480 of the first cut: the card is THE MARK ALONE now
   (2026-09-22, "only the logo on the cards, that's it"), so there is no name
   under the plate and a tall card would be a mark over a blank band. Square,
   and the plate is the whole card. The name is still stored and still read
   by a screen reader (`aria-label`, `alt`); it is simply not drawn. */
const CARD_H = 400;

/* The fan. A card `d` from the front stands STEP_X px across, turns TURN
   degrees toward the middle, sets back SETBACK px in Z (the perspective does
   the shrinking) and loses DIM of its opacity — per card, up to the limits. */
/* 375, not the 340 a first cut had. At 340 the front card lay 70px over its
   neighbour's inner edge and the neighbour 60 over the one beyond, and on a
   card whose plate has 30px of air that is the first letters of the mark
   covered — "ge of Engineering" where the plate said "College". At 375 the
   overlap is 35px and inside the air, so every mark on screen reads whole
   before its card comes to the front ("I should be able to see every logo
   clearly"); the outermost pair are cut by the frame instead, as the
   reference's are. */
const STEP_X = 375;        // px across per card
const TURN = 22;           // degrees of turn per card, toward the middle
const TURN_MAX = 52;
const SETBACK = 230;       // px back in Z per card
const DIM = 0.22;          // of opacity lost per card
const SHOWN = 2.7;         // cards either side that are drawn at all

/* The motion. TAU is the ease's time constant — a press lands inside a beat,
   a travel is watched rather than cut. */
const TAU = 0.26;
const WHEEL_GATE = 120;    // ms, the fresh-event gate the event wheel measured

/* Plays itself, slowly, unless a hand is on the slide. 6.5s a card, up from
   2.8 (2026-09-21, "the logos were changing too fast… wait for some time so
   that we can explain") — long enough to say a sentence about an institution
   before the next one arrives — and the opening scene is held for five
   seconds before the first turn. */
/* Then "reduce that time a bit": 4.6s. */
const AUTO_EVERY = 4600;
const FIRST_AUTO = 3800;

const REDUCED = window.matchMedia?.('(prefers-reduced-motion: reduce)');

export function TrustFan(block = {}) {
  const logos = (block.logos || []).filter((l) => l && l.src).slice(0, 24);
  const root = h('section', { class: 'tf-root', tabindex: '0', 'aria-label': block.title || 'Trusted by' });
  if (!logos.length) return root;

  const n = logos.length;
  const base = String(block.base || '').replace(/^\/+|\/+$/g, '');
  const urlOf = (l) => upload(base ? `${base}/${l.src}` : l.src);

  if (block.glow !== 'none') {
    root.append(h('div', {
      class: 'tf-glow', 'aria-hidden': 'true',
      style: { '--tf-glow': block.glow || null, '--tf-glow-2': block.glow2 || null },
    },
    h('span', { class: 'tf-blob tf-blob--a' }),
    h('span', { class: 'tf-blob tf-blob--b' })));
  }

  /* The stage carries the perspective; every card is a child of it, so they
     share one vanishing point. */
  const stage = h('div', { class: 'tf-stage' });
  root.append(stage);

  const cards = logos.map((l, i) => {
    const card = h('article', {
      class: 'tf-card',
      style: { '--tf-i': String(i), width: `${CARD_W}px`, height: `${CARD_H}px` },
      'aria-label': l.name || '',
    },
    h('div', { class: 'tf-card__face' },
      h('div', { class: 'tf-card__plate' },
        h('img', {
          src: urlOf(l),
          alt: l.name || '',
          loading: 'eager',
          decoding: 'async',
          draggable: 'false',
        }))));
    /* No `.tf-card__body`: the name and the note are not drawn, on request.
       The rules for them stay in the stylesheet for the day they come back. */
    /* A press on a card brings it to the front — the short way round. */
    card.addEventListener('click', () => {
      userMoved();
      goTo(target + shortest(i - target));
    });
    stage.append(card);
    return card;
  });

  // ------------------------------------------------------------- the motion
  /* Signed distance from a to the nearest copy of b on a ring of n. */
  const wrap = (x) => ((x % n) + n) % n;
  const shortest = (delta) => {
    let d = wrap(delta);
    if (d > n / 2) d -= n;
    return d;
  };

  /* Opens with the row stacked on the front card and dealt out of it, which
     is the entrance: `pos` is right, and each card's own `--tf-dealt` runs
     0 → 1 over the first second, scaling its offsets in. */
  let pos = 0;
  let target = 0;
  let last = 0;
  let raf = 0;
  const t0 = performance.now();
  const DEAL_MS = REDUCED?.matches ? 0 : 1100;
  const ease = (t) => 1 - Math.pow(1 - t, 3);

  const paint = (now) => {
    const dealt = DEAL_MS ? ease(Math.min(1, Math.max(0, (now - t0 - 120) / DEAL_MS))) : 1;
    for (let i = 0; i < n; i++) {
      const el = cards[i];
      const d = shortest(i - pos) * dealt;
      const a = Math.abs(d);
      if (a > SHOWN) {
        if (el.__vis !== 'hidden') { el.__vis = 'hidden'; el.style.visibility = 'hidden'; }
        continue;
      }
      if (el.__vis !== 'visible') { el.__vis = 'visible'; el.style.visibility = 'visible'; }
      const x = d * STEP_X;
      const ry = Math.max(-TURN_MAX, Math.min(TURN_MAX, -d * TURN));
      const z = -a * SETBACK;
      const tf = `translate3d(${x.toFixed(2)}px, 0, ${z.toFixed(1)}px) rotateY(${ry.toFixed(2)}deg)`;
      if (tf !== el.__tf) { el.__tf = tf; el.style.transform = tf; }
      const op = Math.max(0.28, 1 - a * DIM).toFixed(3);
      if (op !== el.__op) { el.__op = op; el.style.opacity = op; }
      /* Nearer is on top. Written only when the integer changes. */
      const zi = String(100 - Math.round(a * 10));
      if (zi !== el.__zi) { el.__zi = zi; el.style.zIndex = zi; }
      const front = a < 0.5;
      if (front !== el.__front) { el.__front = front; el.classList.toggle('is-front', front); }
    }
  };

  const tick = (now) => {
    raf = 0;
    /* The deck rebuilds its DOM on every navigation; a loop that outlived its
       slide would go on costing frames on every other tab. */
    if (!root.isConnected) return;
    const gap = last ? now - last : 0;
    /* A gap wider than a few frames is the loop restarting after a pause and
       is worth one nominal frame; anything else is real elapsed time. */
    const dt = gap > 0 && gap < 200 ? Math.min(0.05, gap / 1000) : 0.016;
    last = now;
    const rest = target - pos;
    const dealing = now - t0 < DEAL_MS + 200;
    if (Math.abs(rest) < 0.0008 && !dealing) {
      if (pos !== target) { pos = target; }
      paint(now);
      last = 0;
      return;                       // settled: stop asking for frames
    }
    pos += rest * (1 - Math.exp(-dt / TAU));
    paint(now);
    raf = requestAnimationFrame(tick);
  };
  const kick = () => { if (!raf) raf = requestAnimationFrame(tick); };

  function goTo(t) {
    if (t === target) return;
    target = t;
    if (REDUCED?.matches) { pos = target; paint(performance.now()); return; }
    kick();
  }

  // --------------------------------------------------------------- the wheel
  /* No fixed cooldown fits both a mouse and a trackpad. The gate is disarmed
     after a step and re-arms only on a FRESH event — one after 120ms of quiet,
     or one at least as large as the one before it — so the decay of a
     trackpad's tail can never step again. Lifted from `EventWheel`. */
  let armed = true;
  let lastWheelAt = 0;
  let lastWheelMag = 0;
  root.addEventListener('wheel', (event) => {
    const mag = Math.abs(event.deltaY) || Math.abs(event.deltaX);
    if (!mag) return;
    event.preventDefault();
    event.stopPropagation();
    const now = performance.now();
    if (now - lastWheelAt > WHEEL_GATE || mag >= lastWheelMag) armed = true;
    lastWheelAt = now;
    lastWheelMag = mag;
    if (!armed) return;
    armed = false;
    userMoved();
    goTo(target + ((event.deltaY || event.deltaX) > 0 ? 1 : -1));
  }, { passive: false });

  // ---------------------------------------------------------------- the keys
  /* Through `slideSteps`, never bound on this root. A ring has no ends, so
     "spent" is counted: forward is spent after one lap, and back from the
     start leaves the tab the way it does on a row with real ends. */
  let steps = 0;
  registerStepper((delta) => {
    if (delta > 0) {
      if (steps >= n) return false;
      steps += 1; userMoved(); goTo(target + 1); return true;
    }
    if (steps <= 0) return false;
    steps -= 1; userMoved(); goTo(target - 1); return true;
  });
  root.addEventListener('pointerdown', () => {
    if (document.activeElement !== root) root.focus({ preventScroll: true });
  });

  // ------------------------------------------------------------ the autoplay
  let timer = 0;
  let autoAt = 0;
  const hold = pointerHold(root, { idle: 3000, onRelease: () => schedule(AUTO_EVERY) });
  const schedule = (ms) => {
    if (REDUCED?.matches) return;
    clearTimeout(timer);
    autoAt = performance.now() + ms;
    timer = setTimeout(autoTick, ms);
  };
  const autoTick = () => {
    timer = 0;
    /* Checked when the timer FIRES, never when it is set. */
    if (!root.isConnected) return;
    if (hold.held) { schedule(700); return; }
    const wait = autoAt - performance.now();
    if (wait > 40) { timer = setTimeout(autoTick, wait); return; }
    goTo(target + 1);
    schedule(AUTO_EVERY);
  };
  const userMoved = () => { if (!REDUCED?.matches) schedule(AUTO_EVERY + 1400); };

  /* HOW MANY, under the fan (2026-09-21, "mention how many trusted partners").
     The figure is the length of the list and nothing else — it is never typed,
     so it cannot disagree with the cards. The words after it are the block's
     `countLabel`, which are the user's own ("trusted partners"). Centred in
     the band under the front card, above the presenter bar. */
  if (block.countLabel) {
    root.append(h('p', { class: 'tf-count' },
      h('span', { class: 'tf-count__n' }, String(n)),
      h('span', { class: 'tf-count__label' }, block.countLabel)));
  }

  paint(performance.now());
  kick();
  schedule(FIRST_AUTO);
  return root;
}
