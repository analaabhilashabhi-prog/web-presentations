import { h } from '../utils/dom.js';
import { upload } from '../utils/media.js';
import { registerStepper } from '../utils/slideSteps.js';
import { letterRevealPreset } from '../utils/letterReveal.js';

/**
 * The AI partners, as a stack of pinned cards.
 *
 * Ported from the reactbits Pro `ScrollStack` the way `AccordionGallery`,
 * `SkewedCarousel` and `TiltedTiles` were ported: the behaviour, not the
 * package. `npx shadcn add` has nothing here to add to — there is no
 * components.json, no package.json and no Tailwind in this project — and there
 * is no network at presentation time, so a component that pulls a registry at
 * install time and CSS at run time could not be shown in the room anyway. What
 * is kept is the thing the reference is for: cards that pin one over another,
 * the ones behind shrinking, turning and dissolving as the next comes over.
 *
 * WHY THIS IS NOT A REAL SCROLLER, WHICH IS THE ONE REAL DIFFERENCE
 * -----------------------------------------------------------------
 * The reference pins with `position: sticky` inside a tall scroller and reads
 * `scrollTop` on every scroll event. That cannot carry this deck's control
 * surface. Four keys run the whole deck: left and right walk what is *in* a
 * tab and spill into the next tab once it is spent. So the stack has to be
 * steppable card by card from the keyboard as well as scrollable — and two
 * gestures writing `scrollTop` is the loop this deck has already stalled on
 * once, where an eased step under a pixel asks for nothing and never lands.
 *
 * So there is one number. `pos` is the position in cards, eased toward
 * `target` in a rAF loop, and every card's transform is a pure function of
 * `i - pos`. The wheel writes `target`, the arrow keys write `target`, and
 * neither has an opinion about how the stack moves. Nothing here reads back a
 * value it wrote.
 *
 * THE GEOMETRY, IN ONE PLACE
 * --------------------------
 *   d = i - pos
 *   d > 0   the card is still below the pin, waiting, and rises as d falls.
 *   d <= 0  the card is pinned; k = -d is how many cards have come over it,
 *           and it lifts, shrinks, turns and dissolves by k.
 *
 * Because `pos` is clamped to the last card, the last card is always at k = 0
 * and never recedes — which is the one special case the reference writes out
 * by hand and this gets for nothing.
 *
 * Z-ORDER IS THE STACK AND IS NEVER TOUCHED MID-FLIGHT. A card's z-index is
 * its index, written once: the newest card is in front because it is later in
 * the list, and no transition can catch a layer being reassigned under it.
 */

const REDUCED = window.matchMedia?.('(prefers-reduced-motion: reduce)');

/* The pin. A card behind lifts by STACK_Y, loses STACK_S of its scale, turns
   STACK_R and takes STACK_B of blur for every card that has come over it.
   Measured against the reference's proportions rather than copied from its
   props: its cards are 60% of the frame and stack 30px apart, and these are
   that on a 1600-wide canvas. */
const STACK_Y = 34;      // px a pinned card lifts per card in front of it
const STACK_S = 0.055;   // of its scale it loses
const STACK_R = -1.7;    // degrees it turns
/* Zero, and measured to zero rather than chosen. A receding card was blurred
   by 2.4px, then by 2.0 and only two cards deep, and BOTH readings cost the
   same thing: p90 33.3ms against this harness's 16.7ms vsync floor — one frame
   in ten doubled for the whole of the travel — where every other reading, with
   the blur off, sat on the floor. The expense is blurring a 720px card at all
   while it moves, not how much or how many.

   Nothing is lost that the slide needs. A card behind is already lifted,
   scaled, turned and faded, which is four cues of depth, and only about 34px
   of each one is ever visible past the card in front. Set this above zero to
   have it back and accept the judder. */
const STACK_B = 0;       // px of blur on a receding card
const STACK_O = 0.26;    // of its opacity it loses
const DEEP = 4;          // cards deep, after which one is gone entirely
/* How many cards deep the blur goes, which is NOT how many are drawn.
   Ablated one suspect at a time on a fresh load, driving the stack end to end:
   the blur was the only thing that cost anything, and what it cost was the
   tail — p90 33.3ms against a 16.7ms vsync floor, one frame in ten doubled,
   while the median was the floor in every case including with everything
   removed. Blurring a 720px card is the expense, so it stops at the second
   card back; the third is already at 0.22 opacity and has nothing left to
   soften. (The median is not the measurement here. This harness's floor is
   16.7ms and a blank page reports 40 of 94 frames "over 16.7" at it.) */
const BLUR_DEEP = 2;

/* The approach. A waiting card sits ENTER_Y below the pin and is clipped by
   the stage, so it rises into the frame rather than fading in on the spot. */
const ENTER_Y = 400;
const WAIT_S = 0.04;     // of its scale a waiting card holds back
const WAIT_O = 0.14;     // the opacity it waits at

/* One card per notch, and the settle. TAU is the exponential time constant of
   the ease — small enough that a press lands inside a beat, long enough that
   the travel is watched rather than cut. */
