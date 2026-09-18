import { h } from '../utils/dom.js';
import { media } from '../utils/media.js';
import { openLightbox } from './Lightbox.js';
import { letterRevealPreset } from '../utils/letterReveal.js';
import { pointerHold } from '../utils/pointerHold.js';

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
   The hold dominates deliberately — see the note above. It came down from 3200
   when the fan started walking the whole section on its own (2026-09-18): at
   4.3s a card a set of four took seventeen seconds, which is a long time to
   stand beside a slide that is not going to do anything else. */
const HOLD_MS = 2300;
const TURN_MS = 1100;
/* The beat on the last card of a set, before the next title takes over. Longer
   than a card, for the reason the event wheel's is: the title changing is the
   end of a chapter and should not read as one more step. */
const SET_MS = 3400;

/* Across and back, per step out from the front. Both grew with the card
   (2026-09-18): at the old 268 a 760px card stood almost entirely over its
   neighbour, and the fan read as one picture with edges behind it rather than
   as a group standing around the front one. */
const STEP_X = 452;   // across, per step out from the front
const STEP_Z = 240;   // back, per step out
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

  /* OPENS ON EVERYTHING (2026-09-18, on request: "by default all photos should
     flow"). It opened on the first chapter until then, which meant the slide
     arrived showing three of its ten photographs and walked the rest a chapter
     at a time. "All" is the whole section in one set, so the walk is simply
     every photograph in turn. */
  let active = tabs[0] || sets[0];
  let shots = active.shots;
  let slots = [];
  let index = 0;
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
    shown = 1;
    /* The card the pointer was on is about to be destroyed, so its `pointerleave`
       will never arrive — which used to leave `held` set for good and stop the
       fan turning after a filter was pressed with the pointer on a card, the
       ordinary way to press one. The hold is released by stillness now, so it
       cannot be stranded and there is nothing to reset here. */
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
        onpointerenter: () => { face(i); },
        
        /* Keyboard reaches the same two states as the pointer, so tabbing
           through the fan brings each card forward instead of leaving the
           focused one somewhere round the back where its outline cannot be
           seen. */
        onfocus: () => { stop(); face(i); },
        onblur: () => { start(); },
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

  /* THE FAN WALKS THE WHOLE SECTION, NOT ONE SET (2026-09-18, on request:
     "the title comes up and the photos scroll, then the next title"). Every
     photograph of the open set is brought to the front in turn, and when the
     last one has been seen the next title takes over and starts on its first.
     It runs until the tab is left.

     `shown` is what makes the difference: `index` wraps, so on its own it can
     never say "that was the last one" — a set of three would turn for ever.
     Counting what has been *seen* since the set opened is the only honest end,
     and it is reset wherever a set begins, which is `buildCards`. */
  let shown = 1;

  function goTo(t) {
    if (!t || t === active) { shown = 1; index = 0; paint(); return; }
    active = t;
    shots = t.shots;
    drawTabs();
    buildCards();
  }

  /* THE WALK STAYS IN THE OPEN SET AND COMES ROUND (2026-09-18, on request:
     "if the user clicks on any particular one it should go to that and then do
     the animation in the loop"). It used to hand on to the next chapter once a
     set was spent, which was right while the slide opened on a chapter; opening
     on "All" that would have taken it straight back out of the set the
     presenter is looking at. So a set loops, and the only thing that changes
     which set is open is somebody pressing a title.

     `advance` wraps `index` on its own, so the wrap needs no case of its own —
     only `shown`, the count of what has been seen, is put back. */
  function tick() {
    /* The timeout that called this has fired, so the handle is spent. Clearing
       it here matters more than it looks: `start` refuses to run while `timer`
       is set, so a tick that returned early — which is exactly what a hold does
       — used to leave a stale handle behind and the walk could never be started
       again. That is what kept this slide frozen under a resting pointer after
       every other one had been fixed. */
    timer = 0;
    if (grip.held) return;
    const lap = shown >= slots.length;
    shown = lap ? 1 : shown + 1;
    advance();
    /* A beat at the wrap, so coming back round reads as coming back round
       rather than as one more step. */
    reschedule(lap ? SET_MS : HOLD_MS + TURN_MS);
  }

  function reschedule(ms) {
    stop();
    if (grip.held || REDUCED?.matches) return;
    timer = setTimeout(tick, ms);
  }

  function start() {
    if (timer || grip.held || REDUCED?.matches) return;
    /* A set of one still has to hand on, so the guard is no longer
       `slots.length < 2` — that stranded the walk on any single-photograph
       chapter for good. */
    reschedule(slots.length > 1 ? HOLD_MS + TURN_MS : SET_MS);
  }
  function stop() {
    if (!timer) return;
    clearTimeout(timer);
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

  /* NO HEAD (2026-09-18, on request: "remove this in the top left corner").
     The eyebrow, the title and the lead are still on the block and still the
     row's own name in the pane; they are simply not drawn on the slide. The
     section is the photographs and the title of the set being shown, and every
     row the head took came off the pictures — which is the other half of the
     same request. `head` is built above and left unappended rather than deleted
     so putting it back is one line. */
  void head;
  if (tabs.length > 1) {
    drawTabs();
    root.appendChild(bar);
  }
  root.appendChild(stage);

  /* The pointer anywhere over the section holds the walk, not only over a card:
     the gap between two cards, the title bar and the ground around them are all
     still this slide, and a presenter who has moved off a photograph to point at
     a title has not stopped looking at it. Each card keeps its own handlers as
     well, because those also bring that card to the front. */
  const grip = pointerHold(root, { onRelease: start });

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
