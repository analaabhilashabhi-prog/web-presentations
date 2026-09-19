import { h } from '../utils/dom.js';
import { upload } from '../utils/media.js';
import { openLightbox } from './Lightbox.js';
import { letterRevealPreset } from '../utils/letterReveal.js';
import { pointerHold } from '../utils/pointerHold.js';

/**
 * A headline over a fan of cards rising out of the bottom edge.
 *
 * Built to a layout the user supplied as a reference: eyebrow, a two-line
 * headline, two pills, and under them a hand of rounded cards arching up from
 * the floor of the frame — the middle one highest and square on, the rest
 * stepping down and leaning away, each cut off by the bottom edge so only its
 * top half is ever shown.
 *
 * Three things move, and each is on its own layer, because they would otherwise
 * be three rules fighting over one `transform`:
 *
 *   - `.cf-card` carries the fan itself — the step across, the drop, the lean.
 *     It is written once by JS and never animated.
 *   - `.cf-card__rise` carries the entrance, the cards coming up from below the
 *     edge in a stagger that runs outward from the middle.
 *   - `.cf-card__face` carries the hover, which lifts one card clear of its
 *     neighbours.
 *
 * The headline uses the deck's own letter reveal, the same one the slide titles
 * and the ribbon's names use.
 *
 * A card opens in the shared lightbox — the viewer the galleries already use,
 * with its own arrows and Escape.
 *
 * A block may also carry a `deck`: a second, smaller set of photographs behind
 * one more pill. Pressed, a panel comes up over the hand and the deck is dealt
 * — every card starts on one pile in the middle, then they spread into a
 * hand of their own, each leaning a little more than the last, so all of them
 * are in view at once and any one lifts on hover. A card opens the viewer on
 * itself with the whole deck behind it.
 */

/* The hand. A card is cut off by the bottom edge, so `CARD_H` is its whole
   height and `SINK` is how much of it is below the floor. */
/* Taken off the reference by proportion: the hand is wider than the frame, so
   the cards at both ends are cut by the side edges — which is what makes it read
   as a hand rather than as a row that happens to fit.
   The card is square, which the reference's is not, and that is deliberate:
   most of these photographs are square, so a square card shows them with
   nothing cropped at all. A portrait card took a quarter of the height off
   every one of them, and on a slide whose whole job is the pictures that is
   the wrong trade. It also sits much further out of the floor than the first
   cut did — 84% of itself rather than 71% — so what is on a card can actually
   be read from the back of a room. */
const CARD_W = 500;
const CARD_H = 500;
const SINK = 80;
/* The hand's shape is fixed at its edges, however many cards are in it: the
   outermost card's centre stands `OUTER_X` from the middle, dropped by
   `OUTER_DROP` and leaning `OUTER_ANGLE`, and the cards between are placed by
   how far out they are on a 0..1 scale. Nine cards reproduce the numbers this
   was first tuned to (a step of 200, 34px × a^1.55 of drop, 3.8° a card);
   thirteen fit the same frame by standing closer. Up to a step of `MAX_SPREAD`
   a small hand is not stretched to the edges. */
const OUTER_X = 875;        // 800 + a quarter of a card: the end cards are cut by the sides, as the reference's are
/* The hand turns on its own (2026-09-18, on request: "automatic circular
   scrolling… every photo should be shown… avoid abrupt transitions"). One card
   every TURN_S seconds, as a continuous drift rather than a step per card: a
   fan is an arc and a step would read as a flick, where a drift reads as the
   hand being turned. The wrap is the thing that has to be hidden — a card
   leaving one end re-enters at the other — so a card fades out over the last
   FADE_AT of its travel and is back at full opacity before it is anywhere near
   the middle. */
const REDUCED = window.matchMedia?.('(prefers-reduced-motion: reduce)');

const TURN_S = 3.0;    // seconds a card takes to hand on
const FADE_AT = 0.78;  // of the way out, where a card starts to go

const OUTER_DROP = 291;
const OUTER_ANGLE = 15.2;   // degrees
const DROP_POW = 1.55;
const MAX_SPREAD = 200;

