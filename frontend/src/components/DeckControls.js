import { h } from '../utils/dom.js';
import { icon } from '../utils/icons.js';
import { sectionLabel } from './SideNav.js';

/**
 * The presenter's dock: two controls, and where they lead.
 *
 * It rests at 28% opacity and comes up on hover, so a slide is never shown
 * through a bar of furniture. What it holds is deliberately small (2026-09-17,
 * on request): **Previous tab** and **Next tab**, each carrying the name of the
 * section it goes to, the position, and the way out.
 *
 * The names are the point. "‹" alone asks a presenter to remember the running
 * order of sixteen sections while a room watches, so each button says where it
 * lands — and says "tab", because that is the word the deck is discussed in and
 * because these two are now the *only* controls that change section. The arrow
 * keys no longer do; they walk whatever the open slide holds of its own. See
 * `PresentPage.go` for the pair.
 *
 * A rail of every section used to sit between them, each with a hover card of
 * its subsections. It went with the same request. Sixteen names do not fit a
 * bar, so it drew sixteen icons and named only the one in hand — which is a
 * jump control nobody can aim without already knowing the icons, over a deck
 * whose rows the side pane names in full a keystroke away.
 */
export function DeckControls({ index, total, deck = [], onPrev, onNext, onExit }) {
  const progress = h('div', {
    class: 'deck-progress',
    style: { width: `${total ? ((index + 1) / total) * 100 : 0}%` },
  });

  const at = Math.max(0, index);
  /* Wrapping, to match `turn()` in PresentPage — the deck is a loop, so the last
     slide's "next" is the first and the label has to say so. */
  const prevSection = deck.length ? deck[(at - 1 + deck.length) % deck.length] : null;
  const nextSection = deck.length ? deck[(at + 1) % deck.length] : null;

  /** Truncated in CSS, but a hard cap keeps a long title from setting the width. */
  const shortName = (section) => {
    const { label } = sectionLabel(section);
    return label.length > 26 ? `${label.slice(0, 25)}…` : label;
  };

  const step = (dir, section, handler) => h('button', {
    class: `deck-step deck-step--${dir}`,
    type: 'button',
    title: dir === 'prev' ? 'Previous tab (Page Up)' : 'Next tab (Page Down or Space)',
    'aria-label': `${dir === 'prev' ? 'Previous' : 'Next'} tab${section ? `: ${sectionLabel(section).label}` : ''}`,
    onclick: handler,
  },
    dir === 'prev' ? icon('chevron-left', { class: 'ic ic--sm' }) : null,
    h('span', { class: 'deck-step__text' },
      h('em', {}, dir === 'prev' ? 'Previous tab' : 'Next tab'),
      h('span', {}, section ? shortName(section) : '—')),
    dir === 'next' ? icon('chevron-right', { class: 'ic ic--sm' }) : null,
  );

  const bar = h(
    'div',
    { class: 'deck-bar deck-bar--pair' },
    step('prev', prevSection, onPrev),
    h('span', { class: 'deck-bar__count' }, `${at + 1} / ${total}`),
    step('next', nextSection, onNext),
    h('button', { class: 'btn btn--sm btn--on-dark', title: 'Exit (Esc)', onclick: onExit }, 'Exit'),
  );

  return [progress, bar];
}
