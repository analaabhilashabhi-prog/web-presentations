import { h } from '../utils/dom.js';
import { upload } from '../utils/media.js';
import { registerStepper } from '../utils/slideSteps.js';
import { icon, hasIcon } from '../utils/icons.js';

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
const STACK_S = 0;   // of its scale it loses
/* Zero (2026-09-20, on request: "they are not perfectly aligned, like they are
   some cross — I want it very clean, neat"). A receding card used to turn
   -1.7 degrees per card behind, which is the reference's own flourish and is
   what put a slope on every edge showing above the front card: three cards
   deep, three top edges at three different angles, crossing. Square, the stack
   is concentric — same centre, same axis, each one a little smaller — and the
   slivers read as a stack rather than as a fan somebody knocked. */
const STACK_R = 0;       // degrees a receding card turns
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
/* How far below the pin a waiting card sits. This is a FALLBACK, not the
   figure: the real one is measured off the tallest card after mount, because
   a waiting card has to clear the card in front of it and the card in front is
   as tall as whatever is written on it. A constant was wrong the moment the
   cards became the slide — at 600 against a 643px card, the next card drew a
   14%-opacity wash over the bottom 43px of the one being read, and it will be
   wrong again the moment more information goes on a card. */
const ENTER_FALLBACK = 600;
const ENTER_GAP = 16;    // px of daylight between a card and the one waiting
/* Zero, and this is the shake.
 *
 * A composited layer can be TRANSLATED all day for nothing — the browser
 * rasterises the text once and moves the finished layer, so a fractional
 * offset is smooth. Changing its SCALE is a different thing: the raster is
 * invalidated and every glyph is laid out and drawn again at the new size,
 * every frame, for the whole of the travel. That is what "a bit shaky while
 * I'm scrolling" is, and no amount of rounding or easing fixes it, because the
 * jitter is the type being re-set rather than the box being moved.
 *
 * So NOTHING WITH VISIBLE COPY IS EVER SCALED HERE. A card on its way up
 * travels and nothing else. A card receding still scales — that is what makes
 * the stack concentric — but its copy is gone by then, which is what
 * `is-behind` is for, and a blank card has nothing to re-raster. */
