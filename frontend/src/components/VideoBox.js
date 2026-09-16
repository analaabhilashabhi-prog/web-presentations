import { h } from '../utils/dom.js';
import { videoControls } from '../utils/videoControls.js';

/**
 * Video block. Three ways in, one behaviour out:
 *
 *   - an uploaded file            -> <video src="/uploads/…">
 *   - a pasted direct video link  -> <video src="https://…/clip.mp4">
 *   - a YouTube / Vimeo / Drive link -> provider <iframe>
 *
 * All three live inside the same wrapper, and it is the wrapper that goes
 * fullscreen. Nothing re-renders on the way in or out, so playback position,
 * the open slide and the scroll offset all survive — the Back button returns
 * the presenter exactly where they were.
 */
export function VideoBox(block, { editing = false } = {}) {
  const asset = block.asset;
  const link = block.link;

  const uploadedUrl = block.source === 'url' ? null : asset?.url || null;
  const directUrl = block.source === 'url' && link?.kind === 'file' ? link.playbackUrl : null;
  const embedUrl = block.source === 'url' && link?.embedUrl ? link.embedUrl : null;
  const playableUrl = uploadedUrl || directUrl;

  if (!playableUrl && !embedUrl) {
    const message = block.linkError
      ? block.linkError
      : editing
        ? 'No video yet — use Edit to upload a file or paste a link'
        : 'Video not added';
    return h(
      'figure',
      { class: 'video-box' },
      h(
        'div',
        { class: 'media-empty' },
        h('span', { class: 'media-empty__icon' }, '▷'),
        h('span', {}, message),
      ),
      block.caption ? h('figcaption', { class: 'media-caption' }, block.caption) : null,
    );
  }

  /* ------------------------------------------------------------- the player */
  let player;
  if (playableUrl) {
    player = h('video', {
      class: 'video-box__player',
      src: playableUrl,
      controls: true,
      playsinline: true,
      preload: 'metadata',
      poster: asset?.posterUrl || undefined,
      loop: block.loop || undefined,
      autoplay: block.autoplay && block.muted ? true : undefined,
      crossorigin: directUrl ? 'anonymous' : undefined,
    });
    if (block.muted) player.muted = true;
  } else {
    player = h('iframe', {
      class: 'video-box__player video-box__player--embed',
      src: embedUrl,
      title: block.caption || `${link.label} video`,
      loading: 'lazy',
      frameborder: '0',
      referrerpolicy: 'strict-origin-when-cross-origin',
      allow: 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen',
      allowfullscreen: true,
    });
  }

  const backButton = h(
    'button',
    {
      class: 'video-box__back',
      type: 'button',
      title: 'Back to the presentation (Esc)',
      onclick: (event) => {
        event.stopPropagation();
        exitFullscreen();
      },
    },
    '‹ Back to presentation',
  );

  const fullscreenButton = h(
    'button',
    {
      class: 'video-box__fs',
      type: 'button',
      title: 'Play fullscreen',
      onclick: (event) => {
        event.stopPropagation();
        enterFullscreen();
      },
    },
    '⛶ Fullscreen',
  );

  const frame = h('div', { class: 'video-box__frame has-vc' },
    player, videoControls(player), backButton, fullscreenButton);

  async function enterFullscreen() {
    // Remember the reading position independently of the browser.
    frame.dataset.returnScroll = String(window.scrollY);
    try {
      await frame.requestFullscreen?.();
    } catch {
      /* Fullscreen can be refused; playback continues inline. */
    }
    // Only a real <video> can be started programmatically; embeds have their
    // own play control inside the provider's player.
    if (playableUrl) player.play?.().catch(() => {});
  }

  async function exitFullscreen() {
    if (document.fullscreenElement === frame) {
      await document.exitFullscreen?.().catch(() => {});
    }
  }

  document.addEventListener('fullscreenchange', () => {
    if (document.fullscreenElement === frame) {
      frame.classList.add('is-fullscreen');
      return;
    }
    if (!frame.classList.contains('is-fullscreen')) return;
    frame.classList.remove('is-fullscreen');
    const target = Number(frame.dataset.returnScroll || 0);
    requestAnimationFrame(() => window.scrollTo({ top: target, behavior: 'auto' }));
  });

  const sourceBadge = editing
    ? h(
        'span',
        { class: 'badge badge--accent video-box__source' },
        embedUrl ? link.label : directUrl ? 'Linked file' : 'Uploaded file',
      )
    : null;

  return h(
    'figure',
    { class: 'video-box' },
    frame,
    block.caption || sourceBadge
      ? h(
          'figcaption',
          { class: 'media-caption' },
          block.caption || '',
          sourceBadge,
        )
      : null,
    asset?.note && editing ? h('p', { class: 'media-note' }, asset.note) : null,
  );
}
