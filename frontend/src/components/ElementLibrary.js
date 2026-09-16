import { h } from '../utils/dom.js';
import { ROW_PRESETS, PRESET_PREFIX } from '../utils/blocks.js';

/**
 * The element library. Every entry can be dragged onto the canvas (or into a
 * layout box) to place it exactly, or clicked to let the editor find a
 * balanced slot for it.
 *
 * `suggested` re-orders nothing — it highlights the handful of elements that
 * suit the section being edited, so the relevant ones are the obvious ones.
 */
export const ELEMENT_GROUPS = [
  {
    id: 'text',
    label: 'Text',
    items: [
      ['text', 'Text box', '¶'],
      ['heading', 'Heading', 'H'],
      ['paragraph', 'Paragraph', '≡'],
      ['bullets', 'Bullet list', '•'],
      ['quote', 'Quote', '❝'],
    ],
  },
  {
    id: 'media',
    label: 'Media',
    items: [
      ['image', 'Image', '▣'],
      ['logo', 'Logo', '◈'],
      ['video', 'Video', '▷'],
      ['gallery', 'Gallery', '⊞'],
      ['profile', 'Profile image', '◉'],
    ],
  },
  {
    id: 'data',
    label: 'Data',
    items: [
      ['kpi', 'KPI cards', '▦'],
      ['stats', 'Stat counters', '#'],
      ['cards', 'Card grid', '▤'],
    ],
  },
  {
    id: 'action',
    label: 'Actions',
    items: [
      ['buttons', 'Buttons / links', '⬚'],
      ['icon', 'Icon', '★'],
    ],
  },
  {
    id: 'structure',
    label: 'Structure',
    items: [
      ['hero', 'Hero', '▬'],
      ['box', 'Layout box', '⬓'],
      ['divider', 'Divider', '—'],
    ],
  },
];

export const ELEMENT_ICONS = Object.fromEntries(
  ELEMENT_GROUPS.flatMap((group) => group.items.map(([type, , icon]) => [type, icon])),
);

/** The MIME-ish key the canvas listens for on drop. */
export const DRAG_TYPE = 'application/x-block-type';

export function ElementLibrary({ onAdd, suggested = [] }) {
  const suggestedSet = new Set(suggested);

  const chip = ([type, label, icon], hint = '') =>
    h(
      'button',
      {
        class: `element-chip${suggestedSet.has(type) ? ' is-suggested' : ''}`,
        type: 'button',
        draggable: true,
        title: `${hint || label} — drag onto the canvas or click to place it`,
        onclick: () => onAdd(type),
        ondragstart: (event) => {
          event.dataTransfer.effectAllowed = 'copy';
          event.dataTransfer.setData(DRAG_TYPE, type);
          // Firefox refuses to start a drag without text/plain on the payload.
          event.dataTransfer.setData('text/plain', `block:${type}`);
          document.body.classList.add('is-placing-block');
        },
        ondragend: () => document.body.classList.remove('is-placing-block'),
      },
      h('span', { class: 'element-chip__icon' }, icon),
      h('span', { class: 'element-chip__label' }, label),
    );

  return h(
    'div',
    { class: 'element-library' },
    h(
      'div',
      { class: 'element-library__group' },
      h('div', { class: 'element-library__label' }, 'Ready-made rows'),
      h(
        'div',
        { class: 'element-library__chips' },
        ...ROW_PRESETS.map((preset) =>
          chip([`${PRESET_PREFIX}${preset.id}`, preset.label, preset.icon], preset.description),
        ),
      ),
    ),
    ...ELEMENT_GROUPS.map((group) =>
      h(
        'div',
        { class: 'element-library__group' },
        h('div', { class: 'element-library__label' }, group.label),
        h('div', { class: 'element-library__chips' }, ...group.items.map((item) => chip(item))),
      ),
    ),
  );
}
