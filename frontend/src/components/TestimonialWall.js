import { h } from '../utils/dom.js';
import { icon } from '../utils/icons.js';
import { media } from '../utils/media.js';
import { videoControls } from '../utils/videoControls.js';

/**
 * Testimonials: a row of arched portraits, and clicking a student plays their
 * film across the whole screen.
 *
 * The portraits are local files, pulled once from each film and saved under
 * /uploads/Testimonials, so the wall is intact with no network. The films
 * themselves are YouTube and are not.
 *
 * The embed is only ever created already playing. YouTube's title, channel and
 * "Watch on YouTube" belong to the player's *unstarted* state — no parameter
 * removes them, but a player that starts in motion never draws that state at
 * all. controls=0 keeps the bar from returning on hover.
 */

const UPLOADS = '/uploads';
const REDUCED = window.matchMedia?.('(prefers-reduced-motion: reduce)');

/* enablejsapi is what lets the hover controls reach the frame at all: without
   it postMessage is ignored and the buttons do nothing. */
const YT = 'autoplay=1&controls=0&modestbranding=1&rel=0&iv_load_policy=3&enablejsapi=1'
  + '&playsinline=1&disablekb=1&fs=0&color=white';
const ytEmbed = (id) => `https://www.youtube-nocookie.com/embed/${encodeURIComponent(id)}?${YT}`;

/* The reference sets each arch on its own colour. These are flat washes rather
   than gradients, and light enough that a face stays the brightest thing in
   the frame. */
const WASHES = ['#BFE3F2', '#FBE3B8', '#F6C9B8', '#D9E7C6', '#E3D6F2', '#F9D5DE'];

export function TestimonialWall(block, { editing = false } = {}) {
  const people = (block.people || []).filter((p) => p.name && (p.youtube || p.src));
  if (!people.length) {
    return h('div', { class: 'tw-root tw-root--empty ph-root' }, 'No testimonials yet.');
  }
  const root = h('div', { class: 'tw-root ph-root' });

  /* ------------------------------------------------------------ the player */
  const frame = h('div', { class: 'tw-player__frame' });
  const playerName = h('span', { class: 'tw-player__name' });

  const closePlayer = () => {
    // Unmount, don't hide: a hidden iframe keeps playing behind the wall.
    frame.replaceChildren();
    player.classList.remove('is-portal');
    if (player.parentNode !== root) root.appendChild(player);
    root.classList.remove('is-playing');
    cards.forEach((c) => c.classList.remove('is-active'));
  };

  const player = h('div', { class: 'tw-player' },
    h('div', { class: 'tw-bar' },
      h('button', { class: 'tw-back', type: 'button', onclick: closePlayer },
        icon('chevron-left', { class: 'ic ic--xs' }), h('span', {}, 'All testimonials')),
      playerName,
    ),
    frame,
  );

  const play = (person, card) => {
    playerName.textContent = person.name;
    /* Built first, so the control bar can be handed the element it drives: it
       has to know whether it is talking to a <video> it can call directly or to
       a cross-origin frame it can only post messages at. */
    const surface = person.youtube
      ? h('iframe', {
          class: 'tw-player__yt', src: ytEmbed(person.youtube),
          title: person.name,
          allow: 'autoplay; encrypted-media; fullscreen; picture-in-picture',
          referrerpolicy: 'strict-origin-when-cross-origin', allowfullscreen: true,
        })
      : h('video', {
          class: 'tw-player__file', src: media(`/uploads/${encodeURI(person.src)}`),
          controls: true, autoplay: true, playsinline: true,
        });
    frame.replaceChildren(surface, videoControls(surface));
    cards.forEach((c) => c.classList.toggle('is-active', c === card));
    /* Out of the slide entirely while it plays. FitSlide scales the slide with
       a transform, which becomes the containing block for anything fixed inside
       it — so a player that lives in the section can only ever fill the slide,
       and when the window is not 16:9 the slide itself is letterboxed. Moved to
       the body it answers to the viewport and covers the display. The deck bar
       is fixed in the body too, at a higher z-index, so Prev / Next / Exit stay
       on top and clickable. */
    if (player.parentNode !== document.body) document.body.appendChild(player);
    player.classList.add('is-portal');
    root.classList.add('is-playing');
  };

  /* -------------------------------------------------------------- the wall */
  const cards = people.map((p, i) => {
    const arch = h('span', { class: 'tw-arch', style: { background: WASHES[i % WASHES.length] } });
    /* Initials on the wash until a photograph arrives. The films' own
       thumbnails were tried and rejected: every one is a designed title card
       with the student's name burned across it, which is exactly the raw poster
       this deck is not allowed to place — the page's own type carries the name. */
    const initials = h('span', { class: 'tw-arch__initials' },
      p.name.split(/\s+/).map((w) => w[0]).join('').slice(0, 2).toUpperCase());
    arch.appendChild(initials);
    if (p.photo) {
      const img = h('img', { src: media(`/uploads/${encodeURI(p.photo)}`), alt: p.name, loading: 'eager' });
      img.addEventListener('error', () => img.remove());
      /* The frame is shown whole, so the card is taller than the picture and
         the wash shows above and below it. The initials are the stand-in for a
         missing photograph — once one arrives they have to go, or they sit in
         that band looking like a caption nobody wrote. */
      img.addEventListener('load', () => initials.remove());
      arch.appendChild(img);
    }
    const card = h('button', {
      class: 'tw-card',
      type: 'button',
      title: `Play ${p.name}`,
      style: REDUCED?.matches ? {} : { 'animation-delay': `${90 + i * 110}ms` },
    },
      arch,
      h('span', { class: 'tw-card__name' }, p.name),
      p.note ? h('span', { class: 'tw-card__note' }, p.note) : null,
      h('span', { class: 'tw-card__play' }, icon('play-circle', { class: 'ic' })),
    );
    card.addEventListener('click', () => play(p, card));
    return card;
  });

  root.appendChild(h('div', { class: 'tw-wall' },
    h('div', { class: 'tw-head' },
      block.eyebrow ? h('p', { class: 'tw-eyebrow' }, block.eyebrow) : null,
      h('h2', { class: 'tw-title' }, block.title || 'Testimonials'),
    ),
    h('div', { class: 'tw-row' }, ...cards),
  ));
  root.appendChild(player);

  root.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && root.classList.contains('is-playing')) {
      event.stopPropagation();
      closePlayer();
    }
  });

  return root;
}
