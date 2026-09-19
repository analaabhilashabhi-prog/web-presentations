import { h } from '../utils/dom.js';
import { icon } from '../utils/icons.js';
import { media } from '../utils/media.js';
import { videoControls, withPlayerApi } from '../utils/videoControls.js';

/**
 * Centers of Excellence: a wall of accredited academies and partner practices,
 * and opening one shows its photos and videos.
 *
 * The detail view lives inside this block rather than as a child section. The
 * deck is a fixed set of sections and this is deliberately one page — nineteen
 * centres as nineteen nav rows would bury the story — so "open a centre" is a
 * state of the slide, the same way the Platforms stage works. Prev/Next still
 * moves through the deck; Escape and the back button return to the wall.
 *
 * Two things the source design does that this cannot. It loads Space Grotesk
 * and IBM Plex from Google Fonts, and the deck is presented with no internet,
 * so the page's own type carries it. And it paints drifting radial gradients
 * behind everything; white is the major surface here and the brand colour is
 * reserved for the one card you are pointing at.
 */

const LOGO_DIR = '/uploads/coe';
/* Gallery paths are stored relative to /uploads, so the manifest names the
   folder it came from and this file does not care which one that was. */
const UPLOADS = '/uploads';
const REDUCED = window.matchMedia?.('(prefers-reduced-motion: reduce)');

