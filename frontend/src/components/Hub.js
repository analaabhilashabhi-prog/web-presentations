import { h } from '../utils/dom.js';
import { navigate } from '../utils/router.js';

/**
 * A chooser: a small set of doors onto the pages beneath this one.
 *
 * The card is the supplied design — a bracket of brand colour sitting behind
 * one corner, a 45-degree chamfer cut from the opposite foot, a giant outlined
 * numeral bled off the side, a badge, and the label revealed letter by letter.
 * Corners, chamfers and sides alternate around the grid so no two neighbours
 * lean the same way.
 *
 * Two departures from the reference, both deliberate:
 *
 * - No webfonts. The reference loads Anton and Poppins from Google. This deck
 *   has to run with no internet at presentation time, so the numeral falls back
 *   to a local condensed stack and the rest stays on the deck's own face.
 * - The badge carries the institution's mark rather than a per-card line icon,
 *   which is the rule set for every other card in this deck.
 *
 * Clicking a door navigates to the page it names. The organization comes from
 * the current route rather than from the block, because a hub is only ever
 * built against sections in its own organization.
 */

/* Which corner each door leans into, in order. Four is the designed set; more
   than four simply repeats the cycle. */
const LEAN = [
  { corner: 'tl', chamfer: 'br', side: 'left', icon: 'right' },
  { corner: 'tr', chamfer: 'bl', side: 'right', icon: 'left' },
  { corner: 'bl', chamfer: 'br', side: 'left', icon: 'right' },
  { corner: 'br', chamfer: 'bl', side: 'right', icon: 'left' },
];

/** The org id out of `#/o/<orgId>/<sectionId>`. */
function currentOrgId() {
  const parts = String(window.location.hash || '').replace(/^#/, '').split('/').filter(Boolean);
  return parts[0] === 'o' ? parts[1] : null;
}

/** Splits a label into words and letters, each letter carrying its global index. */
function letters(label) {
  let index = 0;
  return String(label).split(' ').map((word) => h(
    'span',
    { class: 'hub-door__word', 'aria-hidden': 'true' },
    ...Array.from(word).map((char) => {
      const el = h('span', { class: 'hub-door__ltr' }, char);
      // 26ms, as the reference sets it.
      el.style.transitionDelay = `${index * 26}ms`;
      index += 1;
      return el;
    }),
  ));
}

export function Hub(block, { editing = false } = {}) {
  const doors = (block.doors || []).slice(0, 6);

  if (!doors.length) {
    return h(
      'div',
      { class: 'hub hub--empty' },
      h('p', { class: 'media-empty__hint' }, editing ? 'No doors on this hub yet.' : ''),
    );
  }

  const logoUrl = block.logo?.url || null;

  const cells = doors.map((door, index) => {
    const lean = LEAN[index % LEAN.length];
    const go = () => {
      const orgId = currentOrgId();
      if (!door.targetId || !orgId) return;
      navigate(`/o/${orgId}/${door.targetId}`);
    };

    const cell = h(
      'div',
      {
        class: 'hub-door',
        dataset: {
          corner: lean.corner,
          chamfer: lean.chamfer,
          side: lean.side,
          icon: lean.icon,
        },
        style: { '--d': `${0.05 + index * 0.11}s`, '--i': String(index) },
        role: 'button',
        tabindex: '0',
        'aria-label': door.label,
        onclick: go,
        onkeydown: (event) => {
          if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); go(); }
        },
      },
      h('span', { class: 'hub-door__accent', 'aria-hidden': 'true' }),
      h(
        'article',
        { class: 'hub-door__card' },
        h('span', { class: 'hub-door__numeral', 'aria-hidden': 'true' }, String(index + 1)),
        h(
          'span',
          { class: 'hub-door__badge', 'aria-hidden': 'true' },
          logoUrl ? h('img', { src: logoUrl, alt: '' }) : null,
        ),
        h(
          'div',
          { class: 'hub-door__content' },
          h('h3', { class: 'hub-door__label' }, h('span', { class: 'hub-door__jit' }, ...letters(door.label))),
          h('span', { class: 'hub-door__bar' }),
        ),
      ),
    );
    /* The reference observes each cell and replays on re-entry; kept as is.
       The one addition is the slide title card: a door that dealt itself while
       the card was still up would have finished before anyone saw it, so the
       reveal waits out whatever hold the slide publishes. */
    if (typeof IntersectionObserver !== "undefined") {
      const io = new IntersectionObserver((records) => {
        for (const record of records) {
          if (!record.isIntersecting) { cell.classList.remove("is-in"); continue; }
          const slide = cell.closest(".slide");
          const hold = slide
            ? parseFloat(getComputedStyle(slide).getPropertyValue("--intro-hold")) || 0
            : 0;
          setTimeout(() => cell.classList.add("is-in"), hold * 1000 + 40);
        }
      }, { threshold: 0.15, rootMargin: "0px 0px -10% 0px" });
      io.observe(cell);
    } else {
      cell.classList.add("is-in");
    }

    return cell;
  });

  return h(
    'div',
    { class: 'hub' },
    block.kicker || block.standfirst
      ? h(
        'header',
        { class: 'hub__head' },
        block.kicker ? h('p', { class: 'hub__kicker' }, block.kicker) : null,
        block.standfirst ? h('p', { class: 'hub__standfirst' }, block.standfirst) : null,
      )
      : null,
    h('div', { class: 'hub__grid' }, ...cells),
  );
}
