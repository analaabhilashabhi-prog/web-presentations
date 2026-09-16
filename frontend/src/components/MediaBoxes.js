import { h } from '../utils/dom.js';
import { inlineRich, initials } from '../utils/format.js';
import { openLightbox } from './Lightbox.js';

/** Rich text box: optional heading, paragraphs, bullets — one editable unit. */
export function TextBox(block) {
  const paragraphs = String(block.body || '')
    .split(/\n{2,}/)
    .map((part) => part.trim())
    .filter(Boolean);

  const hasContent = block.heading || paragraphs.length || block.items?.length;

  return h(
    'div',
    { class: `text-box${block.align === 'center' ? ' text-box--center' : ''}` },
    block.heading
      ? h(
          block.level === 3 ? 'h3' : 'h2',
          { class: `block-heading${block.level === 3 ? ' block-heading--3' : ''}` },
          block.heading,
        )
      : null,
    ...paragraphs.map((part) => h('p', { class: 'prose', html: inlineRich(part) })),
    block.items?.length
      ? h('ul', { class: 'bullets' }, ...block.items.map((item) => h('li', { html: inlineRich(item) })))
      : null,
    hasContent ? null : h('p', { class: 'prose media-empty__hint' }, 'Empty text box.'),
  );
}

/**
 * Image box: fills its block, click to zoom.
 *
 * Every image carries three separate labels — a title shown above it, a caption
 * shown below it, and alt text for screen readers. Alt falls back to the title
 * and then the caption, so an image is never announced as unlabelled.
 */
export function ImageBox(block, { editing = false } = {}) {
  const asset = block.asset;
  if (!asset?.url) {
    return h(
      'div',
      { class: 'media-empty' },
      h('span', { class: 'media-empty__icon' }, '▣'),
      h('span', {}, editing ? 'No image yet — use Edit to upload one' : 'Image not uploaded'),
    );
  }

  return h(
    'figure',
    { class: `image-box image-box--radius-${block.radius || 'md'}` },
    block.title ? h('figcaption', { class: 'media-title' }, block.title) : null,
    h(
      'button',
      {
        class: 'image-box__frame',
        type: 'button',
        title: 'Click to zoom',
        onclick: (event) => {
          event.stopPropagation();
          openLightbox([{ ...asset, name: block.title || block.caption || asset.name }], 0);
        },
      },
      h('img', {
        src: asset.url,
        alt: block.alt || block.title || block.caption || asset.name || 'Image',
        loading: 'lazy',
        style: { objectFit: block.fit === 'contain' ? 'contain' : 'cover' },
      }),
    ),
    block.caption ? h('figcaption', { class: 'media-caption' }, block.caption) : null,
    asset.note && editing ? h('p', { class: 'media-note' }, asset.note) : null,
  );
}

/**
 * Profile image slot: a fixed 4:5 portrait (or square) frame. Whatever the
 * source dimensions, the photo is cropped to the frame around the chosen focal
 * band, so a portrait always sits well composed.
 */
export function ProfileBox(block, { editing = false } = {}) {
  const asset = block.asset;
  const objectPosition = { top: '50% 18%', center: '50% 50%', bottom: '50% 82%' }[block.focus || 'center'];

  const frame = h(
    'div',
    { class: `profile-box__frame profile-box__frame--${block.frame === 'square' ? 'square' : 'portrait'}` },
    asset?.url
      ? h('img', {
          src: asset.url,
          alt: block.name || 'Profile photo',
          loading: 'lazy',
          style: { objectPosition },
        })
      : h(
          'div',
          { class: 'profile-box__placeholder' },
          h('span', {}, block.name ? initials(block.name) : '◉'),
          h('small', {}, editing ? 'Upload a profile photo' : 'Photo coming soon'),
        ),
  );

  return h(
    'figure',
    { class: 'profile-box' },
    asset?.url
      ? h(
          'button',
          {
            class: 'profile-box__zoom',
            type: 'button',
            title: 'Click to zoom',
            onclick: (event) => {
              event.stopPropagation();
              openLightbox([asset], 0);
            },
          },
          frame,
        )
      : frame,
    block.name || block.role || block.blurb
      ? h(
          'figcaption',
          { class: 'profile-box__caption' },
          block.name ? h('div', { class: 'profile-box__name' }, block.name) : null,
          block.role ? h('div', { class: 'profile-box__role' }, block.role) : null,
          block.blurb ? h('p', { class: 'profile-box__blurb' }, block.blurb) : null,
        )
      : null,
  );
}