const WAIT_S = 0;        // of its scale a waiting card holds back
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

  /* NO HEAD AND NO RAIL (2026-09-20, on request: "I don't want any list showing
     in the left hand side... that cards need to be very big, covering the
     maximum of the screen in the middle... only the cards need to be there").
     The slide is the stack and nothing else. The block still CARRIES `eyebrow`
     and `lead` — they are in the schema and in the published data — and nothing
     draws them; putting the head back is this comment's worth of code. `title`
     is still read, for the label a screen reader announces and for nothing
     else.

     What the rail did, the card does for itself: its corner reads "01 / 04", so
     a presenter still knows which of how many without a list beside it. */

  /* ----------------------------------------------------------------- stack */
  const stage = h('div', { class: 'ss-stage' });
  const cards = partners.map((p, i) => {
    const accent = p.color || '';
    /* Everything the card says goes in ONE wrapper, so `is-behind` fades one
       element rather than five. Animating opacity on five text blocks at once
       is five rasters to invalidate every frame of the travel; animating it on
       their parent is one layer sliding to zero. Measured: with this and the
       shadow together, p90 came back to the vsync floor, and neither on its
       own was enough. */
    const body = h('div', { class: 'ss-card__body' },
      /* --------------------------------------------------- the header row */
      /* THE CREDENTIAL ON THE LEFT AND THE BRAND ON THE RIGHT, which is the
         one place this card differs from the reference on purpose. The
         reference has a small pill at that corner and its own starburst at the
         other; here the left-hand thing is the partnership lockup the partner
         actually issued, because "shown clearly" is what was asked of it, and
         a badge is a picture rather than a word. */
      h('header', { class: 'ss-card__top' },
        p.logo
          ? h('span', { class: 'ss-card__badge' },
              h('img', {
                src: upload(p.logo),
                alt: p.logoAlt || `${p.name} partnership`,
                loading: 'eager',
                decoding: 'async',
                draggable: 'false',
              }))
          /* No lockup for this partner: what the badge WOULD have said, set in
             type on the same plate. GitHub has no partner badge anywhere in the
             library and its standing is printed on the pavilion signage, so
             this is the honest version of the same slot — never a badge drawn
             by hand to fill it. */
          : (p.note ? h('span', { class: 'ss-card__badge ss-card__badge--type' }, p.note) : null),
        p.mark
          ? h('span', { class: 'ss-card__mark' },
              h('img', {
                src: upload(p.mark),
                alt: p.markAlt || p.name,
                loading: 'eager',
                decoding: 'async',
                draggable: 'false',
              }))
          /* NO MARK, NO CORNER. The type fallback belongs on the badge
             plate, where it stands in for a picture nobody has. Here it
             would set the partner's name a second time, 40px above the
             62px headline that already says it — and a vendor mark is
             never drawn by hand to fill the gap. The corner is left
             empty until the file arrives. */
          : null,
      ),

      /* ----------------------------------------------------- the headline */
      /* Two spans, two colours, one line — the reference's own device. Both
         halves are supplied rather than split out of one string: a name with a
         full stop in it would break any rule that guessed where the join is.
         With neither supplied the partner's own name carries the line, so a
         card published before these fields existed still reads. */
      h('h3', { class: 'ss-card__head' },
        h('span', {}, p.headline || `${p.name}.`),
        p.headlineAccent ? h('span', { class: 'ss-card__head-accent' }, ` ${p.headlineAccent}`) : null,
      ),
      p.tagline ? h('p', { class: 'ss-card__lead' }, p.tagline) : null,

      /* ------------------------------------------------- the points, as cards */
      /* Numbered small cards rather than a two-column list of bullets, and
         the count goes to the stylesheet as `--ss-cols` so the row can be
         FIXED-WIDTH COLUMNS, CENTRED, rather than fractions of the row. On
         `1fr` a partner with three points would get cards twice the size of
         everybody else's, and a stack whose cards are not the same card with
         less on it stops reading as a stack. `auto-fit` is the other trap
         this deck already knows — it leaves a phantom column. */
      p.points.length
        ? h('ul', { class: 'ss-card__grid', style: { '--ss-cols': String(p.points.length) } },
            ...p.points.map((pt, j) => h('li', { class: 'ss-pt', style: { '--ss-j': String(j) } },
              h('span', { class: 'ss-pt__ic', 'aria-hidden': 'true' }, icon(pt.icon && hasIcon(pt.icon) ? pt.icon : 'dot', { class: 'ss-pt__glyph', size: 21 })),
              h('span', { class: 'ss-pt__n', 'aria-hidden': 'true' }, String(j + 1).padStart(2, '0')),
              pt.title ? h('h4', { class: 'ss-pt__t' }, pt.title) : null,
              pt.body ? h('p', { class: 'ss-pt__b' }, pt.body) : null,
            )))
        : null,

      /* ---------------------------------------------------------- the foot */
      /* A hairline and the counter. What the rail used to say, on the card:
         "01 / 04". `margin-top: auto` puts it on the floor of a card that is
         taller than its own copy, so a partner with three points ends on the
         same line as one with six rather than leaving its rule half way up. */
      h('footer', { class: 'ss-card__foot' },
        h('span', { class: 'ss-card__rule', 'aria-hidden': 'true' }),
        h('span', { class: 'ss-card__n' }, `${String(i + 1).padStart(2, '0')} / ${String(n).padStart(2, '0')}`),
      ),
    );
    const face = h('div', { class: 'ss-card__face' }, body);
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
  /* Measured, with the constant as the value until there is something to
     measure. `offsetHeight` rather than a rect: these cards are scaled and
     rotated, and an axis-aligned box means nothing on one. */
  let enterY = ENTER_FALLBACK;
  let lastFront = '';
  const measure = () => {
    const tallest = cards.reduce((m, el) => Math.max(m, el.offsetHeight), 0);
    if (!tallest) return;
    const next = tallest + ENTER_GAP;
    if (Math.abs(next - enterY) < 1) return;
    enterY = next;
    paint();
  };

  let pos = REDUCED?.matches ? 0 : -0.85;
  let target = 0;
  let last = 0;
  let raf = 0;

  const clamp = (x) => Math.min(n - 1, Math.max(0, x));

  const paint = () => {
    for (let i = 0; i < n; i++) {
      const d = i - pos;
      const el = cards[i];
      let tf;
      let op;
      if (d > 0) {
        /* Below the pin, on its way up. */
        const t = Math.min(1, d);
        /* Translate only — no `scale()` in the string even at 1, because a
           scale of exactly 1 still puts the element on the scaling path. */
        const sc = WAIT_S ? ` scale(${round(1 - t * WAIT_S)})` : '';
        tf = `translate3d(0, ${round(t * enterY)}px, 0)${sc}`;
        op = Math.max(0, 1 - t * (1 - WAIT_O)).toFixed(3);
      } else {
        const k = -d;
        const sc = STACK_S ? ` scale(${round(Math.max(0.5, 1 - k * STACK_S))})` : '';
        const rot = STACK_R ? ` rotate(${round(k * STACK_R)}deg)` : '';
        tf = `translate3d(0, ${round(-k * STACK_Y)}px, 0)${sc}${rot}`;
        op = Math.max(0, 1 - k * STACK_O).toFixed(3);
      }

      /* WRITE ONLY WHAT CHANGED. Assigning a style is a style mutation whether
         or not the value is different, and this loop touches four cards sixty
         times a second — so a value that has not moved since the last frame is
         four invalidations an hour of work for nothing. `visibility` in
         particular had been written every frame while changing perhaps twice in
         a whole travel. */
      if (tf !== el.__tf) { el.__tf = tf; el.style.transform = tf; }
      if (op !== el.__op) { el.__op = op; el.style.opacity = op; }
      const vis = (d > 1.4 || -d > DEEP + 0.6) ? 'hidden' : 'visible';
      if (vis !== el.__vis) { el.__vis = vis; el.style.visibility = vis; }
      /* A CARD BEHIND IS A BLANK CARD. Its own copy has to go, or the stack
         shows two numbers and two headings at once: a receding card scales
         about its top edge, so its content climbs toward that edge as it
         shrinks and comes out above the card in front — measured, card 1's
         "01 / 04" sat 6px clear of card 3's top edge and read as a ghost
         beside "03 / 04". Padding cannot fix it for every depth, because the
         climb grows with the scale.

         Toggled on the crossing, not written every frame: a `classList` call
         per card per frame is work for nothing, and the stylesheet's own
         transition is what makes it a fade rather than a cut. */
      /* The threshold is early on purpose. A receding card starts scaling the
         instant it leaves the front, so its copy has to be on its way out by
         then — at 0.35 of a card the type was still solid while the raster was
         already being rebuilt every frame, which is the shake this pass is
         about. */
      const behind = -d > 0.04;
      if (behind !== el.__behind) {
        el.__behind = behind;
        el.classList.toggle('is-behind', behind);
      }
    }

    /* A CUSTOM PROPERTY ON THE ROOT, WRITTEN EVERY FRAME, IS NOT FREE — and
       this one was the last thing between the travel and the vsync floor.
       Setting a custom property on an element invalidates style for its whole
       subtree, because anything under it might resolve a `var()` against it;
       the browser cannot know that nothing here does. Nothing in the
       stylesheet reads `--ss-front`. It exists so a check can ask which card
       is in front without reaching into this loop, so it is written only when
       the answer changes — which is about four times a travel rather than
       sixty times a second. */
    const front = String(Math.round(clamp(pos)));
    if (front !== lastFront) {
      lastFront = front;
      root.style.setProperty('--ss-front', front);
    }
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
  measure();
  /* Again once the marks have landed: a plate is 118px whether its image has
     arrived or not, but a partner whose copy wraps to another line is taller
     than it was at mount, and the card behind has to know. A picture that
     fails resolves the same as one that loads — there is nothing to wait for
     twice. */
  const marks = [...root.querySelectorAll('.ss-card__badge img, .ss-card__mark img')];
  let left = marks.length;
  if (!left) requestAnimationFrame(measure);
  marks.forEach((im) => {
    const done = () => { if (--left <= 0) requestAnimationFrame(measure); };
    if (im.complete) done();
    else { im.addEventListener('load', done, { once: true }); im.addEventListener('error', done, { once: true }); }
  });
  if (!REDUCED?.matches) kick();

  return root;
}

const round = (x) => Math.round(x * 100) / 100;
