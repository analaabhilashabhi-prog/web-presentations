import { h, render, enableDragSort, moveItem } from '../utils/dom.js';
import { SideNav } from '../components/SideNav.js';
import { TopBar } from '../components/TopBar.js';
import { chooseFiles, upload } from '../components/ImageUploader.js';
import { confirmModal, promptModal } from '../components/Modal.js';
import { toastError, toastSuccess } from '../components/Toast.js';
import { navigate, refresh } from '../utils/router.js';
import { state, upsertOrg, upsertSection, removeSection, setSections } from '../context/appStore.js';
import {
  updateOrg,
  updateSection,
  deleteSection,
  reorderSections,
} from '../services/contentService.js';
import { listTemplates, deleteTemplate } from '../services/templateService.js';
import { icon, iconForTitle } from '../utils/icons.js';
import { SectionIconGlyph } from '../components/IconChooser.js';
import { sectionIconModal } from '../components/SectionModal.js';

/** Organization identity plus the tab manager (add, rename, reorder, hide, delete). */
export function SettingsPage(container, { org, onLogout }) {
  const draft = { name: org.name, shortName: org.shortName || '', tagline: org.tagline || '' };

  const saveOrg = async (patch) => {
    try {
      upsertOrg(await updateOrg(org.id, patch));
      toastSuccess('Organization settings saved');
      refresh();
    } catch (err) {
      toastError(err.message);
    }
  };

  const identityPanel = h(
    'div',
    { class: 'panel' },
    h(
      'div',
      { class: 'panel__head' },
      h('h2', { class: 'panel__title' }, 'Organization identity'),
      h('div', { class: 'topbar__spacer' }),
      h('span', { class: 'badge badge--accent' }, `Theme: ${org.theme.label}`),
    ),
    h(
      'p',
      { class: 'panel__hint' },
      'Name, short name, tagline and logo are editable. Brand colours and type are set below and apply to every section.',
    ),
    h(
      'div',
      { class: 'grid-2' },
      h(
        'label',
        { class: 'field' },
        h('span', { class: 'field__label' }, 'Organization name'),
        h('input', { class: 'input', value: draft.name, oninput: (e) => (draft.name = e.target.value) }),
      ),
      h(
        'label',
        { class: 'field' },
        h('span', { class: 'field__label' }, 'Short name'),
        h('input', {
          class: 'input',
          value: draft.shortName,
          oninput: (e) => (draft.shortName = e.target.value),
        }),
      ),
      h(
        'label',
        { class: 'field' },
        h('span', { class: 'field__label' }, 'Tagline'),
        h('input', {
          class: 'input',
          value: draft.tagline,
          oninput: (e) => (draft.tagline = e.target.value),
        }),
      ),
    ),
    h(
      'div',
      { class: 'row-actions', style: { marginTop: '6px' } },
      // Two marks: the wordmark for the open pane, and the square the collapsed
      // rail shows — a wordmark is unreadable at 44px.
      org.logo?.url
        ? h('img', {
            src: org.logo.url,
            alt: `${org.name} logo`,
            style: {
              height: '52px',
              border: '1px solid var(--border)',
              borderRadius: '10px',
              background: '#ffffff',
              padding: '5px 9px',
            },
          })
        : h('span', { class: 'badge' }, 'No logo uploaded'),
      h(
        'button',
        {
          class: 'btn btn--ghost btn--sm',
          onclick: async () => {
            const assets = await upload(await chooseFiles({ multiple: false }));
            if (assets[0]) await saveOrg({ logoAssetId: assets[0].id });
          },
        },
        org.logo?.url ? 'Replace logo' : 'Upload logo',
      ),
      org.mark?.url
        ? h('img', {
            src: org.mark.url,
            alt: `${org.name} rail mark`,
            style: {
              width: '52px',
              height: '52px',
              objectFit: 'contain',
              border: '1px solid var(--border)',
              borderRadius: '13px',
              background: '#ffffff',
            },
          })
        : h('span', { class: 'badge' }, 'No rail mark'),
      h(
        'button',
        {
          class: 'btn btn--ghost btn--sm',
          onclick: async () => {
            const assets = await upload(await chooseFiles({ multiple: false, accept: 'icon' }));
            if (assets[0]) await saveOrg({ markAssetId: assets[0].id });
          },
        },
        org.mark?.url ? 'Replace rail mark' : 'Upload rail mark',
      ),
      h('div', { class: 'topbar__spacer' }),
      h('button', { class: 'btn btn--primary btn--sm', onclick: () => saveOrg(draft) }, 'Save details'),
    ),
  );

  /* ------------------------------------------------------- brand controls */
  const THEME_FIELDS = [
    ['primary', 'Primary', 'Headings, dark fills and the nav by default'],
    ['accent', 'Accent / CTA', 'Buttons, rules and highlights'],
    ['secondary', 'Secondary', 'Supporting brand colour'],
    ['highlight', 'Highlight', 'Hover and emphasis states'],
    ['navBg', 'Side navigation', 'Text on it is picked for contrast automatically'],
  ];

  const themeDraft = Object.fromEntries(THEME_FIELDS.map(([key]) => [key, org.theme[key]]));
  let fontDraft = org.font?.id || 'sans';
  /** Colour picker and hex box per key, kept in step with each other. */
  const hexInputs = {};

  const swatch = ([key, label, hint]) =>
    h(
      'label',
      { class: 'field swatch-field' },
      h('span', { class: 'field__label' }, label),
      h(
        'span',
        { class: 'swatch-field__row' },
        h('input', {
          class: 'swatch-field__picker',
          type: 'color',
          value: themeDraft[key],
          oninput: (e) => {
            themeDraft[key] = e.target.value.toUpperCase();
            hexInputs[key].value = themeDraft[key];
          },
        }),
        (hexInputs[key] = h('input', {
          class: 'input swatch-field__hex',
          value: themeDraft[key],
          maxlength: '7',
          oninput: (e) => {
            const value = e.target.value.trim();
            if (/^#[0-9a-fA-F]{6}$/.test(value)) themeDraft[key] = value.toUpperCase();
          },
        })),
      ),
      h('span', { class: 'field__hint' }, hint),
    );

  const brandPanel = h(
    'div',
    { class: 'panel' },
    h(
      'div',
      { class: 'panel__head' },
      h('h2', { class: 'panel__title' }, 'Brand colours & type'),
      h('div', { class: 'topbar__spacer' }),
      org.theme.customized ? h('span', { class: 'badge badge--hidden' }, 'Customised') : null,
    ),
    h(
      'p',
      { class: 'panel__hint' },
      'These apply across every section at once — heroes, KPI cards, buttons and the navigation all read from them. '
      + 'Text colour on a brand fill is always chosen for contrast, so a pale accent stays readable.',
    ),
    h('div', { class: 'grid-2' }, ...THEME_FIELDS.map(swatch)),
    h(
      'label',
      { class: 'field' },
      h('span', { class: 'field__label' }, 'Typeface'),
      h(
        'select',
        { class: 'select', onchange: (e) => { fontDraft = e.target.value; } },
        ...(org.fontChoices || [{ id: 'sans', label: 'Clean sans serif' }]).map((choice) =>
          h('option', { value: choice.id, selected: fontDraft === choice.id }, choice.label),
        ),
      ),
      h('span', { class: 'field__hint' }, 'Only fonts bundled with the app or installed on this machine — nothing is downloaded.'),
    ),
    h(
      'div',
      { class: 'row-actions', style: { marginTop: '6px' } },
      h(
        'button',
        {
          class: 'btn btn--ghost btn--sm',
          onclick: () =>
            confirmModal({
              title: 'Reset to the brand palette?',
              text: 'Custom colours are discarded and the approved palette for this organization is restored.',
              confirmLabel: 'Reset colours',
              onConfirm: () => saveOrg({ theme: null, fontId: null }),
            }),
        },
        'Reset to brand defaults',
      ),
      h('div', { class: 'topbar__spacer' }),
      h(
        'button',
        { class: 'btn btn--primary btn--sm', onclick: () => saveOrg({ theme: themeDraft, fontId: fontDraft }) },
        'Apply to all sections',
      ),
    ),
  );

  /* ------------------------------------------------------ saved templates */
  const templateHost = h('div', { class: 'tab-manager' });

  const paintTemplates = async () => {
    let templates = [];
    try {
      templates = await listTemplates();
    } catch (err) {
      render(templateHost, h('div', { class: 'empty-note' }, err.message));
      return;
    }

    if (!templates.length) {
      render(
        templateHost,
        h('div', { class: 'empty-note' },
          'No saved templates yet. Open any section, arrange it, then use “Save as template”.'),
      );
      return;
    }

    render(
      templateHost,
      ...templates.map((template) =>
        h(
          'div',
          { class: 'tab-row' },
          h('span', { class: 'row-icon' }, icon(iconForTitle(template.name, 'folder'))),
          h('span', { class: 'tab-row__title' }, template.name),
          h('span', { class: 'badge' }, `${template.blocks.length} elements`),
          template.description ? h('span', { class: 'field__hint' }, template.description) : null,
          h('div', { class: 'topbar__spacer' }),
          h(
            'button',
            {
              class: 'btn btn--danger btn--sm',
              onclick: () =>
                confirmModal({
                  title: 'Delete this template?',
                  text: `"${template.name}" is removed from the layout picker. Sections already built from it are untouched.`,
                  confirmLabel: 'Delete template',
                  danger: true,
                  onConfirm: async () => {
                    try {
                      await deleteTemplate(template.id);
                      toastSuccess('Template deleted');
                      paintTemplates();
                    } catch (err) {
                      toastError(err.message);
                    }
                  },
                }),
            },
            'Delete',
          ),
        ),
      ),
    );
  };

  const templatesPanel = h(
    'div',
    { class: 'panel' },
    h(
      'div',
      { class: 'panel__head' },
      h('h2', { class: 'panel__title' }, 'Saved section templates'),
    ),
    h(
      'p',
      { class: 'panel__hint' },
      'Layouts saved from the page builder. They appear alongside the suggested sample layouts whenever a section is created or restyled, in both organizations.',
    ),
    templateHost,
  );

  /* --------------------------------------------------------- tab manager */
  const tabHost = h('div', { class: 'tab-manager' });

  const paintTabs = () => {
    const rows = state.sections.map((section) =>
      h(
        'div',
        { class: 'tab-row' },
        h('span', { class: 'block-card__handle', title: 'Drag to reorder' }, '⠿'),
        h(
          'button',
          {
            class: 'row-icon row-icon--action',
            type: 'button',
            title: 'Change this section’s navigation icon',
            'aria-label': `Change the icon for ${section.title}`,
            onclick: () => sectionIconModal(section, { onSaved: () => { paintTabs(); refresh(); } }),
          },
          SectionIconGlyph({
            iconKey: section.iconKey || iconForTitle(section.title),
            iconAsset: section.iconAsset,
          }),
        ),
        h('span', { class: 'tab-row__title' }, section.title),
        section.status === 'published'
          ? h('span', { class: 'badge badge--live' }, 'Published')
          : h('span', { class: 'badge badge--draft' }, 'Draft'),
        section.hidden ? h('span', { class: 'badge badge--hidden' }, 'Hidden') : null,
        h('div', { class: 'topbar__spacer' }),
        h(
          'div',
          { class: 'row-actions' },
          h(
            'button',
            {
              class: 'btn btn--ghost btn--sm',
              onclick: () => navigate(`/o/${org.id}/${section.id}/edit`),
            },
            'Edit',
          ),
          h(
            'button',
            {
              class: 'btn btn--ghost btn--sm',
              onclick: () =>
                promptModal({
                  title: 'Rename tab',
                  label: 'Tab title',
                  value: section.title,
                  onSubmit: async (title) => {
                    try {
                      upsertSection(await updateSection(section.id, { title }));
                      toastSuccess('Tab renamed');
                      paintTabs();
                      refresh();
                    } catch (err) {
                      toastError(err.message);
                    }
                  },
                }),
            },
            'Rename',
          ),
          h(
            'button',
            {
              class: 'btn btn--ghost btn--sm',
              onclick: async () => {
                try {
                  upsertSection(await updateSection(section.id, { hidden: !section.hidden }));
                  toastSuccess(section.hidden ? 'Tab shown to presenters' : 'Tab hidden from presenters');
                  paintTabs();
                } catch (err) {
                  toastError(err.message);
                }
              },
            },
            section.hidden ? 'Show' : 'Hide',
          ),
          h(
            'button',
            {
              class: 'btn btn--ghost btn--sm',
              onclick: async () => {
                const next = section.status === 'published' ? 'draft' : 'published';
                try {
                  upsertSection(await updateSection(section.id, { status: next }));
                  toastSuccess(next === 'published' ? 'Tab published' : 'Tab moved to draft');
                  paintTabs();
                } catch (err) {
                  toastError(err.message);
                }
              },
            },
            section.status === 'published' ? 'Unpublish' : 'Publish',
          ),
          h(
            'button',
            {
              class: 'btn btn--danger btn--sm',
              onclick: () =>
                confirmModal({
                  title: 'Delete tab?',
                  text: `"${section.title}" and all of its content will be removed from ${org.name}.`,
                  confirmLabel: 'Delete tab',
                  danger: true,
                  onConfirm: async () => {
                    try {
                      await deleteSection(section.id);
                      removeSection(section.id);
                      toastSuccess('Tab deleted');
                      paintTabs();
                      refresh();
                    } catch (err) {
                      toastError(err.message);
                    }
                  },
                }),
            },
            'Delete',
          ),
        ),
      ),
    );

    enableDragSort(
      rows,
      async (from, to) => {
        const order = moveItem(state.sections.map((s) => s.id), from, to);
        try {
          setSections(await reorderSections(org.id, order));
          toastSuccess('Tab order saved');
          paintTabs();
          refresh();
        } catch (err) {
          toastError(err.message);
        }
      },
      { handle: '.block-card__handle' },
    );

    render(tabHost, rows.length ? rows : h('div', { class: 'empty-note' }, 'No tabs yet.'));
  };

  // The deck is a fixed set of sections and subsections — this panel renames,
  // reorders, hides and publishes them; it does not create them.
  const tabsPanel = h(
    'div',
    { class: 'panel' },
    h(
      'div',
      { class: 'panel__head' },
      h('h2', { class: 'panel__title' }, 'Tabs & section order'),
    ),
    h(
      'p',
      { class: 'panel__hint' },
      'Drag ⠿ to reorder the deck. Hidden tabs stay visible to admins only; drafts are invisible to presenters until published.',
    ),
    tabHost,
  );

  render(
    container,
    h(
      'div',
      { class: 'shell' },
      SideNav(org, null, { onLogout }),
      h(
        'div',
        { class: 'main' },
        TopBar({
          org,
          crumbTail: 'Settings',
          actions: [
            h(
              'button',
              { class: 'btn btn--ghost btn--sm', onclick: () => navigate(`/o/${org.id}`) },
              'Back to presentation',
            ),
          ],
        }),
        h('div', { class: 'stage' }, h('div', { class: 'editor' }, identityPanel, brandPanel, templatesPanel, tabsPanel)),
      ),
    ),
  );

  paintTabs();
  paintTemplates();
}
