import { h } from '../utils/dom.js';
import { icon } from '../utils/icons.js';
import { media } from '../utils/media.js';
import { videoControls } from '../utils/videoControls.js';

/**
 * Programs: one card that opens into the whole set, each of those into its
 * films and photographs, each of those into the screen.
 *
 * Four states on one slide — cover, row, gallery, viewer.
 *
 * A programme's evidence is not always film. Ignite Coder has five photographs
 * and no reel, so the gallery holds both kinds and they open the same way: the
 * viewer takes a film or a photograph, and the only difference is what it mounts.
 * That is also why the cards no longer carry a count — a card reading "—" told
 * the room a programme had nothing, when it had five pictures.
 *
 * The fan-out is a FLIP. The row is the cards' real layout; the stack is a
 * transform measured off it, so opening is just releasing every card back to
 * where it already was. Animating toward a position you have not measured is
 * how you get cards that land a few pixels out and jitter on the way.
 *
 * On the films: the embed is only ever created already playing. YouTube's
 * title, channel and "Watch on YouTube" all belong to the *unstarted* state —
 * no parameter removes them, but a player that starts in motion never shows
 * that state at all. controls=0 keeps the bar from returning on hover.
 *
 * What none of this can do is work without a network. Films served from
 * /uploads play offline; these do not.
 */

const UPLOADS = '/uploads';
const REDUCED = window.matchMedia?.('(prefers-reduced-motion: reduce)');

/* enablejsapi is what lets the hover controls reach the frame at all: without
   it postMessage is ignored and the buttons do nothing. */
const YT = 'autoplay=1&controls=0&modestbranding=1&rel=0&iv_load_policy=3&enablejsapi=1'
  + '&playsinline=1&disablekb=1&fs=0&color=white';
const ytEmbed = (id) => `https://www.youtube-nocookie.com/embed/${encodeURIComponent(id)}?${YT}`;
const ytPoster = (id) => `https://i.ytimg.com/vi/${encodeURIComponent(id)}/maxresdefault.jpg`;

/** Columns that let N films fill the screen rather than sit in a strip. */
function galleryShape(n) {
  if (n <= 1) return 1;
  if (n <= 3) return n;
  if (n === 4) return 2;
  return 3;
}

