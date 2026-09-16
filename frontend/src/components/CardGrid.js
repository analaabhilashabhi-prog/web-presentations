import { h } from '../utils/dom.js';
import { inlineRich } from '../utils/format.js';
import { openLightbox } from './Lightbox.js';

const MEDIA_SHAPE = {
  team: 'card__media--square',
  program: 'card__media--wide',
  partner: 'card__media--logo',
  placement: 'card__media--logo',
};

/** Renders a card deck for teams, partners, programs, placements and the rest. */
export function CardGrid(items = [], variant = 'plain') {
  const list = items.filter((item) => item && (item.title || item.body));
  if (!list.length) return null;

  const zoomable = list.filter((item) => item.image?.url).map((item) => item.image);

  return h(
    'div',
    { class: `card-grid card-grid--${variant}` },
    ...list.map((item) => {
      const mediaClass = MEDIA_SHAPE[variant] || 'card__media--wide';
      const media = item.image?.url
        ? h(
            'div',
            {
              class: `card__media ${mediaClass}`,
              onclick: () => {
                const index = zoomable.findIndex((image) => image.id === item.image.id);
                openLightbox(zoomable, Math.max(0, index));
              },
              style: { cursor: 'zoom-in' },
            },
            h('img', { src: item.image.url, alt: item.title || 'Card image', loading: 'lazy' }),
          )
        : null;

      return h(
        'article',
        { class: `card card--${variant}` },
        media,
        h(
          'div',
          { class: 'card__body' },
          item.title ? h('h3', { class: 'card__title' }, item.title) : null,
          item.subtitle ? h('div', { class: 'card__subtitle' }, item.subtitle) : null,
          item.meta ? h('div', { class: 'card__meta' }, item.meta) : null,
          item.body ? h('p', { class: 'card__text', html: inlineRich(item.body) }) : null,
          item.tags?.length
            ? h('div', { class: 'card__tags' }, ...item.tags.map((tag) => h('span', { class: 'chip' }, tag)))
            : null,
        ),
      );
    }),
  );
}
