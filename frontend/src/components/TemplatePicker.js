import { h, render } from '../utils/dom.js';
import { openModal } from './Modal.js';
import { BlockCanvas } from './BlockRenderer.js';
import { layoutsFor, buildLayout } from '../utils/sectionTemplates.js';
import { reid } from '../utils/blocks.js';
import { listTemplates } from '../services/templateService.js';

/**
 * The sample-layout chooser.
 *
 * Opened when a section is created and from the editor at any time. Every
 * option renders as a real, scaled-down slide rather than a drawing, so what
 * the admin picks is what they get. Choosing one is not a commitment — the
 * layout drops onto the canvas where every element can be edited, moved,
 * resized or deleted, and "Blank section" clears it away again.
 */
export function openTemplatePicker({
  sectionName = '',
  title = 'Choose a starting layout',
  onPick,
  onBlank,
  allowBlank = true,
} = {}) {
  const { archetype, layouts } = layoutsFor(sectionName);
  const host = h('div', { class: 'template-picker' });
  let saved = [];

  const modal = openModal({
    title,
    wide: true,
    render: () => host,
    actions: (close) => [
      h('button', { class: 'btn btn--ghost', onclick: close }, 'Cancel'),
    ],
  });

  /** One option card: a live preview plus its name and a Use button. */
  const card = (option) => {
    const preview = h('div', { class: 'template-card__preview' });
    const blocks = option.blocks();
    const canvas = BlockCanvas(structuredClone(blocks), { editing: false, preview: true });
    render(preview, canvas || h('div', { class: 'template-card__blank' }, 'Empty canvas'));

    return h(
      'button',
      {
        class: `template-card${option.suggested ? ' is-suggested' : ''}`,
        type: 'button',
        onclick: () => {
          modal.close();
          option.apply(blocks);
        },
      },
      h('div', { class: 'template-card__frame' }, preview),
      h(
        'div',
        { class: 'template-card__meta' },
        h(
          'div',
          { class: 'template-card__head' },
          h('span', { class: 'template-card__name' }, option.name),
          option.badge ? h('span', { class: 'badge badge--accent' }, option.badge) : null,
        ),
        h('span', { class: 'template-card__desc' }, option.description),
      ),
    );
  };

  function paint() {
    const options = [
      ...layouts.map((layout) => ({
        name: layout.name,
        description: layout.description,
        suggested: layout.suggested,
        badge: layout.suggested ? 'Suggested' : null,
        blocks: () => buildLayout(layout),
        apply: (blocks) => onPick?.(blocks, layout),
      })),
      ...saved.map((template) => ({
        name: template.name,
        description: template.description || `Saved template · ${template.blocks.length} elements`,
        suggested: false,
        badge: 'Saved',
        blocks: () => template.blocks.map((block) => reid(block)),
        apply: (blocks) => onPick?.(blocks, template),
      })),
    ];

    render(
      host,
      h(
        'p',
        { class: 'template-picker__lead' },
        archetype
          ? `“${sectionName}” looks like a ${archetype.label.toLowerCase()} section, so those layouts are first. `
          : 'No specific match for this section name, so here are the layouts that suit any section. ',
        'Sample text and numbers are placeholders — keep the layout, change anything in it, or clear it and start blank.',
      ),
      h('div', { class: 'template-grid' }, ...options.map(card)),
      allowBlank
        ? h(
            'div',
            { class: 'template-picker__foot' },
            h(
              'button',
              {
                class: 'btn btn--ghost',
                type: 'button',
                onclick: () => {
                  modal.close();
                  onBlank?.();
                },
              },
              'Start blank instead',
            ),
            h('span', { class: 'field__hint' }, 'You can pick a sample layout later from the editor.'),
          )
        : null,
    );
  }

  paint();

  // Saved templates arrive after the first paint so the dialog opens instantly.
  listTemplates()
    .then((templates) => {
      if (!templates.length) return;
      saved = templates;
      paint();
    })
    .catch(() => {
      /* A missing template list is not worth interrupting the admin for. */
    });

  return modal;
}
