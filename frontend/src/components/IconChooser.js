/**
 * Section icon chooser: pick from the shared line-icon library, or upload a
 * PNG/SVG mark of your own. Returns a small controller so the hosting modal can
 * read the choice on submit.
 */
import { h, render } from '../utils/dom.js';
import { icon, iconLabel, ICON_GROUPS, ICON_NAMES, hasIcon } from '../utils/icons.js';
import { chooseFiles, upload } from './ImageUploader.js';
import { toastError } from './Toast.js';

/** The nav row is the only preview that matters — show the real thing. */
export function SectionIconGlyph(section, { class: className = 'sec-icon' } = {}) {
  if (section?.iconAsset?.url) {
    return h('img', {
      class: `${className} ${className}--asset`,
      src: section.iconAsset.url,
      alt: '',
      'aria-hidden': 'true',
    });
  }
  return icon(section?.iconKey || 'document', { class: className });
}

export function IconChooser({ iconKey = '', iconAsset = null, previewTitle = 'New section' } = {}) {
  let selectedKey = hasIcon(iconKey) ? iconKey : '';
  let selectedAsset = iconAsset;
  let suggestion = 'document';
  let manual = Boolean(selectedKey || selectedAsset);

  const previewGlyph = h('span', { class: 'icon-chooser__preview-glyph' });
  const previewLabel = h('span', { class: 'icon-chooser__preview-title' }, previewTitle);
  const previewNote = h('span', { class: 'icon-chooser__preview-note' });
  const grid = h('div', { class: 'icon-chooser__grid' });
  const search = h('input', {
    class: 'input input--sm',
    type: 'search',
    placeholder: 'Search icons — award, code, contact…',
    'aria-label': 'Search icons',
  });

  const activeName = () => selectedKey || suggestion;

  const paintPreview = () => {
    render(previewGlyph, SectionIconGlyph({ iconKey: activeName(), iconAsset: selectedAsset }, { class: 'sec-icon' }));
    previewNote.textContent = selectedAsset
      ? `Uploaded · ${selectedAsset.name || 'custom mark'}`
      : manual
        ? `Library · ${iconLabel(activeName())}`
        : `Suggested · ${iconLabel(suggestion)}`;
  };

  const paintGrid = () => {
    const term = search.value.trim().toLowerCase();
    const groups = ICON_GROUPS.map((group) => ({
      label: group.label,
      names: group.names.filter((name) => !term || name.includes(term) || iconLabel(name).toLowerCase().includes(term)),
    })).filter((group) => group.names.length);

    // A search can match icons that live outside the curated groups.
    if (term) {
      const listed = new Set(groups.flatMap((group) => group.names));
      const extra = ICON_NAMES.filter((name) => !listed.has(name) && name.includes(term));
      if (extra.length) groups.push({ label: 'More', names: extra });
    }

    render(
      grid,
      ...(groups.length
        ? groups.map((group) =>
            h(
              'div',
              { class: 'icon-chooser__group' },
              h('div', { class: 'icon-chooser__group-label' }, group.label),
              h(
                'div',
                { class: 'icon-chooser__tiles' },
                ...group.names.map((name) =>
                  h(
                    'button',
                    {
                      class: `icon-tile${!selectedAsset && activeName() === name ? ' is-active' : ''}`,
                      type: 'button',
                      title: iconLabel(name),
                      'aria-label': iconLabel(name),
                      'aria-pressed': String(!selectedAsset && activeName() === name),
                      onclick: () => {
                        selectedKey = name;
                        selectedAsset = null;
                        manual = true;
                        paintPreview();
                        paintGrid();
                      },
                    },
                    icon(name, { class: 'icon-tile__glyph' }),
                  ),
                ),
              ),
            ),
          )
        : [h('p', { class: 'icon-chooser__empty' }, `No icon matches “${term}”. Upload a PNG or SVG instead.`)]),
    );
  };

  const uploadButton = h(
    'button',
    {
      class: 'btn btn--ghost btn--sm',
      type: 'button',
      onclick: async () => {
        const files = await chooseFiles({ multiple: false, accept: 'icon' });
        const file = files?.[0];
        if (!file) return;
        if (!/\.(png|svg)$/i.test(file.name) && !['image/png', 'image/svg+xml'].includes(file.type)) {
          toastError('Section icons must be a PNG or an SVG file');
          return;
        }
        uploadButton.disabled = true;
        uploadButton.textContent = 'Uploading…';
        const [asset] = await upload([file]);
        uploadButton.disabled = false;
        render(uploadButton, icon('upload', { class: 'btn__icon' }), 'Upload PNG or SVG');
        if (!asset) return;
        selectedAsset = asset;
        manual = true;
        paintPreview();
        paintGrid();
      },
    },
    icon('upload', { class: 'btn__icon' }),
    'Upload PNG or SVG',
  );

  const clearUpload = h(
    'button',
    {
      class: 'btn btn--ghost btn--sm',
      type: 'button',
      onclick: () => {
        selectedAsset = null;
        paintPreview();
        paintGrid();
      },
    },
    'Use a library icon',
  );

  search.addEventListener('input', paintGrid);

  const node = h(
    'div',
    { class: 'icon-chooser' },
    h(
      'div',
      { class: 'icon-chooser__head' },
      h(
        'div',
        { class: 'icon-chooser__preview' },
        h('span', { class: 'icon-chooser__preview-chip' }, previewGlyph),
        h('span', { class: 'icon-chooser__preview-text' }, previewLabel, previewNote),
      ),
      h('div', { class: 'icon-chooser__tools' }, uploadButton, clearUpload),
    ),
    h(
      'p',
      { class: 'icon-chooser__hint' },
      'The icon sits beside the section in the navigation pane. Uploaded marks are drawn at 18px on the dark panel — a flat, single-colour PNG or SVG reads best.',
    ),
    search,
    grid,
  );

  paintPreview();
  paintGrid();

  return {
    node,
    /** Keeps the suggestion in step with the name until the admin picks one. */
    suggest(name) {
      suggestion = name;
      if (!manual) paintPreview();
      if (!manual) paintGrid();
    },
    setPreviewTitle(title) {
      previewLabel.textContent = title || 'New section';
    },
    value() {
      return {
        iconKey: selectedAsset ? '' : activeName(),
        iconAssetId: selectedAsset?.id || null,
      };
    },
    /** The resolved asset, so a caller can preview the choice before saving. */
    asset() {
      return selectedAsset;
    },
  };
}