export function ProgramDeck(block, { editing = false } = {}) {
  const programs = (block.programs || []).filter((p) => p.key && p.name);
  if (!programs.length) {
    return h('div', { class: 'pg-root pg-root--empty ph-root' }, 'No programmes yet.');
  }
  const root = h('div', { class: 'pg-root ph-root' });

  /* ------------------------------------------------------------ the viewer */
  const frame = h('div', { class: 'pg-player__frame' });
  const playerTitle = h('span', { class: 'pg-player__title' });
  /* Named for where it goes back to, not for what it leaves. "Back to films"
     was wrong in front of a wall of photographs, and a presenter reads the
     destination. */
  const playerBackText = h('span', {}, 'Back');

  const closePlayer = () => {
    // Unmount, don't hide — a hidden iframe keeps playing behind the gallery.
    frame.replaceChildren();
    player.classList.remove('is-portal', 'is-still', 'is-lit');
    if (player.parentNode !== root) root.appendChild(player);
    root.classList.remove('is-playing');
  };

  const player = h('div', { class: 'pg-player' },
    h('div', { class: 'pg-bar' },
      h('button', { class: 'pg-back', type: 'button', onclick: closePlayer },
        icon('chevron-left', { class: 'ic ic--xs' }), playerBackText),
      playerTitle,
    ),
    frame,
  );

  /**
   * The way out has to be visible.
   *
   * The bar was drawn at zero opacity and revealed on `:hover` alone, which is
   * no help to a presenter who has just opened a film with a click and now sees
   * a full-screen picture and no way back — the control existed but nothing said
   * so. It is lit on open and stays lit for a few seconds, and any movement over
   * the film brings it back; it still fades so it is not sitting on the footage
   * for the whole run. A photograph keeps it for good, since there is no footage
   * for it to be in the way of.
   */
  let litTimer = null;
  const lightBar = () => {
    player.classList.add('is-lit');
    clearTimeout(litTimer);
    if (player.classList.contains('is-still')) return;
    litTimer = setTimeout(() => player.classList.remove('is-lit'), 3400);
  };
  player.addEventListener('pointermove', lightBar);

  const play = (video) => {
    playerTitle.textContent = video.title || '';
    player.classList.remove('is-still');
    /* Built first, so the control bar can be handed the element it drives: it
       has to know whether it is talking to a <video> it can call directly or to
       a cross-origin frame it can only post messages at. */
    const surface = video.youtube
      ? h('iframe', {
          class: 'pg-player__yt', src: ytEmbed(video.youtube),
          title: video.title || 'Video',
          allow: 'autoplay; encrypted-media; fullscreen; picture-in-picture',
          referrerpolicy: 'strict-origin-when-cross-origin', allowfullscreen: true,
        })
      : h('video', {
          class: 'pg-player__file', src: media(`/uploads/${encodeURI(video.src)}`),
          controls: true, autoplay: true, playsinline: true,
        });
    frame.replaceChildren(surface, videoControls(surface));
    /* Out of the slide entirely while it plays. FitSlide scales the slide with
       a transform, which becomes the containing block for anything fixed inside
       it — so a player that lives in the section can only ever fill the slide,
       and when the window is not 16:9 the slide itself is letterboxed. Moved to
       the body it answers to the viewport and covers the display. The deck bar
       is fixed in the body too, at a higher z-index, so Prev / Next / Exit stay
       on top and clickable. */
    portal();
  };

  /**
   * A photograph, opened the same way a film is: same viewer, same way back.
   * Contained rather than cropped — a photograph is the content here, not a
   * backdrop, and `cover` would slice the ends off the two landscape files.
   */
  const show = (photo, label) => {
    /* The programme's name when the picture has no caption of its own: the bar is
       the only thing naming what is on screen once the gallery is behind it. */
    playerTitle.textContent = photo.caption || label || '';
    const still = h('img', {
      class: 'pg-player__img', src: media(`/uploads/${encodeURI(photo.src)}`),
      alt: photo.caption || label || '',
    });
    /* Capped at twice its own pixels once the file has decoded. The sources are
       800px wide, so at natural size they sit as a small rectangle in the middle
       of a 1600px display, and unbounded they would be blown up to whatever the
       screen is and go soft. Two-up puts an 800px file at 1600 — full width, and
       the last size it is still honestly sharp at. */
    const cap = () => {
      const { naturalWidth: nw, naturalHeight: nh } = still;
      if (!nw || !nh) return;
      still.style.maxWidth = `min(100%, ${nw * 2}px)`;
      still.style.maxHeight = `min(100%, ${nh * 2}px)`;
    };
    /* Both, not just the event: the second time a photograph is opened it comes
       from cache and is `complete` before the listener is attached, so `load`
       never fires again and the cap is never applied. */
    still.addEventListener('load', cap);
    if (still.complete) cap();
    frame.replaceChildren(still);
    player.classList.add('is-still');
    portal();
  };

  /* Out of the slide entirely. FitSlide scales the slide with a transform, which
     becomes the containing block for anything fixed inside it — so a viewer that
     lives in the section can only ever fill the slide, and when the window is not
     16:9 the slide itself is letterboxed. On the body it answers to the viewport
     and covers the display. The deck bar is fixed in the body too, at a higher
     z-index, so Prev / Next / Exit stay on top and clickable. */
  function portal() {
    if (player.parentNode !== document.body) document.body.appendChild(player);
    player.classList.add('is-portal');
    root.classList.add('is-playing');
    lightBar();
  }

  /* ----------------------------------------------------------- the gallery */
  const galleryTitle = h('h3', { class: 'pg-gal__title' });
  const galleryGrid = h('div', { class: 'pg-gal__grid' });

  const closeGallery = () => root.classList.remove('is-gallery');

  const gallery = h('div', { class: 'pg-gallery' },
    h('div', { class: 'pg-bar' },
      h('button', { class: 'pg-back', type: 'button', onclick: closeGallery },
        icon('chevron-left', { class: 'ic ic--xs' }), h('span', {}, 'All programmes')),
      galleryTitle,
    ),
    galleryGrid,
  );

  /** One tile, whichever kind of thing it stands for. */
  const tile = (item, i, program) => {
    const shot = h('span', { class: 'pg-shot' });
    if (item.kind === 'film') {
      if (item.video.youtube) {
        /* No poster may be load-bearing: they come from i.ytimg.com and there is
           no network at presentation time, so a failed one takes itself out and
           the tile falls back to type on a dark plate. */
        const img = h('img', { src: ytPoster(item.video.youtube), alt: '', loading: 'lazy' });
        img.addEventListener('error', () => img.remove());
        shot.appendChild(img);
      }
      shot.appendChild(h('span', { class: 'pg-shot__play' }, icon('play-circle', { class: 'ic' })));
    } else {
      shot.appendChild(h('img', {
        src: media(`/uploads/${encodeURI(item.photo.src)}`),
        alt: item.title, loading: i < 6 ? 'eager' : 'lazy', decoding: 'async',
      }));
      shot.appendChild(h('span', { class: 'pg-shot__play pg-shot__play--still' },
        icon('expand', { class: 'ic' })));
    }
    if (item.title) shot.appendChild(h('span', { class: 'pg-shot__name' }, item.title));
    return h('button', {
      class: `pg-vid pg-vid--${item.kind}`, type: 'button',
      /* Read by the tile's entrance animation, so they arrive in reading order
         rather than all at once. */
      style: { '--i': String(i) },
      onclick: () => (item.kind === 'film' ? play(item.video) : show(item.photo, program.name)),
    }, shot);
  };

  const openGallery = (program) => {
    galleryTitle.textContent = program.name;
    playerBackText.textContent = `Back to ${program.name}`;
    /* Films first, then photographs: where a programme has both, the film is the
       thing to open. */
    const items = [
      ...(program.videos || []).map((v) => ({ kind: 'film', video: v, title: v.title || program.name })),
      ...(program.photos || []).map((p) => ({ kind: 'still', photo: p, title: p.caption || '' })),
    ];
    galleryGrid.style.setProperty('--pg-cols', String(galleryShape(items.length)));
    galleryGrid.replaceChildren(...(items.length
      ? items.map((item, i) => tile(item, i, program))
      : [h('p', { class: 'pg-gal__none' }, `Nothing for ${program.name} yet.`)]));
    root.classList.add('is-gallery');
  };

  /* -------------------------------------------------------------- the row */
  const cards = programs.map((p) => {
    const card = h('button', { class: 'pg-card', type: 'button', title: p.name },
      h('span', { class: 'pg-card__mark' }, p.logo
        ? h('img', { src: media(`/uploads/${encodeURI(p.logo)}`), alt: p.name })
        : h('b', {}, p.name.slice(0, 2).toUpperCase())),
      h('span', { class: 'pg-card__name' }, p.name),
    );
    card.addEventListener('click', () => {
      if (root.classList.contains('is-fanned')) openGallery(p);
    });
    return card;
  });

  const row = h('div', { class: 'pg-row' }, ...cards);

  /**
   * Collapse every card onto the middle of the row. Measured, not guessed: the
   * row is the cards' natural layout and this is the offset back to the centre,
   * so releasing the transform lands each one exactly where it belongs.
   */
  const stack = () => {
    const rect = row.getBoundingClientRect();
    const mid = rect.left + rect.width / 2;
    cards.forEach((el, i) => {
      const b = el.getBoundingClientRect();
      const dx = Math.round(mid - (b.left + b.width / 2));
      el.style.transition = 'none';
      el.style.transform = `translate3d(${dx}px, 0, 0) scale(.9)`;
      /* All of them hidden, not just the ones behind the front. A full-height
         card standing behind a short cover pokes out above and below it, which
         reads as a mistake rather than a stack — the cover draws its own. */
      el.style.opacity = '0';
      el.style.zIndex = String(cards.length - i);
    });
  };

  const fan = () => {
    if (root.classList.contains('is-fanned')) return;
    root.classList.add('is-fanned');
    cards.forEach((el, i) => {
      el.style.transition = REDUCED?.matches ? 'none'
        : `transform .7s cubic-bezier(.22,1,.36,1) ${i * 45}ms, opacity .4s ease ${i * 45}ms`;
      el.style.transform = 'none';
      el.style.opacity = '1';
    });
  };

  const cover = h('button', { class: 'pg-cover', type: 'button', onclick: fan },
    h('span', { class: 'pg-cover__eyebrow' }, block.eyebrow || 'Programs'),
    h('h2', { class: 'pg-cover__title' }, block.title || 'Programs of Technical Hub'),
    h('span', { class: 'pg-cover__count' }, `${programs.length} programmes`),
    h('span', { class: 'pg-cover__go' }, 'Open', icon('arrow-right', { class: 'ic ic--xs' })),
  );

  root.appendChild(h('div', { class: 'pg-wall' }, cover, row));
  root.appendChild(gallery);
  root.appendChild(player);

  // Measure after the row has a layout, or every offset is zero.
  requestAnimationFrame(() => requestAnimationFrame(stack));

  root.addEventListener('keydown', (event) => {
    if (event.key !== 'Escape') return;
    if (root.classList.contains('is-playing')) { event.stopPropagation(); closePlayer(); }
    else if (root.classList.contains('is-gallery')) { event.stopPropagation(); closeGallery(); }
  });

  return root;
}
