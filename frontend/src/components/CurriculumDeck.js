import { h } from '../utils/dom.js';
import { registerStepper } from '../utils/slideSteps.js';

/**
 * The curriculum, as cards.
 *
 * Eight programmes on a dark sheet; press one and it opens onto its numbered
 * topics. That is the whole of it — there is no description under a programme
 * and none under a topic, because the brief this was built to says there are
 * none. The schema has no field for one either: a field nobody fills is a field
 * somebody fills later by accident.
 *
 * It replaced the bookshelf on Torii's Trainings row (2026-09-18, on request).
 * `TrainingShelf` is untouched and still registered — it was built to a
 * reference the user supplied and a later cut may want it back.
 *
 * FOUR THINGS IT IS BUILT AROUND
 * -----------------------------
 *   - **Nothing is small.** The ask was that everything be readable from the
 *     room, so the type does not shrink to fit: a programme with fifteen topics
 *     takes more columns rather than smaller words. `columnsFor` picks 1, 2 or
 *     3 off the count alone, which is why ServiceNow's fifteen and AWS's seven
 *     look like the same design at the same size.
 *   - **The open card is the whole slide.** A panel over the grid rather than a
 *     card that grows in place: fifteen topics cannot fit a tile on an eight-up
 *     grid at a size anyone can read, and a grid that reflows around one open
 *     card moves every other card while somebody is reading it.
 *   - **The entrance is minimal, once.** The cards rise 14px over 460ms on a
 *     40ms stagger, and the topics do the same when a card opens. Nothing
 *     loops, nothing drifts: this is the one slide in the deck that is read
 *     rather than watched.
 *   - **It answers the deck's own keys.** Left and right walk the programmes
 *     through `slideSteps` — open, next, next, and out of the tab after the
 *     last — so the four-key model reaches it without a control of its own.
 */

const REDUCED = window.matchMedia?.('(prefers-reduced-motion: reduce)');

/** How many columns a list of topics is set in. Off the count alone, so every
    programme is set at the same size whatever it holds. */
function columnsFor(n) {
  if (n > 10) return 3;
  if (n > 5) return 2;
  return 1;
}

export function CurriculumDeck(block) {
  const programs = (block.programs || []).filter((p) => p && p.name);
  const root = h('section', {
    class: 'cu-root',
    tabindex: '0',
    'aria-label': block.title || 'Curriculum',
  });
  if (!programs.length) return root;

  const teachLabel = block.teachLabel || 'What we teach';

  /* ------------------------------------------------------------------ head */
  root.append(h('header', { class: 'cu-head' },
    block.eyebrow ? h('p', { class: 'cu-eyebrow' }, block.eyebrow) : null,
    h('h2', { class: 'cu-title' }, block.title || 'Trainings'),
  ));

  /* ------------------------------------------------------------------ grid */
  const grid = h('div', { class: 'cu-grid', role: 'list' });
  const cards = programs.map((p, i) => {
    const card = h('button', {
      class: 'cu-card',
      type: 'button',
      role: 'listitem',
      style: { '--cu-i': String(i) },
      'aria-label': `${p.name} — ${p.topics.length} topics`,
      onclick: () => open(i),
    },
      h('span', { class: 'cu-card__n' }, String(i + 1).padStart(2, '0')),
      h('span', { class: 'cu-card__name' }, p.name),
      /* The count is the one number on the face. It is not a description — it
         is what tells a presenter how deep the card goes before they press it. */
      h('span', { class: 'cu-card__meta' }, `${p.topics.length} topics`),
    );
    grid.append(card);
    return card;
  });
  root.append(grid);

  /* ----------------------------------------------------------------- detail */
  const panel = h('div', { class: 'cu-panel', hidden: true, role: 'dialog', 'aria-modal': 'false' });
  root.append(panel);

  let active = -1;

  function open(i) {
    const p = programs[i];
    if (!p) return;
    active = i;

    const cols = columnsFor(p.topics.length);
    /* The row count has to be written for the grid to fill DOWN each column
       before moving across — `grid-auto-flow: column` alone would make one long
       column and overflow the sheet. */
    const rows = Math.ceil(p.topics.length / cols);
    const list = h('ol', {
      class: `cu-topics${cols > 2 ? ' is-wide' : ''}`,
      style: { '--cu-cols': String(cols), '--cu-rows': String(rows) },
    },
      ...p.topics.map((t, k) => h('li', {
        class: 'cu-topic',
        style: { '--cu-i': String(k) },
      },
        h('span', { class: 'cu-topic__n' }, String(k + 1).padStart(2, '0')),
        h('span', { class: 'cu-topic__name' }, t),
      )),
    );

    panel.replaceChildren(
      h('div', { class: 'cu-panel__head' },
        h('button', {
          class: 'cu-back',
          type: 'button',
          onclick: () => close(),
        }, block.backLabel || 'All programmes'),
        h('span', { class: 'cu-panel__n' }, String(i + 1).padStart(2, '0')),
      ),
      h('h3', { class: 'cu-panel__name' }, p.name),
      h('p', { class: 'cu-teach' }, teachLabel),
      list,
    );
    panel.hidden = false;
    /* A frame later, so the entrance plays from its own start rather than from
       whatever the previous programme's list had reached. */
    panel.classList.remove('is-in');
    void panel.offsetWidth;
    panel.classList.add('is-in');
    root.classList.add('is-open');
    panel.querySelector('.cu-back')?.focus({ preventScroll: true });
  }

  function close() {
    active = -1;
    root.classList.remove('is-open');
    panel.classList.remove('is-in');
    panel.hidden = true;
    cards[0]?.focus({ preventScroll: true });
  }

  /* Escape closes, which is what a presenter reaches for. Stopped, or it would
     leave presentation mode from a slide that had something open. */
  root.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && active >= 0) {
      event.stopPropagation();
      event.preventDefault();
      close();
    }
  });

  /* The deck's own left and right: open the first, walk the rest, and decline
     once past the last so the tab turns. Backwards is the mirror, and from the
     first programme it closes rather than declining, so the grid is on screen
     again before the deck moves on. */
  registerStepper((delta) => {
    if (active < 0) {
      if (delta < 0) return false;
      open(0);
      return true;
    }
    const next = active + delta;
    if (next >= programs.length) return false;
    if (next < 0) { close(); return true; }
    open(next);
    return true;
  });

  if (!REDUCED?.matches) {
    requestAnimationFrame(() => root.classList.add('is-ready'));
  } else {
    root.classList.add('is-ready');
  }

  return root;
}
