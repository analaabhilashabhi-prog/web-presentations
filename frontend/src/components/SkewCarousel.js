import { h } from '../utils/dom.js';
import { icon } from '../utils/icons.js';
import { upload } from '../utils/media.js';
import { deepen, rgba } from '../utils/theme.js';
import { letterRevealPreset, fitToWidth } from '../utils/letterReveal.js';
import { registerStepper } from '../utils/slideSteps.js';

/**
 * The team, as a skewed ribbon of cards.
 *
 * A row of leaning slabs runs across the slide. The one at the centre stands
 * square and full size; the further out a card is, the more it turns away, sinks
 * and falls back, so the row reads as depth rather than as a strip. Scroll it and
 * the whole ribbon shears into a diagonal for as long as it is moving, then
 * settles flat on the card it lands on. Behind all of it, that person's name is
 * set across the wall.
 *
 * Ported from the reactbits Pro `SkewedCarousel` sketch. What changed, and why:
 *
 *   - React, shadcn and Tailwind are gone. The deck ships no runtime
 *     dependencies, has no build step and no network at presentation time, so
 *     `npx shadcn add` has nothing to add to: there is no components.json and no
 *     package.json to install into, and a Tailwind class does nothing against a
 *     stylesheet that does not define one. The behaviour is what was wanted and
 *     the behaviour is what was taken.
 *   - The sketch drives its transforms off the page's own scroll position. A
 *     slide does not scroll — it is one screen, and the deck takes the wheel for
 *     its own navigation — so the ribbon carries its own offset, and the wheel,
 *     a drag, the arrow keys and the two buttons all write to it.
 *   - It skews every card by a constant. Here the constant skew is on the slab
 *     and the *photograph inside is counter-skewed*, because these are
 *     portraits: a leaning frame is a design, a leaning face is a fault. The
 *     part that moves with the scroll is a shear of the whole ribbon, where
 *     there is nothing to distort.
 *   - Its cards are image fills. These are cut-out figures on transparency, so a
 *     card is a lit plate with a person standing on it — and the plate is lit at
 *     the top and deep at the bottom, because every one of them wears the same
 *     red polo and against a flat red the shirt disappears into the ground.
 *
 * One element per member, not a duplicated marquee track: the offset wraps into
 * a half-lap either side, so a card leaving the left edge is the same element
 * that arrives at the right. Nothing is cloned and nothing has to be kept in
 * step.
 */

/* The card, and the pitch from one to the next. */
const CARD_W = 300;
const CARD_H = 404;
const GAP = 28;
const STEP = CARD_W + GAP;

/* How the row falls away from the centre: the distance over which a card gives
   up all of its scale and all of its turn. A little over three cards, so the
   effect is a slope across the whole row rather than a spotlight on one. Held
   as a multiple of the pitch, because the pitch is measured. */
const REACH_CARDS = 3.1;
const ROT = 19;          // degrees of turn at full reach
const SINK = 30;         // px a card at full reach drops
const DEPTH = 210;       // px it is pushed back
const SCALE_DROP = 0.2;
const DIM = 0.52;        // how far it is dimmed at full reach

/* The settle. EASE_TAU is the time constant of the glide toward the target —
   short enough that a press lands before the presenter says the next name.
   ENTER_TAU is the slower one, used once, for the ribbon's arrival. */
const EASE_TAU = 0.115;  // seconds
const ENTER_TAU = 0.46;
const ENTER_FROM = 4.6;  // cards' worth of travel the ribbon arrives across

/* A wheel or a drag moves the ribbon freely; it lands on a card once the
   gesture has been quiet for this long. */
const SNAP_IDLE = 190;   // ms
const WHEEL_GAIN = 1.25;
const FLICK = 0.16;      // seconds of a drag's last velocity carried on release

/* The shear, and the heat in the ground behind it, both come off the speed. Both
   are capped: past this the faces start to lean and the red starts to glare. */
const SHEAR_AT = 2600;   // px/s that reads as full speed
const SHEAR_MAX = 3.4;   // degrees

/* The air kept above and below the row, and the smallest the cards may be
   squeezed to before the row would rather be clipped than illegible. */
const AIR = 54;
const MIN_FIT = 0.6;

const REDUCED = window.matchMedia?.('(prefers-reduced-motion: reduce)');

