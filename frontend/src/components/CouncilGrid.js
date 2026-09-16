import { h } from '../utils/dom.js';

/**
 * The governance council as a 2x2 wall of faces.
 *
 * Each card is split in two: the portrait holds the left, the name and the
 * role hold the right. Nothing overlaps. An earlier pass ran the name behind
 * the figure the way the supplied reference does, but that only works with
 * cut-out photographs — these are shot on white and blended into the card, so
 * anything printed under a figure ghosts through it. Side by side, the face
 * gets its full size and the name stays clean.
 *
 * Every portrait is drawn into an identical box and cropped to fill it, so a
 * square headshot and a full-length standing shot arrive at the same size on
 * the page. The crop is anchored to the top of the frame — faces sit in the
 * upper third of a portrait, and anchoring to the centre cuts foreheads.
 */
export function CouncilGrid(block, { editing = false } = {}) {
  const members = (block.members || []).slice(0, 8);

  if (!members.length) {
    return h(
      'div',
      { class: 'council council--empty' },
      h('p', { class: 'media-empty__hint' }, 'No council members yet.'),
    );
  }

  const cards = members.map((member, index) => {
    // Two lines at most: the given break wins, otherwise the name is split at
    // its last space so the family name drops to its own line the way a lockup
    // does. The two lines are coloured differently, so the split carries
    // meaning rather than being a typographic convenience.
    const written = String(member.name || '').split('\n').map((s) => s.trim()).filter(Boolean);
    const lines = written.length > 1
      ? written.slice(0, 2)
      : (() => {
        const whole = written[0] || '';
        const cut = whole.lastIndexOf(' ');
        return cut > 0 ? [whole.slice(0, cut), whole.slice(cut + 1)] : [whole];
      })();

    const portrait = member.asset?.url
      ? h('img', {
        class: 'council-card__photo',
        src: member.asset.url,
        alt: member.name || '',
        loading: 'lazy',
      })
      : h('div', { class: 'council-card__photo council-card__photo--empty' },
        editing ? h('span', {}, 'No portrait') : null);

    return h(
      'article',
      {
        // `--i` is the stagger the deck uses everywhere: the cards arrive one
        // after another in reading order rather than all at once.
        class: 'council-card',
        style: { '--i': String(index) },
      },
      portrait,
      h(
        'div',
        { class: 'council-card__text' },
        // Numbering the seats, not the people: it gives the eye an order to
        // walk the grid in.
        h('span', { class: 'council-card__index' }, String(index + 1).padStart(2, '0')),
        h(
          'h3',
          { class: 'council-card__name' },
          ...lines.map((line) => h('span', { class: 'council-card__name-line' }, line)),
        ),
        h('span', { class: 'council-card__rule' }),
        h('span', { class: 'council-card__role' }, member.role || ''),
      ),
    );
  });

  return h(
    'div',
    { class: `council council--${members.length}` },
    block.kicker || block.standfirst
      ? h(
        'header',
        { class: 'council__head' },
        block.kicker ? h('p', { class: 'council__kicker' }, block.kicker) : null,
        block.standfirst ? h('p', { class: 'council__standfirst' }, block.standfirst) : null,
      )
      : null,
    h('div', { class: 'council__grid' }, ...cards),
  );
}
