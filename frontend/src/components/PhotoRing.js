import { h } from '../utils/dom.js';
import { media } from '../utils/media.js';
import { openLightbox } from './Lightbox.js';
import { letterRevealPreset } from '../utils/letterReveal.js';

/**
 * A carousel of cards standing in a fan, turning one card at a time, over a row
 * of filters that swap which set is on the turntable.
 *
 * Built to a reference the user supplied: cards seen in perspective, the one at
 * the front square to the room and the rest leaning in around it, overlapping.
 *
 * It turns by *steps*, not by sweeping. A fan that spins continuously is a
 * screensaver — nothing is ever the subject long enough to be looked at, and on
 * a projector a slow continuous drift reads as the page not having settled. So
 * it holds on a card, turns by exactly one, and holds again. The hold is most of
 * the cycle; the move is the short part.
 *
 * Not a closed ring. Distributing 360° over the cards is the obvious reading of
 * the reference and it is wrong: four pictures then sit 90° apart, which puts
 * both neighbours of the front card exactly edge-on and leaves two vertical
 * slivers either side of one picture. Each card is instead placed by how many
 * steps it stands from the front one — across, back, and turned in toward the
 * middle — which reads the same whether the set holds three cards or twelve.
 *
 * Four layers, because one `transform` cannot carry four jobs without them
 * overwriting each other:
 *
 *   - `.pr-slot`      the fan placement. Written by JS, eased by CSS. This is
 *                     the turn.
 *   - `.pr-card`      scale — the resting shrink and the hover growth.
 *   - `.pr-card__in`  the entrance, replayed every time the filter changes.
 *   - `.pr-card__frame` the picture, cut to its own proportions.
 *
 * Pointing at a card stops the fan and brings that card forward; taking the
 * pointer away starts it again. Clicking opens the set in the viewer the
 * galleries already use — the *filtered* set, so the arrows walk what is on
 * screen rather than everything the section holds.
 */

const REDUCED = window.matchMedia?.('(prefers-reduced-motion: reduce)');

/* How long a card stays the front one, and how long the turn to the next takes.
   The hold dominates deliberately — see the note above. */
const HOLD_MS = 3200;
const TURN_MS = 1100;

const STEP_X = 268;   // across, per step out from the front
const STEP_Z = 190;   // back, per step out
const TILT = 34;      // degrees, leaning in toward the centre
/* How many are drawn either side. Past the third the cards are behind each other
   and contribute nothing but overdraw. */
const WINGS = 3;

/**
 * The sets, however the block stores them.
 *
 * A block written before the filters existed carries one flat `shots` list and
 * no groups. It still has to render, so that case becomes a single unnamed set
 * and the filter bar stays off — one filter is not a choice.
 */
function setsOf(block) {
  const groups = (Array.isArray(block.groups) ? block.groups : [])
    .map((g) => ({
      key: String(g?.key || g?.name || '').trim(),
      name: String(g?.name || '').trim(),
      shots: (Array.isArray(g?.shots) ? g.shots : []).filter((s) => s?.src),
    }))
    .filter((g) => g.name && g.shots.length);
  if (groups.length) return groups;

  const flat = (Array.isArray(block.shots) ? block.shots : []).filter((s) => s?.src);
  return flat.length ? [{ key: 'all', name: '', shots: flat }] : [];
}

