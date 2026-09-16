import { h } from '../utils/dom.js';
import { upload } from '../utils/media.js';
import { openLightbox } from './Lightbox.js';
import { letterRevealPreset } from '../utils/letterReveal.js';

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
const OUTER_DROP = 291;
const OUTER_ANGLE = 15.2;   // degrees
const DROP_POW = 1.55;
const MAX_SPREAD = 200;

/* The deck. A hand held in one hand: every card leans from the same pivot far
   below the frame, so the tops splay and the bottoms nearly meet. */
const DECK_W = 300;
const DECK_H = 300;
const DECK_PIVOT = 900;     // px below the top of a card, where the hand is held
const DECK_STEP = 8;        // degrees a card
const DECK_MAX_ANGLE = 36;  // the outermost cards never lean past this

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
    }, h('span', { text: block.deck.label || 'More photographs' }),
    h('span', { class: 'cf-btn__count', text: String(deck.length) })));
  }
  if (cta.childElementCount) head.append(cta);
  root.append(head);

  // ------------------------------------------------------------------ the fan
  const fan = h('div', { class: 'cf-fan' });
  const centre = (cards.length - 1) / 2;
  const spread = centre > 0 ? Math.min(MAX_SPREAD, OUTER_X / centre) : 0;
  const reach = centre > 0 ? Math.min(1, (spread * centre) / OUTER_X) : 0; // how far out the end cards really stand

  cards.forEach((card, i) => {
    const d = i - centre;
    const a = Math.abs(d);
    const t = centre > 0 ? (a / centre) * reach : 0;   // 0 at the middle, 1 at the reference's edge

    const face = h(
      'div',
      { class: 'cf-card__face' },
      h('img', {
        src: urlOf(card),
        alt: card.name || '',
        draggable: 'false',
        loading: a < 3 ? 'eager' : 'lazy',
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
        /* The fan, written once. The step and the lean are linear in the
           distance from the middle; the drop is not, which is what bends the
           row into an arc. */
        transform: `translate3d(${round(d * spread)}px, ${round((t ** DROP_POW) * OUTER_DROP)}px, 0)`
          + ` rotate(${round(Math.sign(d) * t * OUTER_ANGLE)}deg)`,
        /* The middle card is in front and every step out is one layer back, so
           the hand overlaps the way a hand of cards does. */
        zIndex: String(100 - Math.round(a * 2)),
        /* The entrance runs outward from the middle rather than left to right:
           the card the eye lands on first is the one that arrives first. */
        '--cf-delay': `${Math.round(a * 85)}ms`,
      },
      onclick: () => open(i),
    }, rise);
    fan.append(el);
  });

  root.append(fan);

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
    const mid = (n - 1) / 2;
    const step = Math.min(DECK_STEP, mid > 0 ? DECK_MAX_ANGLE / mid : DECK_STEP);
    const hand = h('div', { class: 'cf-deck__hand', role: 'list' });
    const items = deck.map((p) => ({ url: urlOf(p), name: p.name || '' }));
    deck.forEach((p, i) => {
      const d = i - mid;
      hand.append(h('button', {
        class: 'cf-deck__card',
        type: 'button',
        role: 'listitem',
        'aria-label': p.name || `Photograph ${i + 1}`,
        style: {
          /* Dealt outward from the middle: the pile is the middle card's
             place, and each card turns from there to its own lean. */
          '--cf-deal': `${Math.round(d * step * 100) / 100}deg`,
          '--cf-deal-delay': `${Math.round(Math.abs(d) * 70)}ms`,
          zIndex: String(50 + i),
        },
        onclick: () => openLightbox(items, i),
      }, h('span', { class: 'cf-deck__face' },
        h('img', { src: urlOf(p), alt: p.name || '', draggable: 'false', decoding: 'async' }))));
    });

    panel = h('div', { class: 'cf-deck', role: 'dialog', 'aria-label': block.deck.title || block.deck.label || 'More photographs' },
      h('div', { class: 'cf-deck__head' },
        block.deck.eyebrow ? h('p', { class: 'cf-eyebrow cf-deck__eyebrow' },
          h('span', { class: 'cf-eyebrow__mark', 'aria-hidden': 'true' }),
          h('span', { text: block.deck.eyebrow })) : null,
        block.deck.title ? h('h3', { class: 'cf-deck__title', text: block.deck.title }) : null,
        h('p', { class: 'cf-deck__hint', text: `${n} photographs · press one to see it whole` })),
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
