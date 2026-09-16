/**
 * A section's navigation icon: chosen for the editor's draft, or saved straight
 * onto an existing section. The deck itself is a fixed set of sections, so there
 * is no creation flow here.
 */
import { h } from '../utils/dom.js';
import { openModal } from './Modal.js';
import { IconChooser } from './IconChooser.js';
import { iconForTitle } from '../utils/icons.js';
import { updateSection } from '../services/contentService.js';
import { upsertSection } from '../context/appStore.js';
import { toastError, toastSuccess } from './Toast.js';

/**
 * Choose an icon without saving it: the editor holds the choice in its draft
 * alongside the title and blocks, so one Save writes the whole section.
 */
export function pickIconModal({ title = 'Section icon', previewTitle, iconKey, iconAsset, onPick }) {
  const chooser = IconChooser({ iconKey, iconAsset, previewTitle });
  if (previewTitle) chooser.suggest(iconForTitle(previewTitle));

  return openModal({
    title,
    text: 'Pick a library icon or upload your own PNG/SVG mark.',
    wide: true,
    render: () => chooser.node,
    actions: (close) => [
      h('button', { class: 'btn btn--ghost', type: 'button', onclick: close }, 'Cancel'),
      h(
        'button',
        {
          class: 'btn btn--primary',
          type: 'button',
          onclick: () => {
            const value = chooser.value();
            close();
            onPick?.({ ...value, asset: chooser.asset() });
          },
        },
        'Use this icon',
      ),
    ],
  });
}

export function sectionIconModal(section, { onSaved } = {}) {
  const chooser = IconChooser({
    iconKey: section.iconKey,
    iconAsset: section.iconAsset,
    previewTitle: section.title,
  });
  chooser.suggest(iconForTitle(section.title));

  return openModal({
    title: `Icon for "${section.title}"`,
    text: 'Pick a library icon or upload your own PNG/SVG mark.',
    wide: true,
    render: () => chooser.node,
    actions: (close) => [
      h('button', { class: 'btn btn--ghost', type: 'button', onclick: close }, 'Cancel'),
      h(
        'button',
        {
          class: 'btn btn--primary',
          type: 'button',
          onclick: async (event) => {
            event.currentTarget.disabled = true;
            try {
              upsertSection(await updateSection(section.id, chooser.value()));
              close();
              toastSuccess('Section icon updated');
              onSaved?.();
            } catch (err) {
              event.currentTarget.disabled = false;
              toastError(err.message);
            }
          },
        },
        'Save icon',
      ),
    ],
  });
}
