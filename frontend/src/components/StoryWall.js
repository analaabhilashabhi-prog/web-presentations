import { h, svg } from '../utils/dom.js';
import { icon } from '../utils/icons.js';
import { media } from '../utils/media.js';

/**
 * Success Stories as a card carousel that arrives folded.
 *
 * It opens as a single stack — one card face on, the rest tucked behind it with a
 * step of offset each — and one click deals them into a row. From there the arrows
 * walk along it, the centre card sits full size with its neighbours set back, and
 * a card's own View opens the photograph at full size.
 *
 * Every card is placed by one function, for both states. Nothing is measured and
 * no FLIP is needed: a card's transform is a pure function of how far it is from
 * the centre and whether the deck is open, so changing state is a matter of
 * recomputing and letting CSS interpolate. That is also why dealing out and
 * stepping along share a motion — they are the same calculation with different
 * inputs.
 *
 * Photographs are contained rather than cropped, and capped at twice their own
 * pixels. Sixteen of the twenty-five files are 206px square; at their own size on
 * a card they read as small and sharp, which is honest, where filling the frame
 * would enlarge them about fivefold.
 */

const REDUCED = window.matchMedia?.('(prefers-reduced-motion: reduce)');

/* How far apart the dealt cards sit, and how many show either side of centre. */
/* Must exceed the card width (396px) or dealt neighbours overlap the centre. */
const STEP = 438;
/* One neighbour each side, not two. At a 438px step a second wing puts its card
   at 876px from centre — past the edge of a 1600px slide — so it was drawn at
   half opacity and then clipped, which reads as a bug rather than depth. */
const WINGS = 1;
const MAX_ENLARGE = 2;

/* The line the cards hang from is a shallow parabola that *sags* — its lowest
   point is the middle of the slide and it climbs away to both ends, which is what
   a wire strung between two walls actually does. `riseAt` gives the climb above
   the trough at a given distance out from the centre. Wire and cards are both
   drawn from this one number, which is what keeps every card's top edge on the
   curve without anything being measured. */
const BEND = 0.000164;
const riseAt = (x) => BEND * x * x;
/* Half the tangent, not the whole of it: the true slope at one step out is 3.6°
   and reads as a card blown over rather than one hung on a sloping line. Cards
   lean into the valley, so the sign is against the direction of travel. */
const TILT = 2.8;
/* Half the drawn length of the wire, and the stroke room kept above its ends. */
const WIRE_SPAN = 740;
const WIRE_LIP = 6;

/**
 * The headline, split so each line can be set differently.
 *
 * It breaks at a dash or at the joining word — "The Legacy of Babji Neelam" sets
 * as "THE LEGACY" over "OF BABJI NEELAM", and the joining word stays with the
 * second line where it belongs. The last word before the break takes the accent
 * colour, which puts the weight on the subject rather than on the article in
 * front of it.
 */
function titleLines(raw) {
  const text = String(raw || 'Success Stories').replace(/[—–-]/g, '—');
  const dash = text.indexOf('—');
  const joiner = /\s(of|for|at|in)\s/i.exec(text);
  const cut = dash >= 0
    ? { at: dash, resume: dash + 1 }
    : (joiner ? { at: joiner.index, resume: joiner.index + 1 } : null);
  const head = (cut ? text.slice(0, cut.at) : text).trim();
  const name = cut ? text.slice(cut.resume).trim() : '';
  const words = (head || 'Success Stories').split(/\s+/);
  return {
    lead: words.length > 1 ? words.slice(0, -1).join(' ') : '',
    accent: words[words.length - 1] || '',
    name,
  };
}