const TAU = 0.22;
const WHEEL_GATE = 120;  // ms, the same gate the event wheel uses

export function ScrollStack(block = {}) {
  const partners = (block.partners || []).filter((p) => p && p.name);
  const root = h('section', {
    class: 'ss-root',
    tabindex: '0',
    'aria-label': block.title || 'AI Partners',
  });
  if (!partners.length) return root;

  const n = partners.length;

  /* The ground is not white, quite: two soft orbs in the organization's own
     measured colours, so the cards stand in light rather than on a sheet of
     paper. Placed in the band the cards do not cover — a blob under the content
     is a blob nobody sees. */
  root.append(
    h('span', { class: 'ss-orb ss-orb--a', 'aria-hidden': 'true' }),
    h('span', { class: 'ss-orb ss-orb--b', 'aria-hidden': 'true' }),
  );

  /* ------------------------------------------------------------------ head */
  const head = h('header', { class: 'ss-head' });
  if (block.eyebrow) {
    head.append(h('p', { class: 'ss-eyebrow' },
      h('span', { class: 'ss-eyebrow__mark', 'aria-hidden': 'true' }),
      h('span', {}, block.eyebrow)));
  }
  /* `.node`, not the return value. `letterReveal` hands back a CONTROLLER —
     { node, reveal, hide, rebuild } — and appending that object stringifies it
     to "[object Object]" beside an eyebrow with no title under it, which is
     exactly what the first cut of this slide drew. */
  head.append(letterRevealPreset(block.title || 'AI Partners', 'heading', {
    as: 'h2',
    className: 'ss-title',
    trigger: true,
  }).node);
  if (block.lead) head.append(h('p', { class: 'ss-lead' }, block.lead));

  /* The rail names every partner and says which one is in front. It is a
     control as well as an indicator — a presenter who wants the fourth card
     should not have to press three times to reach it. */
  const rail = h('ol', { class: 'ss-rail' });
  const railItems = partners.map((p, i) => {
    const b = h('button', {
      class: 'ss-rail__btn',
      type: 'button',
      onclick: () => goTo(i),
    },
      h('span', { class: 'ss-rail__n' }, String(i + 1).padStart(2, '0')),
      h('span', { class: 'ss-rail__name' }, p.name));
    const li = h('li', { class: 'ss-rail__row', style: { '--ss-i': String(i) } }, b);
    rail.append(li);
    return li;
  });
  head.append(rail);
  root.append(head);

  /* ----------------------------------------------------------------- stack */
  const stage = h('div', { class: 'ss-stage' });
  const cards = partners.map((p, i) => {
    const accent = p.color || '';
    const face = h('div', { class: 'ss-card__face' },
      h('div', { class: 'ss-card__top' },
        p.logo
          ? h('span', { class: 'ss-card__plate' },
              h('img', {
                src: upload(p.logo),
                alt: p.logoAlt || p.name,
                loading: 'eager',
                decoding: 'async',
                draggable: 'false',
              }))
          /* No artwork: the name in type on the same plate, never a mark drawn
             by hand. That is this deck's standing rule about vendor logos. */
          : h('span', { class: 'ss-card__plate ss-card__plate--type' }, p.name),
        h('span', { class: 'ss-card__n' }, String(i + 1).padStart(2, '0')),
      ),
      h('div', { class: 'ss-card__id' },
        p.note ? h('p', { class: 'ss-card__note' }, p.note) : null,
        h('h3', { class: 'ss-card__name' }, p.name),
        p.tagline ? h('p', { class: 'ss-card__tag' }, p.tagline) : null,
      ),
      /* The rule is a divider, so it is drawn only when there is something
         under it to divide from. A card that ends on a rule reads as a card
         somebody stopped writing. */
      p.points.length ? h('div', { class: 'ss-card__rule', 'aria-hidden': 'true' }) : null,
      p.points.length
        ? h('ul', { class: 'ss-card__points' },
            ...p.points.map((t) => h('li', {}, h('span', { class: 'ss-card__tick', 'aria-hidden': 'true' }), h('span', {}, t))))
        : null,
    );
    const card = h('article', {
      class: 'ss-card',
      style: {
        zIndex: String(10 + i),
        '--ss-i': String(i),
        ...(accent ? { '--ss-accent': accent } : {}),
      },
      'aria-label': p.name,
    }, face);
    stage.append(card);
    return card;
  });
  root.append(stage);

  /* ------------------------------------------------------------- the motion */
  /* Opens one card short of the first, so the stack arrives by rising into
     the pin rather than being there already. */
  let pos = REDUCED?.matches ? 0 : -0.85;
  let target = 0;
  let last = 0;
  let raf = 0;

  const clamp = (x) => Math.min(n - 1, Math.max(0, x));

  const paint = () => {
    for (let i = 0; i < n; i++) {
      const d = i - pos;
      const el = cards[i];
      if (d > 0) {
        /* Below the pin, on its way up. It also holds back a little of its
           scale, because at full size and a quarter of its opacity the next
           card reads as a second card on the slide rather than as the one
           waiting to come over. */
        const t = Math.min(1, d);
        el.style.transform = `translate3d(0, ${round(t * ENTER_Y)}px, 0) scale(${round(1 - t * WAIT_S)})`;
        el.style.opacity = Math.max(0, 1 - t * (1 - WAIT_O)).toFixed(3);
        el.style.filter = 'none';
      } else {
        const k = -d;
        el.style.transform =
          `translate3d(0, ${round(-k * STACK_Y)}px, 0) scale(${round(Math.max(0.5, 1 - k * STACK_S))}) rotate(${round(k * STACK_R)}deg)`;
        el.style.opacity = Math.max(0, 1 - k * STACK_O).toFixed(3);
        /* `none`, never `blur(0px)`. A zero-radius blur is still a filter,
           and a filter still builds a compositing context around the element
           it is on — which is the whole of what was measured out above. */
        const b = STACK_B > 0 && k > 0.02 ? round(Math.min(BLUR_DEEP, k) * STACK_B) : 0;
        el.style.filter = b > 0 ? `blur(${b}px)` : 'none';
      }
      /* `visibility` rather than `display`: a card taken out of the flow would
         be re-laid-out on the way back, and this one has nothing to re-lay. */
      el.style.visibility = (d > 1.4 || -d > DEEP + 0.6) ? 'hidden' : 'visible';
    }

    const front = Math.round(clamp(pos));
    railItems.forEach((li, i) => li.classList.toggle('is-on', i === front));
    root.style.setProperty('--ss-front', String(front));
  };

  const tick = (now) => {
    raf = 0;
    /* The deck rebuilds its DOM on every navigation, and this loop runs for as
       long as it is asked to — without this it would outlive the slide it
       drives and go on costing frames on every other tab. */
    if (!root.isConnected) return;
    const gap = last ? now - last : 0;
    /* A gap wider than a few frames is the loop restarting after a pause and
       is worth one nominal frame; anything else is real elapsed time. */
    const dt = gap > 0 && gap < 200 ? Math.min(0.05, gap / 1000) : 0.016;
    last = now;

    const rest = target - pos;
    if (Math.abs(rest) < 0.0008) {
      if (pos !== target) { pos = target; paint(); }
      last = 0;
      return;                       // settled: stop asking for frames
    }
    pos += rest * (1 - Math.exp(-dt / TAU));
    paint();
    raf = requestAnimationFrame(tick);
  };

  const kick = () => {
    /* `last` is deliberately NOT reset here. It is reset where the loop stops,
       so a frame's worth of time is the time the frame actually took — reset
       on every kick, every frame is worth a nominal 16ms whatever the browser
       spent, and the stack then moves at the speed of the machine. */
    if (!raf) raf = requestAnimationFrame(tick);
  };

  function goTo(i) {
    const next = clamp(i);
    if (next === target) return;
    target = next;
    if (REDUCED?.matches) { pos = target; paint(); return; }
    kick();
  }

  /* --------------------------------------------------------------- the wheel */
  /* No fixed cooldown fits both a mouse and a trackpad. A trackpad gesture is
     a push and then a tail of ever-smaller events that can run on for a
     second; a mouse spun quickly sends discrete notches 150ms apart. The gate
     is disarmed after a step and re-arms only on a FRESH event — one after
     120ms of quiet, or one at least as large as the one before it — so the
     decay of the last push can never step again. Lifted from `EventWheel`,
     where it was measured. */
  let armed = true;
  let lastWheelAt = 0;
  let lastWheelMag = 0;
  root.addEventListener('wheel', (event) => {
    const mag = Math.abs(event.deltaY) || Math.abs(event.deltaX);
    if (!mag) return;
    const now = performance.now();
    const quiet = now - lastWheelAt > WHEEL_GATE;
    if (quiet || mag >= lastWheelMag) armed = true;
    lastWheelAt = now;
    lastWheelMag = mag;
    const dir = (event.deltaY || event.deltaX) > 0 ? 1 : -1;
    const next = clamp(target + dir);
    /* Only swallow the gesture while the stack still has somewhere to go, so a
       wheel at either end is left to whatever else wants it. */
    if (next === target) return;
    event.preventDefault();
    event.stopPropagation();
    if (!armed) return;
    armed = false;
    goTo(next);
  }, { passive: false });

  /* -------------------------------------------------------------- the keys */
  /* Through `slideSteps`, never bound on this root. Seven slides used to bind
     the arrows themselves and call `stopPropagation`, which made them the only
     slides in the deck the forward key could not leave. This is the only route
     in: it returns true while it consumed the press and false when the stack
     is spent, and the deck turns the tab. */
  registerStepper((delta) => {
    const next = clamp(target + (delta > 0 ? 1 : -1));
    if (next === target) return false;
    goTo(next);
    return true;
  });

  /* A press anywhere on the slide arms the root for the keyboard, the same as
     every other section that takes a gesture. */
  root.addEventListener('pointerdown', () => {
    if (document.activeElement !== root) root.focus({ preventScroll: true });
  });

  paint();
  if (!REDUCED?.matches) kick();

  return root;
}

const round = (x) => Math.round(x * 100) / 100;