export function PhotoRing(block, { editing = false } = {}) {
  const sets = setsOf(block);
  const root = h('div', { class: 'pr-root ph-root' });

  if (!sets.length) {
    root.appendChild(h('div', { class: 'pr-empty' },
      h('h2', { class: 'pr-title' }, block.title || 'Beyond'),
      editing
        ? h('p', { class: 'pr-hint' },
            'Drop the pictures into backend/uploads/ and list them on this block.')
        : null,
    ));
    return root;
  }

  const base = String(block.base || '').replace(/^\/+|\/+$/g, '');
  const srcFor = (s) => media(
    `/uploads/${[base, s.src].filter(Boolean).join('/').split('/').map(encodeURIComponent).join('/')}`,
  );

  /* "All" first, and it is what the section opens on: the point of the page is
     everything the programme has done, with the filters there to narrow it. It
     is only offered when there is more than one set to combine. */
  const named = sets.filter((s) => s.name);
  const tabs = named.length > 1
    ? [{ key: 'all', name: block.allLabel || 'All', shots: sets.flatMap((s) => s.shots) }, ...named]
    : named;

  let active = tabs.length ? tabs[0] : sets[0];
  let shots = active.shots;
  let slots = [];
  let index = 0;
  let held = false;
  let timer = null;

  const ring = h('div', { class: 'pr-ring' });
  const stage = h('div', {
    class: 'pr-stage',
    style: { '--turn': `${TURN_MS}ms` },
  }, ring);

  /* ------------------------------------------------------------------ cards */
  function buildCards() {
    stop();
    index = 0;
    /* The card the pointer was on is about to be destroyed, so its `pointerleave`
       will never arrive. Left set, `held` blocks `start()` for good and the fan
       never turns again after a filter is pressed with the pointer on a card —
       which is the ordinary way to press one. Releasing it here is the only
       place that knows the old cards are going. */
    held = false;
    ring.textContent = '';

    slots = shots.map((shot, i) => {
      const img = h('img', {
        class: 'pr-card__img', src: srcFor(shot), alt: shot.label || '',
        loading: i < 4 ? 'eager' : 'lazy', decoding: 'async',
      });

      /* Each card is cut to its own picture rather than to one frame shared by
         the set. These sets mix square and 16:9; held to a single 16:9 frame the
         squares play inside a wide black letterbox, and held to a square one the
         wide picture does the same. Every card is the same *height*, so the fan
         still stands on one line, and the width follows the photograph. */
      const ratio = Number(shot.w) > 0 && Number(shot.h) > 0
        ? `${shot.w} / ${shot.h}`
        : '16 / 9';

      const card = h('div', { class: 'pr-card' },
        /* The entrance layer. It exists only so the swap animation has a
           transform of its own to play with — the three around it are already
           spoken for. */
        h('div', {
          class: 'pr-card__in',
          style: REDUCED?.matches ? {} : { '--i': String(Math.min(i, 8)) },
        },
          h('div', { class: 'pr-card__frame', style: { '--ar': ratio } }, img),
          shot.label ? h('p', { class: 'pr-card__label' }, shot.label) : null,
        ),
      );

      const slot = h('button', {
        class: 'pr-slot', type: 'button',
        'aria-label': shot.label || `Picture ${i + 1} of ${shots.length}`,
        onclick: () => openLightbox(
          shots.map((s) => ({ url: srcFor(s), name: s.label || block.title || '' })),
          i,
        ),
        onpointerenter: () => { held = true; stop(); face(i); },
        onpointerleave: () => { held = false; start(); },
        /* Keyboard reaches the same two states as the pointer, so tabbing
           through the fan brings each card forward instead of leaving the
           focused one somewhere round the back where its outline cannot be
           seen. */
        onfocus: () => { held = true; stop(); face(i); },
        onblur: () => { held = false; start(); },
      }, card);

      ring.appendChild(slot);
      return slot;
    });

    paint();
    start();
  }

  /* ------------------------------------------------------------------ motion */
  /** Place every card by how many steps it stands from the front one. */
  function paint() {
    const count = slots.length;
    slots.forEach((slot, i) => {
      /* Signed distance the short way round, so the set wraps: the card before
         the front sits on the left rather than count-1 places out on the right. */
      let d = (i - index) % count;
      if (d > count / 2) d -= count;
      if (d < -count / 2) d += count;
      const away = Math.abs(d);

      /* Across, back, and turned in toward the middle. The sign of the turn is
         against the direction of travel, so a card on the right shows its left
         edge — which is what makes the group read as an arc standing around the
         front card rather than a flat row of thumbnails. */
      slot.style.transform =
        `translateX(${(d * STEP_X).toFixed(1)}px)`
        + ` translateZ(${(-away * STEP_Z).toFixed(1)}px)`
        + ` rotateY(${(-d * TILT).toFixed(2)}deg)`;
      /* Nearer cards draw over further ones. Without this the paint order is
         document order and a back card can land on top of the front one. */
      slot.style.zIndex = String(40 - away);
      slot.style.opacity = away > WINGS ? '0' : '1';
      slot.style.pointerEvents = away > WINGS ? 'none' : 'auto';
      slot.classList.toggle('is-front', away === 0);
      /* Everything behind the front card is set back and dimmed, which is what
         stops a fan of similar pictures reading as a jumble: at any moment one
         of them is the subject and the rest are context. */
      slot.style.setProperty('--away', String(away));
    });
  }

  const advance = () => { index = (index + 1) % slots.length; paint(); };

  function start() {
    if (timer || held || REDUCED?.matches || slots.length < 2) return;
    timer = setInterval(() => { if (!held) advance(); }, HOLD_MS + TURN_MS);
  }
  function stop() {
    if (!timer) return;
    clearInterval(timer);
    timer = null;
  }
  /** Bring a given card to the front — used when a card is pointed at. */
  function face(i) { index = i; paint(); }

  /* ----------------------------------------------------------------- filters */
  const bar = h('div', { class: 'pr-tabs', role: 'tablist' });

  function drawTabs() {
    bar.replaceChildren(...tabs.map((t, i) => h('button', {
      class: `pr-tab${t === active ? ' is-on' : ''}`,
      type: 'button', role: 'tab', 'aria-selected': String(t === active),
      style: REDUCED?.matches ? {} : { '--i': String(i) },
      onclick: () => {
        if (t === active) return;
        active = t;
        shots = t.shots;
        drawTabs();
        buildCards();
      },
    },
      h('span', { class: 'pr-tab__name' }, t.name),
      h('span', { class: 'pr-tab__n' }, String(t.shots.length)),
    )));
  }

  /* ------------------------------------------------------------------- frame */
  /* The deck's own letter reveal, the same one the card fan and the slide titles
     use, so this section's headline arrives the way every other one does. */
  const titleText = block.title || 'Beyond';
  const title = h('h2', { class: 'pr-title', 'aria-label': titleText });
  title.append(letterRevealPreset(titleText, 'heading', {
    as: 'span', className: 'pr-title__line', trigger: true,
  }).node);

  const head = h('div', { class: 'pr-head' },
    block.eyebrow ? h('p', { class: 'pr-eyebrow' }, block.eyebrow) : null,
    title,
    block.lead ? h('p', { class: 'pr-lead' }, block.lead) : null,
  );

  root.appendChild(head);
  if (tabs.length > 1) {
    drawTabs();
    root.appendChild(bar);
  }
  root.appendChild(stage);

  buildCards();

  /* The interval outlives the slide unless it is taken down by hand — a section
     that has been navigated away from must not keep turning a fan nobody can
     see, nor hold a reference to its nodes. */
  const watch = new MutationObserver(() => {
    if (!root.isConnected) { stop(); watch.disconnect(); }
  });
  watch.observe(document.body, { childList: true, subtree: true });

  return root;
}