export function StoryWall(block, { editing = false } = {}) {
  const stories = (block.stories || []).filter((s) => s.photo);
  const root = h('div', { class: 'sw-root ph-root' });

  if (!stories.length) {
    root.appendChild(h('div', { class: 'sw-empty' },
      h('h2', { class: 'sw-title' }, block.title || 'Success Stories'),
      editing
        ? h('p', { class: 'sw-hint' },
            'Drop the portraits into backend/uploads/stories/ and re-run the publish step.')
        : null,
    ));
    return root;
  }

  const src = (story) => media(`/uploads/${encodeURI(story.photo)}`);
  const count = stories.length;
  let centre = 0;
  let open = false;
  const titleEl = h('h2', { class: 'sw-title' });
  /* What the headline currently says, so a step that does not change it does not
     rebuild it — otherwise every arrow press replays the entrance animation on a
     word that is not moving. */
  let lastTitle = null;

  /* ------------------------------------------------------------ the viewer */
  /* Portalled to the body: FitSlide scales the slide with a transform, and a
     transformed ancestor becomes the containing block for fixed descendants, so
     inside the slide `inset: 0` would resolve to the slide and not the screen. */
  const bigImg = h('img', { class: 'sw-view__img', alt: '' });
  const bigCap = h('p', { class: 'sw-view__cap' });
  const viewer = h('div', {
    class: 'sw-view', hidden: true,
    onclick: (e) => { if (e.target === viewer || e.target.closest('.sw-view__close')) shut(); },
  },
    h('button', { class: 'sw-view__close', type: 'button', 'aria-label': 'Close' },
      icon('close', { class: 'ic ic--sm' })),
    h('figure', { class: 'sw-view__frame' }, bigImg, h('figcaption', {}, bigCap)),
  );
  document.body.appendChild(viewer);

  function shut() {
    viewer.hidden = true;
    viewer.classList.remove('is-on');
    document.removeEventListener('keydown', onViewKey, true);
  }
  function onViewKey(e) {
    if (e.key === 'Escape') { e.stopPropagation(); shut(); }
  }
  function view(i) {
    const story = stories[i];
    if (!story) return;
    bigImg.src = src(story);
    bigImg.alt = story.name || '';
    bigCap.textContent = story.name || '';
    viewer.hidden = false;
    requestAnimationFrame(() => viewer.classList.add('is-on'));
    document.addEventListener('keydown', onViewKey, true);
  }

  /* -------------------------------------------------------------- the cards */
  const cards = stories.map((story, i) => {
    const shot = h('img', {
      class: 'sw-c__img', src: src(story), alt: story.name || '',
      loading: i < 6 ? 'eager' : 'lazy', decoding: 'async',
    });
    /* Capped at twice its own pixels once the file has decoded — max-width alone
       would not do it, because the image is sized by the card, not by itself. */
    shot.addEventListener('load', () => {
      const { naturalWidth: nw, naturalHeight: nh } = shot;
      if (!nw || !nh) return;
      shot.style.maxWidth = `min(100%, ${nw * MAX_ENLARGE}px)`;
      shot.style.maxHeight = `min(100%, ${nh * MAX_ENLARGE}px)`;
    });

    /* The clip stays outside the swaying body, because a clip does not swing —
       the card hangs from it. Putting it inside would have the whole fixture
       rock, which reads as the wall moving rather than the picture. It straddles
       the wire and the card's top edge, so there is no cord: the card is held
       against the line, not suspended below it. */
    const card = h('article', { class: 'sw-c' },
      h('span', { class: 'sw-c__clip', 'aria-hidden': 'true' }),
      h('div', {
        class: 'sw-c__body',
        style: REDUCED?.matches ? {} : {
          /* Primes, so no two pictures swing in step — a row of cards all
             rocking together looks mechanical rather than hung. */
          '--sway-dur': `${5200 + ((i * 617) % 2600)}ms`,
          '--sway-delay': `-${(i * 431) % 3300}ms`,
        },
      },
        h('div', { class: 'sw-c__shot' }, shot),
        h('div', { class: 'sw-c__foot' },
          h('p', { class: 'sw-c__name' }, story.name || 'Untitled'),
          h('button', {
            class: 'sw-c__view', type: 'button',
            onclick: (e) => { e.stopPropagation(); view(i); },
          }, 'View', icon('arrow-right', { class: 'ic ic--xs' })),
        ),
      ),
    );
    /* The whole card is the target. Folded, any click deals the deck out; dealt,
       a neighbour walks to the centre and the centre card opens. */
    card.addEventListener('click', () => {
      if (!open) { deal(); return; }
      if (i === centre) view(i);
      else go(i);
    });
    return card;
  });

  /* The wire, drawn once behind the row. It only shows when the deck is dealt —
     folded, every clip is in the same place and a rail through one point is just
     a line across the slide.

     A quadratic Bézier whose control point sits twice the sag below its two ends
     passes through exactly the parabola `riseAt` describes — not an approximation
     of it — so the drawn line and the placed cards cannot drift apart.

     The lift is handed to CSS rather than written there, because the height of the
     box above its trough is `riseAt(WIRE_SPAN)` and only this file knows it. Write
     it twice and one copy goes stale the first time the bend is tuned. */
  const wireRise = riseAt(WIRE_SPAN);
  const wire = svg('svg', {
    class: 'sw-wire', 'aria-hidden': 'true',
    width: WIRE_SPAN * 2, height: wireRise + WIRE_LIP * 2,
    viewBox: `0 0 ${WIRE_SPAN * 2} ${wireRise + WIRE_LIP * 2}`,
    style: { '--wire-lift': `${(wireRise + WIRE_LIP).toFixed(1)}px` },
  },
    svg('path', {
      d: `M 0 ${WIRE_LIP}`
        + ` Q ${WIRE_SPAN} ${(WIRE_LIP + wireRise * 2).toFixed(1)}`
        + ` ${WIRE_SPAN * 2} ${WIRE_LIP}`,
      fill: 'none',
    }),
  );
  const deck = h('div', { class: 'sw-deck' }, wire, ...cards);

  /* ----------------------------------------------------------- the backdrop
     The photographs an achievement has beyond the one on its card. They fill the
     wall behind the deck while that card is centred, one set per achievement,
     crossfading as the collection is stepped through.

     Only while the deck is dealt. Folded, the section is a poster — its own
     gradient and the headline — and that is what it should arrive as; the
     photographs belong to the act of going through the collection.

     An achievement with a single photograph has no set at all, so the gradient
     stands, which is what was asked for rather than a fallback. */
  const bgSets = stories.map((story) => h(
    'div',
    { class: 'sw-bg__set' },
    ...(story.backdrop || []).slice(0, 6).map((path, i) => h('img', {
      src: media(`/uploads/${encodeURI(path)}`),
      alt: '', loading: i < 2 ? 'eager' : 'lazy', decoding: 'async',
      // A backdrop that 404s should leave the gradient, not a grey panel.
      onerror: (e) => e.currentTarget.remove(),
    })),
  ));
  const backdrop = h('div', { class: 'sw-bg', 'aria-hidden': 'true' }, ...bgSets);

  /**
   * One placement rule for both states.
   *
   * Folded, a card's offset is its depth in the pile, clamped — so the fourth card
   * back and the twenty-fourth sit in the same place and only the front few are
   * drawn at all. Dealt, its offset is how far it is from the centre. Same
   * function, different input, which is why the deal and the step share a motion
   * and neither needed measuring.
   */
  function place() {
    cards.forEach((card, i) => {
      const d = i - centre;
      const away = Math.abs(d);
      if (!open) {
        const depth = Math.min(away, 3);
        card.style.transform =
          `translateX(-50%) translate(${depth * 15}px, ${depth * 9}px) rotate(${depth * 1.4}deg) scale(${1 - depth * 0.05})`;
        card.style.opacity = away <= 3 ? '1' : '0';
        card.style.zIndex = String(40 - depth);
        card.style.pointerEvents = away === 0 ? 'auto' : 'none';
        card.classList.toggle('is-centre', away === 0);
        return;
      }
      /* The origin is the top edge, so scaling a neighbour shrinks it downward
         from its clip rather than about its middle, and the vertical offset lifts
         each card by the curve's own climb at that card's distance out — the
         centre card sits in the trough and the wings ride up the sides. Rotation
         comes last in the string and so is applied about that same top-centre
         point: the clip stays on the line and the card swings under it. */
      const lift = riseAt(d * STEP);
      card.style.transform =
        `translateX(-50%) translateX(${d * STEP}px) translateY(${(-lift).toFixed(1)}px)`
        + ` rotate(${(-d * TILT).toFixed(2)}deg) scale(${away === 0 ? 1 : 0.84})`;
      card.style.opacity = away <= WINGS ? (away === 0 ? '1' : '0.5') : '0';
      card.style.zIndex = String(40 - away);
      card.style.pointerEvents = away <= WINGS ? 'auto' : 'none';
      card.classList.toggle('is-centre', away === 0);
    });
    prev.disabled = open && centre === 0;
    next.disabled = open && centre === count - 1;
    counter.textContent = `${String(centre + 1).padStart(2, '0')} / ${count}`;
    bgSets.forEach((set, i) => {
      set.classList.toggle('is-on', open && i === centre && set.childElementCount > 0);
    });
    paintTitle();
  }

  /**
   * The headline names whatever is in front of you.
   *
   * Folded it is the section's own title, set as the poster line it was designed
   * as. Dealt, it becomes the centred achievement's name and changes as the
   * collection is stepped through. The elements are rebuilt rather than having
   * their text swapped, because the entrance animation is on the element — a new
   * node replays it, so the name arrives rather than blinking.
   */
  function paintTitle() {
    const now = open ? (stories[centre]?.name || '').trim() : '';
    if (now === lastTitle) return;
    lastTitle = now;
    titleEl.textContent = '';
    titleEl.classList.toggle('is-now', Boolean(now));
    if (now) {
      titleEl.appendChild(h('span', { class: 'sw-title__now' }, now));
      return;
    }
    const { lead, accent, name } = titleLines(block.title);
    if (lead) titleEl.appendChild(h('span', { class: 'sw-title__lead' }, lead));
    if (accent) titleEl.appendChild(h('span', { class: 'sw-title__accent' }, accent));
    if (name) titleEl.appendChild(h('span', { class: 'sw-title__name' }, name));
  }

  const go = (i) => { centre = Math.max(0, Math.min(count - 1, i)); place(); };

  function deal() {
    open = true;
    root.classList.add('is-open');
    place();
  }
  function fold() {
    open = false;
    centre = 0;
    root.classList.remove('is-open');
    place();
  }

  /* ---------------------------------------------------------------- controls */
  const prev = h('button', {
    class: 'sw-nav__btn', type: 'button', 'aria-label': 'Previous',
    onclick: () => go(centre - 1),
  }, icon('chevron-left', { class: 'ic ic--sm' }));
  const next = h('button', {
    class: 'sw-nav__btn', type: 'button', 'aria-label': 'Next',
    onclick: () => go(centre + 1),
  }, icon('chevron-right', { class: 'ic ic--sm' }));
  const counter = h('span', { class: 'sw-nav__count' });
  const nav = h('div', { class: 'sw-nav' },
    prev, counter, next,
    h('button', { class: 'sw-nav__fold', type: 'button', onclick: fold }, 'Fold'),
  );

  /* ------------------------------------------------------------------ header */
  const head = h('div', { class: 'sw-head' },
    titleEl,
    h('button', {
      class: 'sw-open', type: 'button',
      onclick: () => (open ? fold() : deal()),
    },
      h('span', { class: 'sw-open__label' }, 'Deal the collection'),
      icon('layers', { class: 'ic ic--xs' }),
    ),
  );

  root.appendChild(backdrop);
  root.appendChild(head);
  root.appendChild(deck);
  root.appendChild(nav);

  root.addEventListener('keydown', (event) => {
    if (!open) return;
    if (event.key === 'ArrowRight') { event.stopPropagation(); event.preventDefault(); go(centre + 1); }
    if (event.key === 'ArrowLeft') { event.stopPropagation(); event.preventDefault(); go(centre - 1); }
    if (event.key === 'Escape') { event.stopPropagation(); fold(); }
  });

  /* Placed on the next frame, not during construction: the first paint has to
     carry the folded transforms for the deal to animate away from them. Set them
     synchronously and the browser takes the dealt state as the starting style and
     skips the motion entirely. */
  requestAnimationFrame(place);

  /* The viewer lives on the body, so it has to be taken down by hand when the
     slide that owns it is replaced. */
  const watch = new MutationObserver(() => {
    if (!root.isConnected) {
      viewer.remove();
      watch.disconnect();
      document.removeEventListener('keydown', onViewKey, true);
    }
  });
  watch.observe(document.body, { childList: true, subtree: true });

  return root;
}