/* The deck is a ring, seen at an angle, turning for ever (2026-09-19, on
   request: "they were not stacked correctly... make it a circle, circle like
   shape... give some space and every photos need to be edge to edge... let them
   circle loop in loop").
 *
 * It was a hand: every card at one point, leaning about a pivot 900px below the
 * frame. Ten of them at 8 degrees apiece put 104px between neighbours that are
 * 300px wide, so two thirds of every photograph was under the next one — which
 * is exactly what "not stacked correctly" describes. Spreading a hand far enough
 * that ten 300px cards touch needs 25 degrees a card, which is 249 degrees of
 * arc: at that point it is not a hand any more, it is a circle. So it is one.
 *
 * Upright cards on an ellipse, which is a circle lying away from you. The two
 * radii are not a shape chosen by eye — RX is what makes the photographs the
 * size they are, and RY is what keeps them off the floor:
 *
 *   - Edge to edge is RX's job. At the front of the ring a card stands at x=0
 *     and its neighbours at sin(36 degrees) x RX = 0.588 x RX either side. At
 *     RX 560 that is 329 against cards 320 and 307 wide, so 15px of daylight
 *     shows between them — a seam, not a gap, and nothing overlapping. Round
 *     the sides of the ring they crowd and overlap, which is what the side of
 *     a ring does and what the depth ordering is for.
 *   - RY is bounded above and below. The ring stands 233px above its centre and
 *     300 below it, so at 140 the whole of it is 533 tall and fits between the
 *     head and the Back button on the 860 canvas AND on a filled 900 screen,
 *     where the presenter bar takes 96 of the extra 40 back.
 *
 * A card's scale is its depth: the whole ramp from the far side of the ring to
 * the near one, so the ring reads as a ring rather than as an oval of equal
 * cards. Nothing is cropped by it — the card is square and so is the box.
 */
const DECK_W = 320;          // the nearest card; every other is this x its scale
const DECK_H = 320;
const DECK_RX = 560;         // the ring, across
const DECK_RY = 140;         // the ring, deep — the amount it is lying away
const DECK_FAR = 0.58;       // the scale of the card at the back of the ring
const DECK_FAR_FADE = 0.78;  // and its opacity

