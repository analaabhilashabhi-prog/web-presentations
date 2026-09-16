import { h } from '../utils/dom.js';
import { inlineRich, safeHref } from '../utils/format.js';
import { openLightbox } from './Lightbox.js';

/**
 * The small page-builder elements: buttons, icons and logos. Each one takes
 * only content decisions from the admin — colour, size and spacing come from
 * the brand tokens so a section cannot drift off-palette.
 */

/** A row of links styled as buttons. Renders an anchor, or a dead button while editing. */
export function ButtonRow(items = [], { align = 'left', editing = false } = {}) {
  const list = (items || []).filter((item) => item && item.label);
  if (!list.length) return null;

  return h(
    'div',
    { class: `button-row button-row--${align}` },
    ...list.map((item) => {
      const href = safeHref(item.href);
      const label = [item.icon, item.label].filter(Boolean).join('  ');
      const className = `btn btn--${item.variant || 'primary'} btn--cta`;

      // In the editor a live link would navigate away mid-edit; show the shape only.
      if (editing || !href) {
        return h(
          'span',
          { class: `${className}${href ? '' : ' is-linkless'}`, title: href || 'No link set yet' },
          label,
        );
      }
      const external = /^https?:/i.test(href);
      return h(
        'a',
        {
          class: className,
          href,
          ...(external ? { target: '_blank', rel: 'noopener noreferrer' } : {}),
        },
        label,
      );
    }),
  );
}

/** A single icon with an optional label — the building block of feature rows. */
export function IconBox(block) {
  return h(
    'div',
    { class: `icon-box icon-box--${block.size || 'md'} icon-box--${block.tone || 'accent'}` },
    h('span', { class: `icon-box__glyph icon-box__glyph--${block.shape || 'circle'}` }, block.glyph || '★'),
    block.label ? h('div', { class: 'icon-box__label' }, block.label) : null,
    block.note ? h('p', { class: 'icon-box__note', html: inlineRich(block.note) }) : null,
  );
}

/**
 * A logo slot. Always `contain` with padding, so a wide wordmark and a square
 * emblem sit equally well in the same row without either being cropped.
 */
export function LogoBox(block, { editing = false } = {}) {
  const asset = block.asset;
  const href = safeHref(block.href);

  const frame = h(
    'div',
    {
      class: [
        'logo-box__frame',
        `logo-box__frame--${block.background || 'surface'}`,
        `logo-box__frame--pad-${block.pad || 'md'}`,
      ].join(' '),
    },
    asset?.url
      ? h('img', {
          src: asset.url,
          alt: block.alt || block.title || 'Logo',
          loading: 'lazy',
        })
      : h(
          'div',
          { class: 'logo-box__placeholder' },
          h('span', {}, '◆'),
          h('small', {}, editing ? 'Upload a logo' : 'Logo'),
        ),
  );

  const clickable = asset?.url && !editing
    ? href
      ? h(
          'a',
          { class: 'logo-box__link', href, target: '_blank', rel: 'noopener noreferrer', title: block.title || 'Open link' },
          frame,
        )
      : h(
          'button',
          {
            class: 'logo-box__link',
            type: 'button',
            title: 'Click to zoom',
            onclick: (event) => {
              event.stopPropagation();
              openLightbox([asset], 0);
            },
          },
          frame,
        )
    : frame;

  return h(
    'figure',
    { class: 'logo-box' },
    clickable,
    block.title ? h('figcaption', { class: 'logo-box__title' }, block.title) : null,
  );
}
