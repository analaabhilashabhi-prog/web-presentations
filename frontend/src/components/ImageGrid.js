import { h } from '../utils/dom.js';
import { openLightbox } from './Lightbox.js';

/**
 * Smart gallery alignment.
 *
 * Items are fixed at one fifth of the row (minus gaps) inside a centred
 * flex-wrap container. A full row of five therefore fills the width exactly,
 * while the trailing incomplete row centres itself under the rows above —
 * 9 images render as 5 + 4 centred, 10 as 5 + 5. Small sets (1–4) widen so a
 * three-image gallery does not look like a row of stamps.
 *
 * `fit` is 'cover' for photographs and 'contain' for posters and certificates,
 * where cropping would cut off the very thing the image is there to show.
 * Titles the admin typed are shown under each image; filenames stay on hover,
 * because a projector audience cannot hover and a filename is not a caption.
 */
export function ImageGrid(images, { caption = '', fit = 'contain' } = {}) {
  const list = (images || []).filter((image) => image && image.url);
  if (!list.length) return null;

  const titled = list.some((image) => image.title);
  const countClass = list.length < 5 ? ` gallery--count-${list.length}` : '';
  const grid = h(
    'div',
    {
      class: `gallery${countClass}${fit === 'cover' ? ' gallery--cover' : ''}${titled ? ' gallery--titled' : ''}`,
      dataset: { count: String(list.length) },
    },
    ...list.map((image, index) =>
      h(
        'button',
        {
          class: 'gallery__item',
          type: 'button',
          title: 'Click to zoom',
          'aria-label': image.title || `Open image ${index + 1} of ${list.length}`,
          onclick: () => openLightbox(list, index),
        },
        h('img', {
          src: image.url,
          alt: image.title || image.name || `Gallery image ${index + 1}`,
          loading: 'lazy',
        }),
        image.title || image.name
          ? h('span', { class: 'gallery__meta' }, image.title || image.name)
          : null,
      ),
    ),
  );

  return h(
    'figure',
    { class: 'gallery-wrap', style: { margin: '0' } },
    grid,
    caption
      ? h('figcaption', { class: 'gallery__caption' }, `${caption} · ${list.length} images`)
      : null,
  );
}