export function CardFan(block = {}) {
  const cards = (block.cards || []).filter((c) => c && c.src);
  const root = h('section', { class: 'cf-root' });
  if (!cards.length) return root;

  const base = String(block.base || '').replace(/^\/+|\/+$/g, '');
  const urlOf = (card) => upload(base ? `${base}/${card.src}` : card.src);
  const deck = (block.deck && Array.isArray(block.deck.photos)) ? block.deck.photos.filter((p) => p && p.src) : [];

  /* Three soft orbs under the hand, so the cards are standing in light rather
     than on a sheet of white. Kept very low on purpose: the point is that the
     ground stops being flat, not that anybody notices a gradient. Three
     elements rather than one layer of three gradients, because each drifts on
     its own slow cycle and a background's positions cannot be animated
     smoothly without registering the property. */
  if (block.glow !== 'none') {
    root.append(h(
      'div',
      { class: 'cf-glow', 'aria-hidden': 'true', style: block.glow ? { '--cf-glow': block.glow } : null },
      h('span', { class: 'cf-orb cf-orb--a' }),
      h('span', { class: 'cf-orb cf-orb--b' }),
      h('span', { class: 'cf-orb cf-orb--c' }),
    ));
  }

  // ------------------------------------------------------------------ the head
  const head = h('header', { class: 'cf-head' });
  /* The section's own wordmark, above the buttons (2026-09-18, on request).
     It is the first thing on the slide and the only thing on it that is not a
     photograph or a control, which is why it can be as large as it is.

     NOT inverted: this mark is three colours — a green N, an orange T and
     SQUARE in black — on this slide's pale ground. Project Street's is turned
     white because it is black on a dark film; the treatment follows the ground
     each mark stands on, not a house rule. */
  if (block.logo) {
    head.append(h('img', {
      class: 'cf-mark',
      src: upload(block.logo),
      alt: block.logoAlt || 'NT Square',
      loading: 'eager',
      decoding: 'async',
    }));
  }
  if (block.eyebrow) {
    head.append(h(
      'p',
      { class: 'cf-eyebrow' },
      h('span', { class: 'cf-eyebrow__mark', 'aria-hidden': 'true' }),
      h('span', { text: block.eyebrow }),
    ));
  }
  /* One reveal per line, and the delays run on, so the second line arrives
     after the first has finished rather than alongside it. */
  const lines = String(block.title || '').split('\n').filter(Boolean);
  if (lines.length) {
    const title = h('h2', { class: 'cf-title', 'aria-label': lines.join(' ') });
    lines.forEach((line, i) => {
      const node = letterRevealPreset(line, 'heading', {
        as: 'span',
        className: 'cf-title__line',
        trigger: true,
      }).node;
      node.style.setProperty('--cf-line', String(i));
      title.append(node);
    });
    head.append(title);
  }

  const buttons = (block.buttons || []).slice(0, 2);
  const cta = h('div', { class: 'cf-cta' });
  buttons.forEach((b, i) => cta.append(h('button', {
    class: `cf-btn cf-btn--${b.kind === 'ghost' ? 'ghost' : 'solid'}`,
    type: 'button',
    style: { '--cf-btn-i': String(i) },
    onclick: () => open(Math.max(0, Math.min(Number(b.target) || 0, cards.length - 1))),
  }, b.label || 'View')));
  /* The deck's own pill, after the reference's two: outlined, with a small
     count, so it reads as a door to something rather than as a third call. */
  if (deck.length) {
    cta.append(h('button', {
      class: 'cf-btn cf-btn--ghost cf-btn--deck',
      type: 'button',
      style: { '--cf-btn-i': String(buttons.length) },
      onclick: () => openDeck(),
      /* NO COUNT (2026-09-18, on request: only the two buttons and no other
         text). It read as a door with a number on it; the door is enough. */
    }, h('span', { text: block.deck.label || 'More photographs' })));
  }
  if (cta.childElementCount) head.append(cta);
  root.append(head);

  // ------------------------------------------------------------------ the fan
  const fan = h('div', { class: 'cf-fan' });
  const centre = (cards.length - 1) / 2;
  const spread = centre > 0 ? Math.min(MAX_SPREAD, OUTER_X / centre) : 0;
  const reach = centre > 0 ? Math.min(1, (spread * centre) / OUTER_X) : 0; // how far out the end cards really stand

  /* Every card's element, so the hand can be re-placed each frame. The geometry
     below is the same as it always was; what changed is that `d` is measured
     from a moving middle instead of a fixed one. */
  const slots = [];

  cards.forEach((card, i) => {
    const face = h(
      'div',
      { class: 'cf-card__face' },
      h('img', {
        src: urlOf(card),
        alt: card.name || '',
        draggable: 'false',
        /* Every one of them, not the near three: they all pass through the
           middle now, and a lazy card arriving as it gets there is the
           "abrupt" this was asked to avoid. */
        loading: 'eager',
        decoding: 'async',
        onerror: (event) => event.currentTarget.closest('.cf-card')?.remove(),
      }),
    );
    const rise = h('div', { class: 'cf-card__rise' }, face);
    const el = h('button', {
      class: 'cf-card',
      type: 'button',
      'aria-label': card.name || `Photograph ${i + 1}`,
      style: {
        /* The entrance runs outward from the middle rather than left to right:
           the card the eye lands on first is the one that arrives first. */
        '--cf-delay': `${Math.round(Math.abs(i - centre) * 85)}ms`,
      },
      onclick: () => open(i),
    }, rise);
    slots.push(el);
    fan.append(el);
  });

  /* The hand, placed from a middle that moves. `d` wraps into the half-lap
     either side, so the card leaving one end is the same element arriving at
     the other — nothing is cloned, which is the ribbon's trick and for the same
     reason: one element per photograph is one thing to keep in step. */
  const n = cards.length;
  const wrap = (x) => ((x + n / 2) % n + n) % n - n / 2;

  function place(offset) {
    for (let i = 0; i < n; i++) {
      const d = wrap(i - offset - centre);
      const a = Math.abs(d);
      const t = centre > 0 ? Math.min(1, (a / centre) * reach) : 0;
      const el = slots[i];
      /* The step and the lean are linear in the distance from the middle; the
         drop is not, which is what bends the row into an arc. */
      el.style.transform = `translate3d(${round(d * spread)}px, ${round((t ** DROP_POW) * OUTER_DROP)}px, 0)`
        + ` rotate(${round(Math.sign(d) * t * OUTER_ANGLE)}deg)`;
      /* The middle card is in front and every step out is one layer back, so
         the hand overlaps the way a hand of cards does. */
      el.style.zIndex = String(100 - Math.round(a * 2));
      /* Out at the ends, where the wrap happens. Ramped rather than switched:
         a card that vanished at a boundary is the abrupt transition this is
         here to prevent. */
      const edge = centre > 0 ? Math.min(1, Math.max(0, (a / centre - FADE_AT) / (1 - FADE_AT))) : 0;
      el.style.opacity = (1 - edge).toFixed(3);
      el.style.pointerEvents = edge > 0.85 ? 'none' : 'auto';
    }
  }

  place(0);
  root.append(fan);

  /* ------------------------------------------------------------- the turning */
  let offset = 0;
  let last = 0;
  let raf = 0;

  function frame(now) {
    raf = 0;
    /* The deck rebuilds its DOM on every navigation and this loop never settles
       of its own accord, so without this it would outlive the slide it turns. */
    if (!root.isConnected) return;
    const gap = last ? now - last : 0;
    const dt = gap > 0 && gap < 200 ? Math.min(0.05, gap / 1000) : 0.016;
    last = now;
    if (!grip.held) {
      offset = (offset + dt / TURN_S) % n;
      place(offset);
    }
    raf = requestAnimationFrame(frame);
  }
  if (!REDUCED?.matches && n > 1) raf = requestAnimationFrame(frame);

  /* The pointer anywhere over the hand holds it: a presenter pointing at a
     photograph should not have it walk out from under them. */
  const grip = pointerHold(fan, { onRelease: () => { last = 0; } });

  /* The shared viewer — the one the galleries already use, with its own arrows
     and its own way out. */
  function open(index) {
    openLightbox(cards.map((c) => ({ url: urlOf(c), name: c.name || '' })), index);
  }

  // ----------------------------------------------------------------- the deck
  let panel = null;
  function openDeck() {
    if (panel) return;
    const n = deck.length;
    const hand = h('div', { class: 'cf-deck__hand', role: 'list' });
    const items = deck.map((p) => ({ url: urlOf(p), name: p.name || '' }));
    const dealt = [];
    deck.forEach((p, i) => {
      const el = h('button', {
        class: 'cf-deck__card',
        type: 'button',
        role: 'listitem',
        'aria-label': p.name || `Photograph ${i + 1}`,
        /* The entrance is staggered round the ring rather than outward from a
           pile: each card arrives at the seat it is going to stand in. */
        style: { '--cf-in-delay': `${Math.round(i * 55)}ms` },
        onclick: () => openLightbox(items, i),
      }, h('span', { class: 'cf-deck__face' },
        h('img', { src: urlOf(p), alt: p.name || '', draggable: 'false', decoding: 'async' })));
      dealt.push(el);
      hand.append(el);
    });

    /**
     * The ring turns, one card every TURN_S, for ever.
     *
     * Three layers again, for the reason the fan in front of this panel has
     * three: the button carries the seat (written by this loop, never
     * animated), `.cf-deck__face` carries the entrance and the hover. A single
     * transform written from two places is the trap, not the solution.
     *
     * `seat` is the only thing this loop knows how to do, so the entrance calls
     * it once as well — a card must be in its seat before it is allowed to fade
     * up, or the first frame shows ten photographs stacked in the middle, which
     * is the very thing this replaced.
     */
    const seat = (el, k) => {
      const a = (k / n) * Math.PI * 2;             // 0 is the right of the ring
      const near = (1 - Math.cos(a)) / 2;          // 0 at the back, 1 at the front
      const s = DECK_FAR + (1 - DECK_FAR) * near;
      el.style.transform =
        `translate(-50%, -50%) translate(${round(Math.sin(a) * DECK_RX)}px, ${round(-Math.cos(a) * DECK_RY)}px) scale(${round(s)})`;
      /* Nearer is in front, and the ramp is the same one the scale uses, so a
         card can never be drawn over the card it is standing behind. */
      el.style.zIndex = String(100 + Math.round(near * 100));
      el.style.opacity = (DECK_FAR_FADE + (1 - DECK_FAR_FADE) * near).toFixed(3);
    };

    let dOff = 0;
    let dLast = 0;
    let dRaf = 0;
    const place = () => dealt.forEach((el, i) => seat(el, i + dOff));
    const turnDeck = (now) => {
      dRaf = 0;
      if (!panel || !panel.isConnected) return;
      const gap = dLast ? now - dLast : 0;
      const dt = gap > 0 && gap < 200 ? Math.min(0.05, gap / 1000) : 0.016;
      dLast = now;
      /* A hand on the ring holds it — released by stillness, so a mouse left
         lying on a three-metre screen does not stop it for the whole talk. */
      if (!dGrip.held) {
        dOff = (dOff + dt / TURN_S) % n;
        place();
      }
      dRaf = requestAnimationFrame(turnDeck);
    };
    const dGrip = pointerHold(hand, { onRelease: () => { dLast = 0; } });
    place();
    if (!REDUCED?.matches && n > 1) {
      /* After the last card has arrived, so the turn never pulls a seat out
         from under a card still fading into it. */
      setTimeout(() => { if (panel) dRaf = requestAnimationFrame(turnDeck); }, 560 + n * 55);
    }

    panel = h('div', { class: 'cf-deck', role: 'dialog', 'aria-label': block.deck.title || block.deck.label || 'More photographs' },
      h('div', { class: 'cf-deck__head' },
        block.deck.eyebrow ? h('p', { class: 'cf-eyebrow cf-deck__eyebrow' },
          h('span', { class: 'cf-eyebrow__mark', 'aria-hidden': 'true' }),
          h('span', { text: block.deck.eyebrow })) : null,
        block.deck.title ? h('h3', { class: 'cf-deck__title', text: block.deck.title }) : null,
        h('p', { class: 'cf-deck__hint', text: `${n} photographs · press one to see it whole` })),
      /* The section's own mark, in the corner the ring leaves empty (2026-09-19,
         on request: "use that icon in that leftover space... in the right").
         The ring is 1486px across the middle of a 1600px slide and its back
         cards are small and high, so the two top corners are the only ground on
         this panel with nothing on it. It is the same file the slide in front
         carries, drawn smaller, so the panel is named by the same mark that
         named the page it came out of. */
      block.logo ? h('img', {
        class: 'cf-deck__mark',
        src: upload(block.logo),
        alt: block.logoAlt || 'NT Square',
        loading: 'eager',
        decoding: 'async',
      }) : null,
      hand,
      h('button', { class: 'cf-btn cf-btn--solid cf-deck__back', type: 'button', onclick: closeDeck }, 'Back to NT Square'));
    root.append(panel);
    /* Dealt a frame after mount, so the pile is painted before the cards leave it. */
    requestAnimationFrame(() => requestAnimationFrame(() => panel?.classList.add('is-dealt')));
    panel.addEventListener('keydown', (event) => {
      if (event.key !== 'Escape') return;
      event.stopPropagation();
      event.preventDefault();
      closeDeck();
    });
    panel.tabIndex = -1;
    panel.focus({ preventScroll: true });
  }
  function closeDeck() {
    if (!panel) return;
    const p = panel;
    panel = null;
    p.classList.remove('is-dealt');
    p.classList.add('is-closing');
    setTimeout(() => p.remove(), 460);
  }

  return root;
}

const round = (n) => Math.round(n * 100) / 100;