/** #rrggbb -> rgba(), for the one-card-deep tint and shadow. */
function tint(hex, alpha) {
  const n = parseInt(String(hex).slice(1), 16);
  if (Number.isNaN(n)) return `rgba(22, 24, 33, ${alpha})`;
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${alpha})`;
}

/**
 * The brand mark, or the centre's initials in its own colour when no file has
 * been supplied. Never a drawn approximation of someone else's logo.
 */
function brandMark(center, { full = false } = {}) {
  // Whichever file exists serves both places; a centre that only supplied a
  // wide wordmark still gets a mark on its card, and vice versa.
  const src = full ? (center.logoFull || center.logo) : (center.logo || center.logoFull);
  const chip = () => h('span', {
    class: full ? 'coe-mono coe-mono--lg' : 'coe-mono',
    style: { background: center.color, color: center.ink },
  }, center.mono || center.name.slice(0, 2).toUpperCase());

  if (!src) return chip();

  const holder = h('span', { class: full ? 'coe-logo coe-logo--lg' : 'coe-logo' });
  const img = h('img', {
    // The drop uses spaces in filenames, so the path has to be encoded.
    src: media(`/uploads/coe/${encodeURI(src)}`),
    alt: center.name,
    loading: 'lazy',
    decoding: 'async',
  });
  img.addEventListener('error', () => holder.replaceWith(chip()));
  holder.appendChild(img);
  return holder;
}

/* -------------------------------------------------------------- the orbit */

/**
 * The page opens on the twenty centres circling the organization's own mark,
 * then collapses into the wall on a click.
 *
 * Each ring spins as one element and every logo counter-spins at the same rate,
 * so the marks stay upright while the ring turns. Doing it the other way — one
 * animation per logo around a shared origin — is twenty animations fighting for
 * the same frame; this is two.
 */
function orbitStage(centers, block, onEnter) {
  const stage = h('div', { class: 'coe-orbit', role: 'button', tabindex: '0',
    title: 'Click to see every center' });

  // The inner ring is the shorter one, so it takes the smaller share.
  const inner = centers.slice(0, 8);
  const outer = centers.slice(8);

  const ring = (list, radius, seconds, reverse) => {
    const wheel = h('div', {
      class: `coe-ring${reverse ? ' coe-ring--rev' : ''}`,
      style: { width: `${radius * 2}px`, height: `${radius * 2}px`, 'animation-duration': `${seconds}s` },
    });
    wheel.appendChild(h('span', { class: 'coe-ring__path' }));
    list.forEach((center, i) => {
      const angle = (360 / list.length) * i;
      /* Three nested transforms, and they have to be three. The seat places
         the mark on the ring; the fix undoes that placement angle so the mark
         is upright at rest; the spin undoes the ring's rotation frame by frame.
         Folding the fix into the spin does not work — a running animation
         overrides the inline transform, and every mark ends up tilted by its
         own seat angle. */
      const seat = h('span', {
        class: 'coe-seat',
        style: { transform: `rotate(${angle}deg) translateY(-${radius}px)` },
      },
        h('span', { class: 'coe-seat__fix', style: { transform: `rotate(${-angle}deg)` } },
          h('span', {
            class: `coe-seat__spin${reverse ? ' coe-seat__spin--rev' : ''}`,
            style: { 'animation-duration': `${seconds}s` },
          }, brandMark(center)),
        ),
      );
      wheel.appendChild(seat);
    });
    return wheel;
  };

  // The line leads, the wheel follows — it reads as a headline, not a caption.
  stage.appendChild(h('p', { class: 'coe-orbit__cue coe-shine' },
    block.title || 'Click anywhere to explore every center'));

  stage.appendChild(h('div', { class: 'coe-orbit__field' },
    ring(outer, 300, 64, false),
    ring(inner, 180, 46, true),
    h('span', { class: 'coe-hub' },
      block.hubLogo
        ? h('img', { src: media(block.hubLogo), alt: block.hubName || '', loading: 'eager' })
        : h('b', {}, (block.hubName || 'Hub').slice(0, 2).toUpperCase()),
    ),
  ));

  const go = () => onEnter();
  stage.addEventListener('click', go);
  stage.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); go(); }
  });
  return stage;
}

/* --------------------------------------------------------------- the wall */

function centerCard(center, index, onOpen) {
  const card = h('button', {
    class: 'coe-card',
    type: 'button',
    style: {
      '--coe-color': center.color,
      '--coe-wash': tint(center.color, 0.10),
      '--coe-edge': tint(center.color, 0.42),
      '--coe-glow': tint(center.color, 0.30),
      'transition-delay': REDUCED?.matches ? '0ms' : `${Math.min(index * 26, 420)}ms`,
    },
    onclick: () => onOpen(center),
  },
    h('span', { class: 'coe-card__top' }, brandMark(center, { size: 52 })),
    h('span', { class: 'coe-card__name' }, center.name),
    center.tagline ? h('span', { class: 'coe-card__tag' }, center.tagline) : null,
    /* The foot used to say "Photos & videos" (or the count); that option was
       removed from this section on request (2026-09-17). */
    h('span', { class: 'coe-card__foot' },
      h('span', {}),
      h('span', { class: 'coe-card__go' }, 'Open', icon('arrow-right', { class: 'ic ic--xs' })),
    ),
  );
  return card;
}

/* ------------------------------------------------------------- the detail */

/* The vendor academies publish their films on YouTube rather than as files, so a
   centre's strip has to hold both. A frame is on another origin and cannot be
   read or called, which is why the hover bar drives it by postMessage — the same
   arrangement every other player in the deck uses. */
const YT_PARAMS = withPlayerApi('autoplay=1&controls=0&modestbranding=1&rel=0'
  + '&iv_load_policy=3&playsinline=1&disablekb=1&fs=0&color=white');

function youtubeTile(item, center) {
  /* Mounted on click, not on open. Four Pega films that all start the instant a
     centre is opened is four soundtracks at once, and an iframe cannot be told to
     wait once it is in the document. */
  const box = h('div', { class: 'coe-tile__media coe-tile__yt' });
  const start = h('button', {
    class: 'coe-tile__play', type: 'button',
    'aria-label': `Play ${item.label || center.name}`,
    onclick: () => {
      const frame = h('iframe', {
        class: 'coe-tile__frame',
        src: `https://www.youtube-nocookie.com/embed/${encodeURIComponent(item.youtube)}?${YT_PARAMS}`,
        title: item.label || center.name, frameborder: '0',
        allow: 'autoplay; encrypted-media; picture-in-picture', allowfullscreen: '',
      });
      box.replaceChildren(frame, videoControls(frame));
      box.classList.add('is-live');
    },
  }, icon('play', { class: 'ic' }));
  /* A poster is a nicety: it comes from i.ytimg.com and there is no network at
     presentation time, so it removes itself on error and the plate carries the
     caption instead. */
  const shot = h('img', {
    class: 'coe-tile__poster', alt: '', loading: 'lazy', decoding: 'async',
    src: `https://i.ytimg.com/vi/${encodeURIComponent(item.youtube)}/hqdefault.jpg`,
  });
  shot.addEventListener('error', () => shot.remove());
  box.append(shot, start);
  return h('figure', { class: 'coe-tile coe-tile--yt has-vc' }, box,
    item.label ? h('figcaption', {}, item.label) : null);
}

