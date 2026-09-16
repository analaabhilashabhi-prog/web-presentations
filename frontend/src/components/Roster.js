import { h } from '../utils/dom.js';

/**
 * A roll of names with no photographs — a governing body, a council, a
 * committee — set as a bento wall.
 *
 * The card follows the supplied infographic: the seat number set large at the
 * head, the institution's mark opposite it, and then the person — their name
 * picked out in colour, their own position beneath it in grey.
 *
 * The reference stands a coloured bar down each card and gives every row its
 * own hue. Thirteen of those read as clutter rather than as structure, so the
 * colour survives only where it does work: on the name and its seat. The
 * alternation between the accent and the navy is kept, which is what still
 * tells one card from the next.
 *
 * Every card is one cell of the same size. The cells the roll does not fill
 * are given to a note tile rather than left as holes, so the grid still closes
 * on a straight edge.
 */

const COLUMNS = 5;

export function Roster(block, { editing = false } = {}) {
  const entries = (block.entries || []).slice(0, 40);

  if (!entries.length) {
    return h(
      'div',
      { class: 'roster roster--empty' },
      h('p', { class: 'media-empty__hint' },
        editing ? 'No entries yet — add names to this roster.' : ''),
    );
  }

  const logoUrl = block.logo?.url || null;

  // What is left of the last row. A full row leaves nothing, and the note then
  // takes a row of its own rather than being dropped.
  const remainder = (COLUMNS - (entries.length % COLUMNS)) % COLUMNS;
  const noteSpan = remainder || COLUMNS;

  const cards = entries.map((entry, index) => h(
    'li',
    {
      class: `rcard rcard--${index % 2 === 0 ? 'accent' : 'navy'}`,
      // The stagger every entrance in this deck uses, in reading order.
      style: { '--i': String(index) },
    },
    h(
      'div',
      { class: 'rcard__top' },
      h(
        'div',
        { class: 'rcard__index' },
        h('span', { class: 'rcard__indexNo' }, String(index + 1).padStart(2, '0')),
      ),
      h(
        'span',
        { class: 'rcard__mark' },
        logoUrl ? h('img', { src: logoUrl, alt: '', loading: 'lazy' }) : null,
      ),
    ),
    h('p', { class: 'rcard__name' }, entry.name),
    entry.affiliation ? h('p', { class: 'rcard__where' }, entry.affiliation) : null,
    h(
      'div',
      { class: 'rcard__foot' },
      entry.role ? h('span', { class: 'rcard__seat' }, entry.role) : null,
    ),
  ));

  // The note is a tile in the wall, not a line under it: it closes the last
  // row instead of leaving empty cells, and it is the one dark block in an
  // otherwise white grid.
  const noteTile = block.note
    ? h(
      'li',
      {
        class: 'rnote',
        style: { '--i': String(entries.length), gridColumn: `span ${noteSpan}` },
      },
      h('p', { class: 'rnote__text' }, block.note),
    )
    : null;

  return h(
    'div',
    { class: 'roster' },
    block.kicker || block.standfirst
      ? h(
        'header',
        { class: 'roster__head' },
        block.kicker ? h('p', { class: 'roster__kicker' }, block.kicker) : null,
        block.standfirst ? h('p', { class: 'roster__standfirst' }, block.standfirst) : null,
      )
      : null,
    h('ol', { class: 'roster__grid' }, ...cards, noteTile),
  );
}
