import { h } from '../utils/dom.js';
import { icon } from '../utils/icons.js';
import { sectionLabel, sectionMenu } from './SideNav.js';

/**
 * The presenter's bar: where you are, what is either side of you, and a way to
 * reach any slide without walking there.
 *
 * Three parts, left to right. The previous and next buttons carry the name of the
 * section they lead to, because "‹" alone asks the presenter to remember the
 * running order of sixteen sections while a room watches. The middle names every
 * section, and hovering one raises a card of its subsections so any page in the
 * deck is a single click away. The count and exit stay on the right.
 *
 * The card is modelled on the navbar-menu: a rounded surface that springs up
 * under the pointer. Each section owns its own, built once — the reference
 * animates a single shared card between items with a layoutId, and re-creating
 * one on every hover would restart its transition and read as a flicker.
 *
 * It is `position: absolute` inside the bar, not fixed. The bar is already the
 * top layer of the presenting view, and a fixed child would be measured against
 * the viewport and drift as soon as the bar is centred by a transform.
 */
export function DeckControls({ index, total, deck = [], onPrev, onNext, onExit, onJump }) {
  const progress = h('div', {
    class: 'deck-progress',
    style: { width: `${total ? ((index + 1) / total) * 100 : 0}%` },
  });

  const at = Math.max(0, index);
  /* Wrapping, to match `go()` in PresentPage — the deck is a loop, so the last
     slide's "next" is the first and the label has to say so. */
  const prevSection = deck.length ? deck[(at - 1 + deck.length) % deck.length] : null;
  const nextSection = deck.length ? deck[(at + 1) % deck.length] : null;

  /** Truncated in CSS, but a hard cap keeps a long title from setting the width. */
  const shortName = (section) => {
    const { label } = sectionLabel(section);
    return label.length > 22 ? `${label.slice(0, 21)}…` : label;
  };

  const dots = h('div', { class: 'deck-dots', role: 'tablist', 'aria-label': 'Jump to a section' });
  deck.forEach((section, i) => {
    const { label, icon: iconKey } = sectionLabel(section);
    const menu = sectionMenu(section);

    /* The hover card, per section. Built once and shown on enter, rather than
       created on demand: the reference animates a shared card between items, and
       re-creating one on every hover would restart its transition from scratch
       and read as a flicker along the bar. */
    const heading = section.parentId ? 'Also in this group' : label;
    const card = menu.length
      ? h('div', { class: 'deck-menu' },
          h('span', { class: 'deck-menu__head' }, heading),
          h('div', { class: 'deck-menu__list' },
            ...menu.map((row) => h('button', {
              class: 'deck-menu__row', type: 'button',
              onclick: (e) => {
                e.stopPropagation();
                onJump?.(row.id ? { id: row.id } : section);
              },
            }, row.label)),
          ),
        )
      : null;

    const dot = h('button', {
      class: `deck-dot${i === at ? ' is-on' : ''}`,
      type: 'button',
      role: 'tab',
      'aria-selected': i === at ? 'true' : 'false',
      'aria-label': `${i + 1}. ${label}`,
      onclick: () => onJump?.(section),
    },
      icon(iconKey, { class: 'ic ic--xs' }),
      h('span', { class: 'deck-dot__name' }, label),
    );
    const cell = h('div', { class: 'deck-cell' }, dot, card);
    cell.addEventListener('mouseenter', () => {
      cell.classList.add('is-open');
    });
    cell.addEventListener('mouseleave', () => cell.classList.remove('is-open'));
    dot.addEventListener('focus', () => cell.classList.add('is-open'));
    dot.addEventListener('blur', () => cell.classList.remove('is-open'));
    dots.appendChild(cell);
  });

  const step = (dir, section, handler) => h('button', {
    class: `deck-step deck-step--${dir}`,
    type: 'button',
    title: dir === 'prev' ? 'Previous (←)' : 'Next (→ or Space)',
    onclick: handler,
  },
    dir === 'prev' ? icon('chevron-left', { class: 'ic ic--xs' }) : null,
    section
      ? h('span', { class: 'deck-step__text' },
          h('em', {}, dir === 'prev' ? 'Previous' : 'Next'),
          h('span', {}, shortName(section)))
      : null,
    dir === 'next' ? icon('chevron-right', { class: 'ic ic--xs' }) : null,
  );

  const bar = h(
    'div',
    { class: 'deck-bar' },
    step('prev', prevSection, onPrev),
    dots,
    step('next', nextSection, onNext),
    h('span', { class: 'deck-bar__count' }, `${at + 1} / ${total}`),
    h('button', { class: 'btn btn--sm btn--on-dark', title: 'Exit (Esc)', onclick: onExit }, 'Exit'),
  );

  return [progress, bar];
}
