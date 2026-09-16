import { h, render } from '../utils/dom.js';
import { SideNav } from '../components/SideNav.js';
import { TopBar } from '../components/TopBar.js';
import { CanvasEditor } from '../components/CanvasEditor.js';
import { SlideView } from '../components/SlideView.js';
import { confirmModal, promptModal, openModal } from '../components/Modal.js';
import { openTemplatePicker } from '../components/TemplatePicker.js';
import { toastError, toastSuccess } from '../components/Toast.js';
import { navigate, refresh } from '../utils/router.js';
import { state, upsertSection, removeSection, setSections } from '../context/appStore.js';
import { updateSection, deleteSection, duplicateSection, reorderSections } from '../services/contentService.js';
import { saveTemplate } from '../services/templateService.js';
import { suggestedElementsFor, matchArchetype } from '../utils/sectionTemplates.js';
import { pickIconModal } from '../components/SectionModal.js';
import { SectionIconGlyph } from '../components/IconChooser.js';
import { iconForTitle } from '../utils/icons.js';

/**
 * Admin editor for one section: metadata, the block canvas, sample layouts,
 * live preview and publishing.
 *
 * The canvas and the preview are the same renderer, so "Preview" is a view of
 * the real thing rather than an approximation.
 */
export function EditPage(container, { org, section, onLogout }) {
  let draft = {
    title: section.title,
    subtitle: section.subtitle || '',
    iconKey: section.iconKey || '',
    iconAssetId: section.iconAssetId || null,
    hidden: Boolean(section.hidden),
    status: section.status,
    blocks: structuredClone(section.blocks || []),
  };
  // Kept beside the draft so the icon button can preview an uploaded mark that
  // has not been saved to the section yet.
  let draftIconAsset = section.iconAsset || null;
  let dirty = false;
  let mode = 'edit';

  const previewHost = h('div', {});
  const dirtyFlag = h('span', { class: 'badge' }, 'Saved');
  const archetype = matchArchetype(section.title);

  const markDirty = () => {
    dirty = true;
    dirtyFlag.textContent = 'Unsaved changes';
    dirtyFlag.className = 'badge badge--hidden';
  };

  const markClean = () => {
    dirty = false;
    dirtyFlag.textContent = 'Saved';
    dirtyFlag.className = 'badge badge--live';
  };

  let previewTimer = null;
  const paintPreview = () => {
    clearTimeout(previewTimer);
    previewTimer = setTimeout(() => {
      render(
        previewHost,
        SlideView({ ...section, ...draft }, org, { showStatus: true }),
      );
    }, 220);
  };

  const editor = CanvasEditor(
    draft.blocks,
    (blocks) => {
      draft.blocks = blocks;
      markDirty();
      paintPreview();
    },
    { suggestedElements: suggestedElementsFor(section.title) },
  );

  const save = async (status) => {
    try {
      const saved = await updateSection(section.id, { ...draft, status: status || draft.status });
      upsertSection(saved);
      draft = {
        title: saved.title,
        subtitle: saved.subtitle || '',
        iconKey: saved.iconKey || '',
        iconAssetId: saved.iconAssetId || null,
        hidden: Boolean(saved.hidden),
        status: saved.status,
        blocks: structuredClone(saved.blocks || []),
      };
      draftIconAsset = saved.iconAsset || null;
      markClean();
      toastSuccess(status === 'published' ? 'Published — presenters see this now' : 'Saved as draft');
      refresh();
    } catch (err) {
      toastError(err.message);
    }
  };

  const removeThisSection = () =>
    confirmModal({
      title: 'Delete this section?',
      text: `"${section.title}" and its content will be removed from ${org.name}. This cannot be undone.`,
      confirmLabel: 'Delete section',
      danger: true,
      onConfirm: async () => {
        try {
          await deleteSection(section.id);
          removeSection(section.id);
          toastSuccess('Section deleted');
          navigate(`/o/${org.id}`);
        } catch (err) {
          toastError(err.message);
        }
      },
    });

  /* ------------------------------------------------------- sample layouts */
  const applyLayout = (blocks, { replace }) => {
    if (replace) editor.setBlocks(blocks);
    else editor.appendBlocks(blocks);
    toastSuccess(
      replace
        ? 'Sample layout applied — edit anything in it, or use Undo to go back'
        : 'Layout added below your existing content',
    );
  };

  const chooseLayout = () => {
    const hasContent = draft.blocks.length > 0;
    openTemplatePicker({
      sectionName: draft.title,
      title: hasContent ? 'Add or replace with a sample layout' : 'Choose a starting layout',
      allowBlank: hasContent,
      onPick: (blocks) => {
        if (!hasContent) {
          applyLayout(blocks, { replace: true });
          return;
        }
        // With content already on the canvas, replacing is destructive — so ask
        // rather than assume, and offer the non-destructive option beside it.
        openModal({
          title: 'This section already has content',
          text: 'Replace what is on the canvas with this layout, or add it below what is already there?',
          actions: (close) => [
            h('button', { class: 'btn btn--ghost', onclick: close }, 'Cancel'),
            h('button', {
              class: 'btn btn--primary',
              onclick: () => { close(); applyLayout(blocks, { replace: false }); },
            }, 'Add below'),
            h('button', {
              class: 'btn btn--danger',
              onclick: () => { close(); applyLayout(blocks, { replace: true }); },
            }, 'Replace everything'),
          ],
        });
      },
      onBlank: () => clearSection(),
    });
  };

  const clearSection = () =>
    confirmModal({
      title: 'Remove everything in this section?',
      text: `Every element in "${section.title}" is removed, leaving a blank canvas. The section itself stays, `
        + 'and Undo will bring the content back. Nothing is saved until you press Save.',
      confirmLabel: 'Clear the canvas',
      danger: true,
      onConfirm: async () => {
        editor.clearAll();
        toastSuccess('Canvas cleared — add your own elements, then Save');
      },
    });

  const saveAsTemplate = () =>
    promptModal({
      title: 'Save this layout as a template',
      text: 'It becomes an option in the sample-layout picker for every section, in both organizations.',
      label: 'Template name',
      value: draft.title,
      confirmLabel: 'Save template',
      onSubmit: async (name) => {
        try {
          await saveTemplate({ name, blocks: draft.blocks, orgId: org.id, description: `From “${draft.title}”` });
          toastSuccess('Template saved — you will find it in the layout picker');
        } catch (err) {
          toastError(err.message);
        }
      },
    });

  const duplicateThisSection = () =>
    promptModal({
      title: 'Duplicate this section',
      text: 'A copy is created as a draft at the end of the deck, with all of its content.',
      label: 'Name for the copy',
      value: `${draft.title} copy`,
      confirmLabel: 'Create copy',
      onSubmit: async (title) => {
        try {
          const created = await duplicateSection(section.id, { title });
          upsertSection(created);
          toastSuccess(`"${created.title}" created`);
          navigate(`/o/${org.id}/${created.id}/edit`);
        } catch (err) {
          toastError(err.message);
        }
      },
    });

  /* ---------------------------------------------------------------- panels */
  // The icon is part of the draft, so it is written by the same Save as the
  // title and the canvas rather than committed behind the admin's back.
  const iconButton = h('button', { class: 'icon-field', type: 'button' });

  const paintIconButton = () => {
    render(
      iconButton,
      h(
        'span',
        { class: 'icon-field__chip' },
        SectionIconGlyph({
          iconKey: draft.iconKey || iconForTitle(draft.title),
          iconAsset: draft.iconAssetId ? draftIconAsset : null,
        }),
      ),
      h('span', { class: 'icon-field__text' }, draft.iconAssetId ? 'Uploaded mark' : 'Library icon'),
      h('span', { class: 'icon-field__act' }, 'Change'),
    );
  };

  iconButton.addEventListener('click', () =>
    pickIconModal({
      title: 'Nav icon',
      previewTitle: draft.title,
      iconKey: draft.iconKey,
      iconAsset: draft.iconAssetId ? draftIconAsset : null,
      onPick: ({ iconKey, iconAssetId, asset }) => {
        draft.iconKey = iconKey;
        draft.iconAssetId = iconAssetId;
        draftIconAsset = asset || draftIconAsset;
        paintIconButton();
        markDirty();
      },
    }),
  );

  paintIconButton();

  const field = (label, control, hint) =>
    h(
      'label',
      { class: 'field' },
      h('span', { class: 'field__label' }, label),
      control,
      hint ? h('span', { class: 'panel__hint', style: { margin: '0' } }, hint) : null,
    );

  const metaPanel = h(
    'div',
    { class: 'panel' },
    h(
      'div',
      { class: 'panel__head' },
      h('h2', { class: 'panel__title' }, 'Section details'),
      dirtyFlag,
      h('div', { class: 'topbar__spacer' }),
      h('span', { class: 'badge badge--accent' }, section.key),
    ),
    h(
      'div',
      { class: 'grid-2' },
      field(
        'Section name',
        h('input', {
          class: 'input',
          value: draft.title,
          oninput: (e) => {
            draft.title = e.target.value;
            markDirty();
            paintPreview();
          },
        }),
        'The name decides which sample layouts and elements are suggested.',
      ),
      field(
        'Kicker / subtitle',
        h('input', {
          class: 'input',
          value: draft.subtitle,
          placeholder: 'Shown above the slide title',
          oninput: (e) => {
            draft.subtitle = e.target.value;
            markDirty();
            paintPreview();
          },
        }),
      ),
      field(
        'Nav icon',
        iconButton,
        'Shown beside this section in the navigation pane — a library icon, or your own PNG/SVG.',
      ),
    ),
    h(
      'label',
      { class: 'checkbox-row' },
      h('input', {
        type: 'checkbox',
        checked: draft.hidden,
        onchange: (e) => {
          draft.hidden = e.target.checked;
          markDirty();
          paintPreview();
        },
      }),
      'Hide this section from presenters (stays visible to admins)',
    ),
  );

  const editHost = h('div', { class: 'mode-pane' }, editor.element);
  const previewPane = h('div', { class: 'mode-pane is-hidden' }, previewHost);

  const modeButton = (value, label) =>
    h(
      'button',
      {
        class: `mode-toggle__btn${mode === value ? ' is-active' : ''}`,
        type: 'button',
        dataset: { mode: value },
        onclick: () => setMode(value),
      },
      label,
    );

  const modeToggle = h('div', { class: 'mode-toggle' }, modeButton('edit', '✎  Edit'), modeButton('preview', '▷  Preview'));

  function setMode(next) {
    mode = next;
    editHost.classList.toggle('is-hidden', mode !== 'edit');
    previewPane.classList.toggle('is-hidden', mode !== 'preview');
    modeToggle.querySelectorAll('.mode-toggle__btn').forEach((button) => {
      button.classList.toggle('is-active', button.dataset.mode === mode);
    });
    if (mode === 'preview') paintPreview();
  }

  const contentPanel = h(
    'div',
    { class: 'panel' },
    h(
      'div',
      { class: 'panel__head' },
      h('h2', { class: 'panel__title' }, 'Page builder'),
      modeToggle,
      h('div', { class: 'topbar__spacer' }),
      h('button', { class: 'btn btn--ghost btn--sm', type: 'button', onclick: chooseLayout }, '◱  Sample layouts'),
      h('button', { class: 'btn btn--ghost btn--sm', type: 'button', onclick: saveAsTemplate }, '⌸  Save as template'),
      h('button', { class: 'btn btn--ghost btn--sm', type: 'button', onclick: clearSection }, '✕  Clear canvas'),
    ),
    h(
      'p',
      { class: 'panel__hint' },
      archetype
        ? `This looks like a ${archetype.label.toLowerCase()} section, so its elements are highlighted in the library below. `
        : '',
      'Drag an element from the library onto the grid to place it exactly, or click one and it is placed for you. '
      + 'Drag ⠿ to move, pull the right or bottom edge to resize, and drop elements inside a layout box to nest them. '
      + 'Arrow keys nudge the selection, Shift+arrows resize it, Ctrl+Z undoes.',
    ),
    editHost,
    previewPane,
  );

  const stickyActions = h(
    'div',
    { class: 'sticky-actions' },
    h('button', { class: 'btn btn--ghost', onclick: () => navigate(`/o/${org.id}/${section.id}`) }, '← Back to slide'),
    h('div', { class: 'topbar__spacer' }),
    h('button', { class: 'btn btn--ghost', onclick: duplicateThisSection }, 'Duplicate section'),
    h(
      'span',
      { class: 'badge', title: 'Current publish state' },
      draft.status === 'published' ? 'Published' : 'Draft',
    ),
    h('button', { class: 'btn btn--danger', onclick: removeThisSection }, 'Delete section'),
    h('button', { class: 'btn btn--ghost', onclick: () => save('draft') }, 'Save as draft'),
    h('button', { class: 'btn btn--primary', onclick: () => save('published') }, 'Save & publish'),
  );

  const onReorder = async (order) => {
    try {
      setSections(await reorderSections(org.id, order));
      toastSuccess('Section order saved');
      refresh();
    } catch (err) {
      toastError(err.message);
    }
  };

  render(
    container,
    h(
      'div',
      { class: 'shell' },
      SideNav(org, section.id, { onReorder, onLogout }),
      h(
        'div',
        { class: 'main' },
        TopBar({
          org,
          section,
          crumbTail: `Editing · ${section.title}`,
          actions: [
            h(
              'button',
              { class: 'btn btn--ghost btn--sm', onclick: () => navigate(`/o/${org.id}/${section.id}`) },
              'View slide',
            ),
            h('button', { class: 'btn btn--primary btn--sm', onclick: () => save('published') }, 'Save & publish'),
          ],
        }),
        h('div', { class: 'stage' }, h('div', { class: 'editor' }, metaPanel, contentPanel, stickyActions)),
      ),
    ),
  );

  markClean();
  paintPreview();

  // Arriving from the slide's quick-add row: insert that element immediately.
  if (state.pendingBlockType) {
    const type = state.pendingBlockType;
    state.pendingBlockType = null;
    editor.addBlock(type);
  }

  // A section created from the nav opens straight into the layout chooser.
  if (state.pendingTemplatePick) {
    state.pendingTemplatePick = false;
    if (!draft.blocks.length) chooseLayout();
  }

  // Only warns while this editor is on screen — main.js clears the guard on
  // every route change so it cannot outlive the page.
  window.onbeforeunload = (event) => {
    if (!dirty) return undefined;
    event.preventDefault();
    return 'You have unsaved changes.';
  };
}
