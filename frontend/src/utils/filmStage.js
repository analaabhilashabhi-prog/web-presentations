import { h } from './dom.js';
import { icon } from './icons.js';
import { media } from './media.js';
import { videoControls, withPlayerApi } from './videoControls.js';

/**
 * A film played across the whole screen, and the poster plate that stands in for
 * one before it starts.
 *
 * Shared because two sections now want exactly this: the events reel and the
 * student video resumes. Both hold a list of films, both want one of them filling
 * the display with the room looking at it, and both want to step to the next
 * without going back to a grid first.
 *
 * Portalled to `document.body`, never left inside the slide. FitSlide scales the
 * slide with a transform, and a transformed ancestor becomes the containing block
 * for fixed descendants — so `inset: 0` inside a slide resolves to the slide's
 * own 1600×900 box rather than to the screen, which is the difference between
 * full screen and a rectangle in the middle of one.
 *
 * The frame is mounted on open and removed on close. A hidden iframe keeps
 * playing, so hiding it would leave a soundtrack running underneath the deck.
 */

const REDUCED = window.matchMedia?.('(prefers-reduced-motion: reduce)');

/* enablejsapi is what lets the hover controls reach the frame at all: without it
   postMessage is ignored and every button on the bar does nothing. */
const YT = withPlayerApi('autoplay=1&controls=0&modestbranding=1&rel=0&iv_load_policy=3'
  + '&playsinline=1&disablekb=1&fs=0&color=white');

export const ytEmbed = (id) => `https://www.youtube-nocookie.com/embed/${encodeURIComponent(id)}?${YT}`;
export const ytPoster = (id) => `https://i.ytimg.com/vi/${encodeURIComponent(id)}/hqdefault.jpg`;

/**
 * A YouTube poster that removes itself rather than leaving a broken frame.
 *
 * The posters come from i.ytimg.com and there is no network at presentation time,
 * so no layout may depend on one arriving. Every plate that uses this has to read
 * correctly with the image gone.
 */
export function posterImg(youtube, { eager = false } = {}) {
  if (!youtube) return null;
  const img = h('img', {
    class: 'fs-poster', src: ytPoster(youtube), alt: '',
    loading: eager ? 'eager' : 'lazy', decoding: 'async',
  });
  img.addEventListener('error', () => img.remove());
  return img;
}

/**
 * Build a full-screen film stage.
 *
 * `getFilms()` is called at open time rather than captured, so a page can change
 * what the arrows walk — a different chapter, a filtered list — without rebuilding
 * the stage. A film is `{ youtube | src, title, sub }`.
 *
 * Returns `{ open(index), close(), destroy() }`.
 */
export function filmStage({ label = 'Film' } = {}) {
  let films = [];
  let at = 0;

  const frame = h('div', { class: 'fs-frame' });
  const title = h('h3', { class: 'fs-title' });
  const sub = h('p', { class: 'fs-sub' });
  const count = h('span', { class: 'fs-count' });

  const prevBtn = h('button', {
    class: 'fs-nav fs-nav--prev', type: 'button', 'aria-label': `Previous ${label.toLowerCase()}`,
    onclick: (e) => { e.stopPropagation(); step(-1); },
  }, icon('chevron-left', { class: 'ic' }));

  const nextBtn = h('button', {
    class: 'fs-nav fs-nav--next', type: 'button', 'aria-label': `Next ${label.toLowerCase()}`,
    onclick: (e) => { e.stopPropagation(); step(1); },
  }, icon('chevron-right', { class: 'ic' }));

  const closeBtn = h('button', {
    class: 'fs-close', type: 'button', 'aria-label': 'Close and back to page',
    onclick: (e) => { e.stopPropagation(); close(); },
  }, icon('chevron-left', { class: 'ic ic--sm' }), h('span', { class: 'fs-close__text' }, 'BACK TO GALLERY'));

  const root = h('div', {
    class: 'fs-root', hidden: true,
    /* Only the backdrop closes. A click that lands on the film itself must not,
       or every attempt to reach the control bar shuts the film down. */
    onclick: (e) => { if (e.target === root) close(); },
  },
    closeBtn, prevBtn, nextBtn,
    h('div', { class: 'fs-box' }, frame),
    h('div', { class: 'fs-bar' },
      h('div', { class: 'fs-bar__text' }, title, sub),
      count,
    ),
  );
  document.body.appendChild(root);

  /** Unmount, never hide: a hidden iframe carries on playing. */
  function clearFrame() {
    frame.replaceChildren();
  }

  function paint() {
    const film = films[at];
    if (!film) return;
    clearFrame();

    const surface = film.youtube
      ? h('iframe', {
          class: 'fs-yt', src: ytEmbed(film.youtube),
          title: film.title || label, frameborder: '0',
          allow: 'autoplay; encrypted-media; picture-in-picture', allowfullscreen: '',
        })
      : h('video', {
          class: 'fs-file', src: media(`/uploads/${encodeURI(film.src)}`),
          autoplay: true, muted: true, playsinline: true, controls: false,
        });
    frame.append(surface, videoControls(surface));

    title.textContent = film.title || '';
    sub.textContent = film.sub || '';
    sub.hidden = !film.sub;
    count.textContent = films.length > 1 ? `${at + 1} / ${films.length}` : '';
    const many = films.length > 1;
    prevBtn.hidden = !many;
    nextBtn.hidden = !many;
  }

  /** Wraps, so the arrows never dead-end in front of a room. */
  function step(delta) {
    if (films.length < 2) return;
    at = (at + delta + films.length) % films.length;
    paint();
  }

  function onKey(e) {
    if (e.key === 'Escape') { e.stopPropagation(); close(); return; }
    /* Swallowed, or the deck's own arrow handler changes slide underneath the
       film that is playing. */
    if (e.key === 'ArrowRight') { e.stopPropagation(); e.preventDefault(); step(1); }
    if (e.key === 'ArrowLeft') { e.stopPropagation(); e.preventDefault(); step(-1); }
  }

  function open(list, index = 0) {
    films = Array.isArray(list) ? list.filter((f) => f && (f.youtube || f.src)) : [];
    if (!films.length) return;
    at = Math.max(0, Math.min(films.length - 1, index));
    paint();
    root.hidden = false;
    if (REDUCED?.matches) root.classList.add('is-on');
    else requestAnimationFrame(() => root.classList.add('is-on'));
    document.addEventListener('keydown', onKey, true);
  }

  function close() {
    clearFrame();
    root.classList.remove('is-on');
    document.removeEventListener('keydown', onKey, true);
    if (REDUCED?.matches) { root.hidden = true; return; }
    // Hidden once it has faded, not during — otherwise it vanishes mid-transition.
    setTimeout(() => { if (!root.classList.contains('is-on')) root.hidden = true; }, 240);
  }

  function destroy() {
    clearFrame();
    root.remove();
    document.removeEventListener('keydown', onKey, true);
  }

  return { open, close, destroy };
}

/**
 * Take the stage down when the slide that owns it is replaced.
 *
 * The stage lives on the body, so nothing removes it automatically — and a film
 * left mounted would keep playing into the next section.
 */
export function bindStageLifetime(root, stage) {
  const watch = new MutationObserver(() => {
    if (!root.isConnected) {
      stage.destroy();
      watch.disconnect();
    }
  });
  watch.observe(document.body, { childList: true, subtree: true });
  return watch;
}