export function SkewCarousel(block = {}) {
  const members = (block.members || []).filter((m) => m && (m.photo || m.name));
  const count = members.length;

  const tint = block.tint || '#D91823';
  const root = h('section', {
    class: 'sk-root',
    style: {
      '--sk-red': tint,
      '--sk-deep': deepen(tint, 0.02),
      '--sk-mid': deepen(tint, 0.055),
      '--sk-glow': rgba(tint, 0.5),
      '--sk-veil': rgba(tint, 0.16),
      '--sk-card-w': `${CARD_W}px`,
      '--sk-card-h': `${CARD_H}px`,
    },
  });
  if (!count) return root;

  /* The ground. Two washes and a vignette, kept off the root itself so the heat
     can be turned up while the ribbon is moving without touching anything the
     content is painted on. */
  root.append(h('div', { class: 'sk-wash', 'aria-hidden': 'true' }));

  /* The name across the wall. It is rebuilt rather than retyped, because the
     reveal lives on the element and only a new node replays it. */
  const ghost = h('div', { class: 'sk-ghost', 'aria-hidden': 'true' });
  root.append(ghost);

  root.append(h(
    'header',
    { class: 'sk-head' },
    block.eyebrow ? h('p', { class: 'sk-eyebrow', text: block.eyebrow }) : null,
    block.title ? h('h2', { class: 'sk-title', text: block.title }) : null,
    block.lead ? h('p', { class: 'sk-lead', text: block.lead }) : null,
  ));

  const track = h('div', { class: 'sk-track' });
  const stage = h('div', {
    class: 'sk-stage',
    role: 'list',
    tabindex: '0',
    'aria-label': block.title || 'The team',
  }, track);

  /* One slot per member is enough while the row is longer than the stage. It is
     not, for a small team, where the wrap would leave a hole either side — so
     the list is repeated until it covers a slide and a half: the same card,
     drawn twice, a whole screen apart. */
  const reps = Math.max(1, Math.ceil(2400 / Math.max(count * STEP, 1)));
  const slots = count * reps;

  /* The pitch, the lap and the parking distance are all measured rather than
     fixed, because a slide in presentation mode is the screen's shape and not
     16:9 — a row sized to the 860-row admin canvas is clipped top and bottom on
     a display that hands the section fewer rows than that. `fit` writes the card
     size onto the root and these three follow it. */
  let step = STEP;
  let lap = slots * STEP;
  let park = 1220;

  /* Where a slot sits once the ribbon has settled on its first card, wrapped
     into the half-lap either side of the centre. */
  const atRest = (j) => ((j * STEP + lap / 2) % lap + lap) % lap - lap / 2;

  /* The arrival runs outward from the middle of the row rather than along it.
     By slot order the card that ends up one place to the *left* of centre is the
     last one in the list, so it faded up a second after its neighbour — which
     reads as a card that failed to load rather than as a sweep. */
  const rank = new Map();
  [...Array(slots).keys()]
    .sort((a, b) => Math.abs(atRest(a)) - Math.abs(atRest(b)))
    .forEach((j, r) => rank.set(j, r));

  const cards = [];
  for (let j = 0; j < slots; j++) {
    const m = members[j % count];
    const dim = h('span', { class: 'sk-card__dim', 'aria-hidden': 'true' });
    const slab = h(
      'span',
      { class: 'sk-card__slab' },
      h('span', { class: 'sk-card__plate', 'aria-hidden': 'true' }),
      m.photo
        ? h('span', { class: 'sk-card__shot' }, h('img', {
          src: upload(m.photo),
          alt: m.name || '',
          draggable: 'false',
          loading: j < 6 ? 'eager' : 'lazy',
          decoding: 'async',
          onerror: (event) => event.currentTarget.remove(),
        }))
        : null,
      h(
        'span',
        { class: 'sk-card__foot' },
        h('span', { class: 'sk-card__name', text: m.name || '' }),
        m.role ? h('span', { class: 'sk-card__role', text: m.role }) : null,
      ),
      dim,
    );
    const el = h('div', {
      class: 'sk-card',
      role: 'listitem',
      style: { '--sk-i': String(rank.get(j) ?? j) },
    }, slab);
    /* A card is a way to reach the person on it: pressing one walks the ribbon
       to it, rather than doing nothing, which is what a row of faces under a
       cursor invites. */
    el.addEventListener('click', () => goTo(j));
    track.append(el);
    cards.push({ el, dim });
  }

  root.append(stage);

  // ------------------------------------------------------------- the controls
  const readout = h('span', { class: 'sk-nav__count' });
  const mkBtn = (dir, label, glyph) => h('button', {
    class: 'sk-nav__btn',
    type: 'button',
    'aria-label': label,
    onclick: (event) => { event.stopPropagation(); walk(dir); },
  }, icon(glyph, { class: 'ic' }));
  /* Inside the stage, for the reason the accordion's are: the pointer crossing
     onto a button must not read as leaving the ribbon. */
  stage.append(h(
    'div',
    { class: 'sk-nav' },
    mkBtn(-1, 'Previous', 'chevron-left'),
    readout,
    mkBtn(1, 'Next', 'chevron-right'),
  ));

  // --------------------------------------------------------------- the motion
  let target = 0;
  let offset = REDUCED?.matches ? 0 : -ENTER_FROM * STEP;
  let warm = !REDUCED?.matches;
  let freeUntil = 0;
  let raf = 0;
  let last = 0;
  let ghostName = null;
  let unfit = null;

  const wrap = (d) => ((d + lap / 2) % lap + lap) % lap - lap / 2;
  const indexAt = (o) => ((Math.round(o / step) % count) + count) % count;

  /* The cards, sized to the stage the display actually left. Everything that is
     measured in pitches — the offset, the target, the lap — is carried across
     the change by card index, so a resize lands on the same person rather than
     somewhere between two of them. */
  function fit() {
    const box = stage.clientHeight;
    if (!box) return;
    const k = Math.max(MIN_FIT, Math.min(1, (box - AIR * 2) / CARD_H));
    const w = Math.round(CARD_W * k);
    root.style.setProperty('--sk-card-w', `${w}px`);
    root.style.setProperty('--sk-card-h', `${Math.round(CARD_H * k)}px`);
    const was = step;
    step = w + Math.round(GAP * k);
    lap = slots * step;
    park = Math.max(760, stage.clientWidth / 2 + step);
    if (step !== was) {
      const ratio = step / was;
      target = Math.round(target / was) * step;
      offset *= ratio;
    }
  }

  function kick() {
    if (raf) return;
    raf = requestAnimationFrame(frame);
  }

  function frame(now) {
    raf = 0;
    /* Real elapsed time, not a nominal frame. `kick` is called from the end of
       this function, so resetting the clock there made every frame worth 16ms
       whatever the browser had actually spent on it — and the whole arrival then
       ran at the speed of the machine rather than at the speed it was written
       for. A gap wider than a few frames is the loop starting again after a
       pause, and is worth one nominal frame rather than the whole wait. */
    const gap = last ? now - last : 0;
    const dt = gap > 0 && gap < 200 ? Math.min(0.05, gap / 1000) : 0.016;
    last = now;

    if (freeUntil && now > freeUntil) {
      target = Math.round(target / step) * step;
      freeUntil = 0;
    }

    /* The arrival's long time constant is for the travel, not for the last few
       pixels of it: an exponential settling from four cards away to under half a
       pixel at tau 0.46 takes the better part of four seconds, which the room
       reads as a section that has not finished loading. The fast constant takes
       over once it is close. */
    if (warm && Math.abs(target - offset) < 60) warm = false;
    const before = offset;
    offset += (target - offset) * (1 - Math.exp(-dt / (warm ? ENTER_TAU : EASE_TAU)));
    const vel = (offset - before) / dt;

    paint(vel);

    if (Math.abs(target - offset) > 0.4 || freeUntil) {
      kick();
    } else {
      offset = target;
      warm = false;
      paint(0);
    }
  }

  function paint(vel) {
    const reach = step * REACH_CARDS;
    for (let j = 0; j < slots; j++) {
      const d = wrap(j * step - offset);
      const card = cards[j];
      if (Math.abs(d) > park) {
        if (card.el.style.visibility !== 'hidden') card.el.style.visibility = 'hidden';
        continue;
      }
      if (card.el.style.visibility) card.el.style.visibility = '';
      const t = Math.max(-1, Math.min(1, d / reach));
      const a = Math.abs(t);
      card.el.style.transform = `translate3d(${d.toFixed(1)}px, ${(SINK * a).toFixed(1)}px, `
        + `${(-DEPTH * a).toFixed(1)}px) rotateY(${(-ROT * t).toFixed(2)}deg) `
        + `scale(${(1 - SCALE_DROP * a).toFixed(4)})`;
      card.dim.style.opacity = (DIM * a).toFixed(3);
      card.el.classList.toggle('is-now', a < 0.06);
    }

    /* The shear and the heat, both off the speed. The ribbon is only ever a
       diagonal while it is moving; at rest it lies flat, which is what makes the
       movement read as movement rather than as a crooked row. */
    const speed = Math.min(1, Math.abs(vel) / SHEAR_AT);
    root.style.setProperty('--sk-shear', `${(Math.sign(vel) * speed * SHEAR_MAX).toFixed(2)}deg`);
    root.style.setProperty('--sk-heat', speed.toFixed(3));

    const i = indexAt(offset);
    readout.textContent = `${i + 1} / ${count}`;
    paintGhost(members[i]?.name || '');
  }

  /* The wall's own headline. Rebuilt on a change and guarded on the name, or
     every notch of the wheel would replay the reveal on a name that had not
     changed. */
  function paintGhost(name) {
    if (name === ghostName) return;
    ghostName = name;
    if (unfit) { unfit(); unfit = null; }
    ghost.textContent = '';
    if (!name) return;
    const node = letterRevealPreset(name, 'lead', {
      as: 'span',
      className: 'sk-ghost__word',
      trigger: true,
    }).node;
    ghost.append(node);
    /* Sized to the wall rather than set: "Harshavardhini" is three times the
       width of "Kiran" at the same size, and a headline whose size changes with
       the name reads as a fault. */
    unfit = fitToWidth(node, { fill: 0.92, min: 64, max: 252, probe: 120 });
  }

  function goTo(j) {
    /* To the nearest instance of that card, not to its slot: with the list
       repeated, the copy the presenter pressed may be a whole lap away. */
    target = offset + wrap(j * step - offset);
    freeUntil = 0;
    warm = false;
    kick();
  }
  const walk = (dir) => { goTo(Math.round(target / step) + dir); };

  // --------------------------------------------------------------- driving it
  let wheelLock = 0;
  stage.addEventListener('wheel', (event) => {
    const delta = event.deltaX || event.deltaY;
    if (!delta) return;
    // The deck does not scroll; without this a flick drags the page behind it.
    event.preventDefault();
    if (REDUCED?.matches) {
      if (event.timeStamp - wheelLock < 420) return;
      wheelLock = event.timeStamp;
      walk(delta > 0 ? 1 : -1);
      return;
    }
    warm = false;
    target += delta * WHEEL_GAIN;
    freeUntil = event.timeStamp + SNAP_IDLE;
    kick();
  }, { passive: false });

  /* The arrows are not bound here (2026-09-18). Four keys run the deck — left
     and right walk this row and then spill into the next tab, up and down
     change tab outright — and both of those are PresentPage's decisions to
     make. The ribbon registers a stepper below instead of swallowing the key.

     THE ROW HAS NO ENDS, so "spent" has to be defined rather than detected:
     one lap. A press is consumed until the presenter has passed every member
     once, counted from wherever the slide was entered, and the press after
     that turns the tab. Without a count this row would take the forward key
     for ever and the deck could never be walked with it. Going back the way
     you came gives the count back, so a correction never costs a tab. */
  let walked = 0;
  registerStepper((delta) => {
    const lap = Math.max(1, count);
    const next = walked + delta;
    /* The slide is entered at position 0 and that counts as the first member,
       so back from there leaves the tab exactly as it does on a row with real
       ends — a presenter should not have to learn that some rows go backwards
       for a lap and others do not. Forward is spent after one lap. */
    if (next > lap - 1 || next < 0) return false;
    walked = next;
    walk(delta);
    return true;
  });

  /* Dragging. The ribbon follows the hand exactly — no easing while a pointer is
     down, or the cards lag behind the finger holding them — and the release
     carries the last measured velocity on before it lands. */
  let drag = null;
  stage.addEventListener('pointerdown', (event) => {
    if (event.button > 0 || REDUCED?.matches) return;
    if (event.target.closest('.sk-nav')) return;
    drag = { x: event.clientX, from: target, at: event.timeStamp, vel: 0 };
    stage.setPointerCapture(event.pointerId);
    stage.classList.add('is-dragging');
  });
  stage.addEventListener('pointermove', (event) => {
    if (!drag) return;
    const next = drag.from - (event.clientX - drag.x);
    const dt = Math.max(1, event.timeStamp - drag.at);
    drag.vel = (next - target) / dt * 1000;
    drag.at = event.timeStamp;
    target = next;
    offset = next;
    freeUntil = event.timeStamp + SNAP_IDLE;
    warm = false;
    kick();
  });
  const endDrag = (event) => {
    if (!drag) return;
    target += Math.max(-900, Math.min(900, drag.vel * FLICK));
    freeUntil = event.timeStamp + 60;
    drag = null;
    stage.classList.remove('is-dragging');
    kick();
  };
  stage.addEventListener('pointerup', endDrag);
  stage.addEventListener('pointercancel', endDrag);

  /* Measured from the element rather than at build time: the block is built
     before it is in the document, where every height is 0. The observer is left
     attached, as the other sections leave theirs — it is collected with the
     stage it is watching when the slide is replaced. */
  requestAnimationFrame(() => {
    fit();
    offset = REDUCED?.matches ? 0 : -ENTER_FROM * step;
    paint(0);
    kick();
    if (typeof ResizeObserver === 'function') {
      new ResizeObserver(() => { fit(); paint(0); kick(); }).observe(stage);
    }
  });
  paint(0);

  return root;
}