function mediaTile(item, center) {
  if (item.youtube) return youtubeTile(item, center);
  const src = media(`/uploads/${encodeURI(item.src)}`);
  if (item.kind === 'video') {
    const video = h('video', {
      class: 'coe-tile__media',
      controls: true, preload: 'metadata', playsinline: true,
      src,
    });
    return h('figure', { class: 'coe-tile has-vc' }, video, videoControls(video),
      item.label ? h('figcaption', {}, item.label) : null);
  }
  const img = h('img', {
    class: 'coe-tile__media', src, alt: item.label || center.name,
    loading: 'lazy', decoding: 'async',
  });
  return h('figure', { class: 'coe-tile' }, img,
    item.label ? h('figcaption', {}, item.label) : null);
}

export function CentersOfExcellence(block, { editing = false } = {}) {
  const centers = (block.centers || []).filter((c) => c.key && c.name);
  if (!centers.length) {
    return h('div', { class: 'coe-root coe-root--empty ph-root' }, 'No centers yet.');
  }

  const root = h('div', { class: 'coe-root ph-root' });
  const grid = h('div', { class: 'coe-grid' });
  const detail = h('div', { class: 'coe-detail' });

  const cards = [];
  const OPEN_MS = REDUCED?.matches ? 0 : 460;

  /**
   * Opening a centre is not a cut. The card you pressed scales up and fades
   * through, everything else drops back a little, nearest first, and the
   * detail rises into the space they left. Closing runs it backwards.
   */
  const settleCards = () => cards.forEach((el) => {
    el.style.transitionDelay = '0ms';
    el.style.transform = '';
    el.style.opacity = '';
  });

  const scatterFrom = (index) => cards.forEach((el, i) => {
    const gap = Math.abs(i - index);
    el.style.transitionDelay = `${Math.min(gap * 20, 220)}ms`;
    el.style.transform = i === index ? 'scale(1.14)' : 'translateY(26px) scale(.94)';
    el.style.opacity = '0';
  });

  const close = () => {
    root.classList.remove('is-open');
    detail.replaceChildren();
    root.querySelector('.coe-wall')?.scrollTo({ top: 0, behavior: 'auto' });
    requestAnimationFrame(settleCards);
  };

  /* The detail is the centre's mark, name and line, and under the rule the
     centre's own photographs and films. The gallery was taken off this section
     on 2026-09-17 and asked for again: a card that opens on a wordmark and
     nothing else is a page that says nothing the wall had not already said.
     Only the pictures filed against that centre are shown — never another
     centre's — and a centre with none says so rather than drawing an empty
     masonry. */
  const paintDetail = (center) => {
    const shots = (center.media || []).filter((m) => m && (m.src || m.youtube));
    /* The masonry is a column layout, so the number of columns is the one thing
       it needs told. Two pictures in three columns leaves a hole; the count is
       capped at three and never exceeds what there is to put in it. */
    const cols = Math.max(1, Math.min(3, shots.length));

    detail.replaceChildren(
      h('button', { class: 'coe-back', type: 'button', onclick: close },
        icon('chevron-left', { class: 'ic ic--xs' }), h('span', {}, 'All centers')),
      h('div', { class: 'coe-hero' },
        brandMark(center, { full: true }),
        h('div', { class: 'coe-hero__id' },
          h('h3', { class: 'coe-hero__name' }, center.name),
          center.tagline ? h('p', { class: 'coe-hero__tag' }, center.tagline) : null,
        ),
      ),
      h('div', { class: 'coe-rule', style: { background: center.color } }),
      shots.length
        ? h('div', { class: 'coe-gal__head' },
            h('h4', {}, 'Photos & films'),
            h('span', {}, `${shots.length} item${shots.length === 1 ? '' : 's'}`))
        : null,
      shots.length
        ? h('div', { class: 'coe-gal', style: { 'column-count': String(cols) } },
            ...shots.map((item) => mediaTile(item, center)))
        : h('p', { class: 'coe-gal__none' }, 'No photographs filed for this center yet.'),
    );
    root.classList.add('is-open');
    detail.scrollTop = 0;
  };

  let opening = false;
  const open = (center, index) => {
    if (opening || root.classList.contains('is-open')) return;
    if (!OPEN_MS) { paintDetail(center); return; }
    opening = true;
    scatterFrom(index);
    setTimeout(() => { paintDetail(center); opening = false; }, OPEN_MS);
  };

  centers.forEach((c, i) => {
    const card = centerCard(c, i, () => open(c, i));
    cards.push(card);
    grid.appendChild(card);
  });

  /* Three states, not three pages: orbit -> wall -> a centre. Back from a
     centre lands on the wall, so a presenter can open one after another
     without the wheel replaying between each. */
  const wall = h('div', { class: 'coe-wall' },
    /* One line, and nothing else. The eyebrow, the standfirst and the
       counters were four competing pieces of furniture above a wall that
       already says what it is — twenty marks a room recognises on sight. */
    h('div', { class: 'coe-head' },
      block.title ? h('h2', { class: 'coe-title coe-shine' }, block.title) : null,
    ),
    grid,
  );

  /**
   * Leaving the orbit: the rings draw in towards the mark and fade, and the
   * wall is only revealed once they have gone — so the cards look like they
   * settled out of the wheel rather than replacing it.
   */
  let entered = false;
  const enterWall = () => {
    if (entered) return;
    entered = true;
    root.classList.add('is-collapsing');
    setTimeout(() => {
      root.classList.remove('is-collapsing');
      root.classList.add('is-wall');
      revealCards();
    }, REDUCED?.matches ? 0 : 620);
  };

  const orbit = orbitStage(centers, block, enterWall);
  root.appendChild(orbit);
  root.appendChild(wall);
  root.appendChild(detail);

  /**
   * The wheel hands over on its own after seven seconds.
   *
   * It is the slide's first impression and it is worth watching, but nobody is
   * going to walk to a laptop to press it in front of a room — so the orbit
   * holds, collapses into the mark, and the wall of centres settles out of it
   * unasked. Opening a centre from there is still a press: that is the part a
   * presenter is choosing, and it is never done for them.
   *
   * Four things, the same four Torii Connect's folder had to learn:
   *   - It happens once and it never goes back. Nothing puts the wheel up
   *     again while somebody is talking about a centre.
   *   - A hand yields it. Any press, key or wheel on the slide before the
   *     timer runs cancels it outright, so a presenter who has already entered
   *     — or who is deliberately holding on the wheel to talk about it — is
   *     not overruled a second later.
   *   - It takes no focus. `enterWall` is the answer to a press and there has
   *     been no press; pulling the focus ring onto a card nobody asked for is
   *     the kind of thing a room notices.
   *   - `isConnected` is checked when the timer FIRES, never when it is set.
   *     The schedule is made while this component is still being built, before
   *     the caller has appended it, so at schedule time it is always false —
   *     that exact mistake left the Events wheel sitting on photograph one.
   */
  const HOLD_MS = 7000;
  if (!REDUCED?.matches) {
    let hold = setTimeout(() => {
      hold = 0;
      if (root.isConnected) enterWall();
    }, HOLD_MS);
    const yieldToHand = () => {
      if (!hold) return;
      clearTimeout(hold);
      hold = 0;
    };
    root.addEventListener('pointerdown', yieldToHand);
    root.addEventListener('keydown', yieldToHand);
    root.addEventListener('wheel', yieldToHand, { passive: true });
  }

  /**
   * The wall assembles itself in reading order rather than appearing all at
   * once. This runs when the orbit hands over, not on mount — the cards are
   * behind the wheel until then and animating them there would spend the whole
   * effect on nobody.
   */
  cards.forEach((el) => el.classList.add('is-waiting'));
  const revealCards = () => {
    if (REDUCED?.matches) {
      cards.forEach((el) => el.classList.remove('is-waiting'));
      return;
    }
    cards.forEach((el, i) => {
      setTimeout(() => el.classList.remove('is-waiting'), 40 + Math.min(i * 32, 620));
    });
  };

  // Escape returns to the wall, matching every other overlay in the deck.
  root.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && root.classList.contains('is-open')) {
      event.stopPropagation();
      close();
    }
  });

  return root;
}
