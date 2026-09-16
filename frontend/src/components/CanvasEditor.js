import { h, render } from '../utils/dom.js';
import { renderBlock, boxClasses } from './BlockRenderer.js';
import { BlockFields, BLOCK_LABELS } from './BlockFields.js';
import { ElementLibrary, ELEMENT_ICONS, DRAG_TYPE } from './ElementLibrary.js';
import { openModal } from './Modal.js';
import { chooseFiles, upload } from './ImageUploader.js';
import { toast } from './Toast.js';
import { newBlock, reid, presetById, PRESET_PREFIX } from '../utils/blocks.js';
import {
  COLUMNS,
  ROW_HEIGHT,
  GAP,
  MIN_W,
  MIN_H,
  MAX_BOX_DEPTH,
  DEFAULT_SIZE,
  clamp,
  layoutOf,
  autoPlace,
  compact,
  resolveCollisions,
  inReadingOrder,
  canvasRows,
  ensureLayouts,
  applyGridStyle,
} from '../utils/layout.js';

/**
 * The editing surface: the real slide canvas with drag, resize, a per-block
 * toolbar and nested layout boxes. What the admin arranges here is exactly what
 * presenters see.
 *
 * Elements arrive one of two ways — dragged from the library and dropped on a
 * precise cell, or clicked, in which case the first balanced free slot is found
 * for them. Either way they land somewhere sensible and can then be moved,
 * resized, reordered, duplicated or deleted by hand.
 */
const HISTORY_LIMIT = 60;

/** How far a nested canvas's rows shrink, so a box does not tower over its content. */
const nestedRow = (depth) => Math.round(ROW_HEIGHT * (depth ? 0.9 : 1));
const nestedGap = (depth) => Math.round(GAP * (depth ? 0.75 : 1));

export function CanvasEditor(initialBlocks, onChange, { suggestedElements = [] } = {}) {
  let blocks = ensureLayouts(structuredClone(initialBlocks || []));
  let selectedId = null;
  const past = [];
  const future = [];

  const canvas = h('div', { class: 'canvas canvas--editing' });
  const historyBar = h('div', { class: 'history-bar' });
  const element = h(
    'div',
    { class: 'canvas-editor' },
    historyBar,
    canvas,
    ElementLibrary({ onAdd: (type) => addBlock(type), suggested: suggestedElements }),
  );

  const emit = () => onChange(structuredClone(blocks));

  /** Repaint + notify. Every mutation goes through here. */
  const commit = () => {
    paint();
    emit();
  };

  /** Snapshot before a mutation, so it can be undone as one step. */
  function checkpoint(snapshot = structuredClone(blocks)) {
    past.push(snapshot);
    if (past.length > HISTORY_LIMIT) past.shift();
    future.length = 0;
  }

  function undo() {
    if (!past.length) return;
    future.push(structuredClone(blocks));
    blocks = ensureLayouts(past.pop());
    commit();
  }

  function redo() {
    if (!future.length) return;
    past.push(structuredClone(blocks));
    blocks = ensureLayouts(future.pop());
    commit();
  }

  /* ------------------------------------------------------------- locating */
  /** Finds a block anywhere in the tree, with the list and depth it lives at. */
  function locate(id, list = blocks, depth = 0) {
    for (const block of list) {
      if (block.id === id) return { block, list, depth };
      if (block.type === 'box' && Array.isArray(block.children)) {
        const found = locate(id, block.children, depth + 1);
        if (found) return found;
      }
    }
    return null;
  }

  /* ------------------------------------------------------------ add block */
  /** A ready-made row carries its own size; everything else uses the default. */
  function sizeFor(type) {
    const preset = type.startsWith(PRESET_PREFIX)
      ? presetById(type.slice(PRESET_PREFIX.length))
      : null;
    const size = preset ? preset.build().layout : DEFAULT_SIZE[type] || { w: 6, h: 5 };
    return { w: clamp(size.w, MIN_W, COLUMNS), h: Math.max(MIN_H, size.h) };
  }

  /**
   * Adds an element. `at` is a grid cell when the element was dropped; without
   * one the first balanced free slot is used, so a half-width element lands
   * beside an existing one rather than below it.
   */
  function addBlock(type, { list = blocks, at = null, depth = 0 } = {}) {
    const preset = type.startsWith(PRESET_PREFIX)
      ? presetById(type.slice(PRESET_PREFIX.length))
      : null;
    // A ready-made row is a layout box, so it obeys the same nesting limit.
    if ((type === 'box' || preset) && depth >= MAX_BOX_DEPTH) {
      toast(`Layout boxes can nest ${MAX_BOX_DEPTH} deep.`, 'info');
      return null;
    }
    checkpoint();
    const block = preset ? preset.build() : newBlock(type);
    const size = sizeFor(type);
    block.layout = at
      ? { x: clamp(at.x, 0, COLUMNS - size.w), y: Math.max(0, at.y), ...size }
      : autoPlace(list, size);
    list.push(block);
    if (at) resolveCollisions(list, block.id);
    selectedId = block.id;
    commit();
    revealBlock(block.id);

    // Images go straight to the file picker; everything else opens its form, so
    // a new element is never left as an unexplained empty rectangle. A ready-made
    // row is already populated, so it opens nothing and is just dropped in place.
    if (preset) return block;
    if (['image', 'profile', 'logo'].includes(type)) pickAssetFor(block, 'image');
    else if (type !== 'divider' && type !== 'box') openEditor(block);
    return block;
  }

  /**
   * Brings a freshly placed element into view and flashes it. Adding to a
   * section that is already full puts the new element below the fold, and
   * without this it looks as though nothing happened.
   */
  function revealBlock(blockId) {
    requestAnimationFrame(() => {
      const cell = element.querySelector(`.canvas-block.is-selected`);
      if (!cell || !locate(blockId)) return;
      cell.classList.add('is-landed');
      cell.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    });
  }

  async function pickAssetFor(block, accept) {
    const files = await chooseFiles({ multiple: false, accept });
    if (!files?.length) return;
    const assets = await upload(files);
    if (!assets[0]) return;
    block.assetId = assets[0].id;
    block.asset = assets[0];
    if (assets[0].note) toast(assets[0].note, 'info', 7000);
    commit();
  }

  /* --------------------------------------------------------------- editing */
  function openEditor(block) {
    // The undo entry is only recorded once something actually changes, so
    // opening a dialog and closing it again does not fill the history.
    const before = structuredClone(blocks);
    let recorded = false;

    openModal({
      title: `Edit ${(BLOCK_LABELS[block.type] || block.type).toLowerCase()}`,
      wide: true,
      render: () => BlockFields(block, () => {
        if (!recorded) {
          recorded = true;
          checkpoint(before);
        }
        emit();
        paintHistoryBar();
      }),
      // Repaint once the dialog closes so the canvas shows the new content.
      onClose: () => paint(),
      actions: (dismiss) => [h('button', { class: 'btn btn--primary', onclick: dismiss }, 'Done')],
    });
  }

  function deleteBlock(block, list) {
    checkpoint();
    const index = list.findIndex((item) => item.id === block.id);
    if (index !== -1) list.splice(index, 1);
    compact(list);
    if (selectedId === block.id) selectedId = null;
    commit();
  }

  function duplicateBlock(block, list) {
    checkpoint();
    const copy = reid(block);
    copy.layout = autoPlace(list, { w: layoutOf(block).w, h: layoutOf(block).h });
    list.push(copy);
    selectedId = copy.id;
    commit();
  }

  /* ------------------------------------------------- drag & resize plumbing */
  /** Grid unit size for a specific canvas — nested boxes are narrower. */
  function unitSize(canvasEl, depth) {
    const styles = getComputedStyle(canvasEl);
    const inner = canvasEl.clientWidth
      - parseFloat(styles.paddingLeft || 0)
      - parseFloat(styles.paddingRight || 0);
    const gap = nestedGap(depth);
    return {
      col: (Math.max(inner, 120) - (COLUMNS - 1) * gap) / COLUMNS + gap,
      row: nestedRow(depth) + gap,
    };
  }

  /** True when two grid rectangles are the same — used to skip no-op history. */
  const sameLayout = (a, b) => a.x === b.x && a.y === b.y && a.w === b.w && a.h === b.h;

  /**
   * Moves a block.
   *
   * `immediate` is the grip: the pointer went down on a handle that does
   * nothing else, so the drag starts at once. Everywhere else on the block the
   * drag only begins once the pointer has actually travelled — below that
   * threshold the press is still a click, so the buttons and the click-to-zoom
   * frame inside a block keep working. A press that turns into a drag swallows
   * the click that would otherwise follow it.
   */
  const DRAG_THRESHOLD = 4;

  function startDrag(event, block, cell, ctx, { immediate = false } = {}) {
    if (event.button !== undefined && event.button !== 0) return;
    event.stopPropagation();
    // Snapshot now, but only record it if the block actually moves — pressing
    // a block without dragging must not leave an undo step that does nothing.
    const before = structuredClone(blocks);
    const start = layoutOf(block);
    const origin = { x: event.clientX, y: event.clientY };
    const unit = unitSize(ctx.canvasEl, ctx.depth);
    const next = { ...start };
    let active = false;

    const begin = () => {
      active = true;
      cell.classList.add('is-moving');
      document.body.classList.add('is-block-dragging');
    };

    if (immediate) {
      event.preventDefault();
      begin();
    }

    const move = (moveEvent) => {
      if (!active) {
        const travelled = Math.abs(moveEvent.clientX - origin.x) + Math.abs(moveEvent.clientY - origin.y);
        if (travelled < DRAG_THRESHOLD) return;
        begin();
      }
      moveEvent.preventDefault();
      const dx = Math.round((moveEvent.clientX - origin.x) / unit.col);
      const dy = Math.round((moveEvent.clientY - origin.y) / unit.row);
      next.x = clamp(start.x + dx, 0, COLUMNS - start.w);
      next.y = Math.max(0, start.y + dy);
      applyGridStyle(cell, next);
    };

    const end = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', end);
      if (!active) return;
      cell.classList.remove('is-moving');
      document.body.classList.remove('is-block-dragging');
      // The click that follows the release belongs to the drag, not to whatever
      // is under the pointer — a picture must not open its lightbox because it
      // was used as a drag handle.
      cell.addEventListener('click', (click) => {
        click.preventDefault();
        click.stopPropagation();
      }, { capture: true, once: true });

      if (sameLayout(start, next)) {
        paint();
        return;
      }
      checkpoint(before);
      block.layout = next;
      // Push neighbours aside so nothing overlaps, but do not compact — the
      // block must stay where it was dropped, including deliberate gaps.
      resolveCollisions(ctx.list, block.id);
      commit();
    };

    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', end);
  }

  function startResize(event, block, cell, edge, ctx) {
    event.preventDefault();
    event.stopPropagation();
    const before = structuredClone(blocks);
    const start = layoutOf(block);
    const origin = { x: event.clientX, y: event.clientY };
    const unit = unitSize(ctx.canvasEl, ctx.depth);
    const next = { ...start };

    cell.classList.add('is-resizing');
    document.body.classList.add('is-block-dragging');

    const move = (moveEvent) => {
      const dx = Math.round((moveEvent.clientX - origin.x) / unit.col);
      const dy = Math.round((moveEvent.clientY - origin.y) / unit.row);
      if (edge.includes('e')) next.w = clamp(start.w + dx, MIN_W, COLUMNS - start.x);
      if (edge.includes('s')) next.h = Math.max(MIN_H, start.h + dy);
      applyGridStyle(cell, next);
    };

    const end = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', end);
      cell.classList.remove('is-resizing');
      document.body.classList.remove('is-block-dragging');
      if (sameLayout(start, next)) {
        paint();
        return;
      }
      checkpoint(before);
      block.layout = next;
      resolveCollisions(ctx.list, block.id);
      commit();
    };

    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', end);
  }

  /** Keyboard: arrows move the selection, shift+arrows resize it. */
  function onKeyDown(event) {
    const key = event.key || '';
    const isUndo = (event.ctrlKey || event.metaKey) && key.toLowerCase() === 'z';
    const isRedo = (event.ctrlKey || event.metaKey) && (key.toLowerCase() === 'y' || (key.toLowerCase() === 'z' && event.shiftKey));

    if (isRedo) {
      event.preventDefault();
      redo();
      return;
    }
    if (isUndo) {
      event.preventDefault();
      undo();
      return;
    }

    if (!selectedId) return;
    const found = locate(selectedId);
    if (!found) return;
    const { block, list } = found;
    const layout = layoutOf(block);
    const step = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }[key];
    if (!step) return;
    event.preventDefault();
    checkpoint();

    if (event.shiftKey) {
      block.layout = {
        ...layout,
        w: clamp(layout.w + step[0], MIN_W, COLUMNS - layout.x),
        h: Math.max(MIN_H, layout.h + step[1]),
      };
    } else {
      block.layout = {
        ...layout,
        x: clamp(layout.x + step[0], 0, COLUMNS - layout.w),
        y: Math.max(0, layout.y + step[1]),
      };
    }
    resolveCollisions(list, block.id);
    commit();
  }

  /* ------------------------------------------------- drop from the library */
  /** Turns a pointer position into the grid cell under it. */
  function cellAt(event, canvasEl, depth, size) {
    const rect = canvasEl.getBoundingClientRect();
    const styles = getComputedStyle(canvasEl);
    const unit = unitSize(canvasEl, depth);
    const x = Math.floor((event.clientX - rect.left - parseFloat(styles.paddingLeft || 0)) / unit.col);
    const y = Math.floor((event.clientY - rect.top - parseFloat(styles.paddingTop || 0)) / unit.row);
    return {
      x: clamp(Number.isFinite(x) ? x : 0, 0, COLUMNS - size.w),
      y: Math.max(0, Number.isFinite(y) ? y : 0),
    };
  }

  /**
   * `getList` rather than the array itself: the root canvas element outlives
   * every repaint, and undo replaces the whole block array — a captured
   * reference would keep dropping elements into the discarded one.
   */
  function makeDropTarget(canvasEl, getList, depth) {
    canvasEl.addEventListener('dragover', (event) => {
      if (!event.dataTransfer?.types?.includes(DRAG_TYPE)) return;
      // The innermost canvas under the pointer owns the drop.
      event.preventDefault();
      event.stopPropagation();
      event.dataTransfer.dropEffect = 'copy';
      canvasEl.classList.add('is-drop-target');
    });
    canvasEl.addEventListener('dragleave', (event) => {
      if (event.target === canvasEl) canvasEl.classList.remove('is-drop-target');
    });
    canvasEl.addEventListener('drop', (event) => {
      const type = event.dataTransfer?.getData(DRAG_TYPE);
      if (!type) return;
      event.preventDefault();
      event.stopPropagation();
      canvasEl.classList.remove('is-drop-target');
      addBlock(type, { list: getList(), depth, at: cellAt(event, canvasEl, depth, sizeFor(type)) });
    });
  }

  /* -------------------------------------------------------------- painting */
  function blockToolbar(block, cell, ctx) {
    const button = (label, title, onclick, extra = '') =>
      h(
        'button',
        { class: `block-toolbar__btn${extra}`, type: 'button', title, onclick },
        label,
      );

    return h(
      'div',
      { class: 'block-toolbar' },
      h(
        'button',
        {
          class: 'block-toolbar__btn block-toolbar__grip',
          type: 'button',
          title: 'Drag to move — or just drag the block itself',
          onpointerdown: (event) => startDrag(event, block, cell, ctx, { immediate: true }),
        },
        '⠿',
      ),
      h('span', { class: 'block-toolbar__label' },
        `${ELEMENT_ICONS[block.type] || '◆'} ${BLOCK_LABELS[block.type] || block.type}`),
      block.type === 'box' && ctx.depth < MAX_BOX_DEPTH
        ? button('+ Inside', 'Add an element inside this box', () => openInsertMenu(block, ctx.depth + 1), ' block-toolbar__btn--wide')
        : null,
      button('✎', 'Edit content', () => openEditor(block)),
      button('⧉', 'Duplicate', () => duplicateBlock(block, ctx.list)),
      button('✕', 'Delete', () => deleteBlock(block, ctx.list), ' block-toolbar__btn--danger'),
    );
  }

  /** Small chooser used by a box's “+ Inside” button. */
  function openInsertMenu(boxBlock, depth) {
    openModal({
      title: `Add inside ${boxBlock.label || 'this box'}`,
      text: 'The element is placed in the first free slot inside the box. You can drag it around in there afterwards.',
      wide: true,
      render: (close) =>
        ElementLibrary({
          suggested: [],
          onAdd: (type) => {
            close();
            addBlock(type, { list: boxBlock.children, depth });
          },
        }),
      actions: (close) => [h('button', { class: 'btn btn--ghost', onclick: close }, 'Cancel')],
    });
  }

  /** The editable shell of a layout box: its styling plus a nested canvas. */
  function boxShell(block, depth) {
    const inner = h('div', { class: 'canvas canvas--nested canvas--editing-nested' });
    if (!Array.isArray(block.children)) block.children = [];
    paintCanvas(inner, () => block.children, depth + 1);
    return h(
      'div',
      { class: boxClasses(block, 'layout-box--editing') },
      block.label ? h('div', { class: 'layout-box__label' }, block.label) : null,
      inner,
    );
  }

  function buildCell(block, ctx) {
    const layout = layoutOf(block);
    // A short block has no room for a 30px toolbar inside it, so it gets one
    // that floats above on hover instead of one that eats the content.
    const compact = layout.h <= 3 || layout.w <= 2;
    const cell = h('div', {
      class: `canvas-block canvas-block--${block.type} is-editing${compact ? ' is-compact' : ''}${selectedId === block.id ? ' is-selected' : ''}`,
      tabindex: '0',
      onpointerdown: (event) => {
        selectedId = block.id;
        element.querySelectorAll('.canvas-block').forEach((el) => el.classList.remove('is-selected'));
        cell.classList.add('is-selected');
        // The resize handles run their own gesture; everything else on the
        // block is a drag handle, which is what people reach for first.
        if (event.target.closest('.resize-handle, .block-toolbar')) return;
        startDrag(event, block, cell, ctx);
      },
    });

    const body = block.type === 'box'
      ? boxShell(block, ctx.depth)
      : renderBlock(block, { editing: true })
        || h('div', { class: 'media-empty' },
             h('span', {}, `Empty ${BLOCK_LABELS[block.type] || block.type}`));

    cell.append(
      blockToolbar(block, cell, ctx),
      h('div', { class: 'canvas-block__body' }, body),
      h('span', { class: 'resize-handle resize-handle--e', onpointerdown: (e) => startResize(e, block, cell, 'e', ctx) }),
      h('span', { class: 'resize-handle resize-handle--s', onpointerdown: (e) => startResize(e, block, cell, 's', ctx) }),
      h('span', { class: 'resize-handle resize-handle--se', onpointerdown: (e) => startResize(e, block, cell, 'se', ctx) }),
      h('span', { class: 'canvas-block__size' }, `${layout.w}×${layout.h}`),
    );

    applyGridStyle(cell, layout);
    return cell;
  }

  function paintCanvas(canvasEl, getList, depth) {
    const list = getList();
    render(canvasEl);
    canvasEl.style.setProperty('--row-height', `${nestedRow(depth)}px`);
    canvasEl.style.setProperty('--canvas-gap', `${nestedGap(depth)}px`);
    canvasEl.style.setProperty('--canvas-rows', String(Math.max(canvasRows(list), depth ? 4 : 6)));

    if (!canvasEl.dataset.dropBound) {
      makeDropTarget(canvasEl, getList, depth);
      canvasEl.dataset.dropBound = 'true';
    }

    if (!list.length) {
      canvasEl.append(
        depth
          ? h('div', { class: 'canvas-empty canvas-empty--nested' },
              h('span', {}, 'Empty box — drop an element here'))
          : h('div', { class: 'canvas-empty' },
              h('strong', {}, 'Empty canvas'),
              h('span', {}, 'Drag an element from the library onto this grid, or click one to have it placed for you.')),
      );
      return;
    }

    for (const block of inReadingOrder(list)) {
      canvasEl.append(buildCell(block, { list, canvasEl, depth }));
    }
  }

  function paintHistoryBar() {
    render(
      historyBar,
      h('span', { class: 'history-bar__label' }, 'Canvas'),
      h(
        'button',
        {
          class: 'btn btn--ghost btn--sm',
          type: 'button',
          title: 'Undo (Ctrl+Z)',
          disabled: !past.length,
          onclick: undo,
        },
        '↺  Undo',
      ),
      h(
        'button',
        {
          class: 'btn btn--ghost btn--sm',
          type: 'button',
          title: 'Redo (Ctrl+Shift+Z)',
          disabled: !future.length,
          onclick: redo,
        },
        '↻  Redo',
      ),
      h('div', { class: 'topbar__spacer' }),
      h('span', { class: 'badge' }, `${countBlocks(blocks)} elements`),
    );
  }

  function countBlocks(list) {
    return list.reduce(
      (total, block) => total + 1 + (block.type === 'box' ? countBlocks(block.children || []) : 0),
      0,
    );
  }

  function paint() {
    // Nested canvases are rebuilt on every paint, so their bound flags go too.
    paintCanvas(canvas, () => blocks, 0);
    paintHistoryBar();
  }

  /* ---------------------------------------------------------- keybindings */
  const onDocumentKey = (event) => {
    // The editor is torn down by a full re-render, which leaves no unmount
    // hook — so the listener retires itself once its element has gone.
    if (!document.body.contains(element)) {
      document.removeEventListener('keydown', onDocumentKey);
      return;
    }
    const target = event.target;
    const typing = target?.closest?.('input, textarea, select, [contenteditable="true"]');
    const inModal = target?.closest?.('.modal-backdrop');
    if (typing || inModal) return;
    onKeyDown(event);
  };
  document.addEventListener('keydown', onDocumentKey);

  paint();

  return {
    element,
    getBlocks: () => structuredClone(blocks),
    /** Lets the page insert a block chosen elsewhere (the slide's quick-add). */
    addBlock: (type) => addBlock(type),
    /** Replaces the whole canvas — used by the sample-layout picker. */
    setBlocks: (next) => {
      checkpoint();
      blocks = ensureLayouts(structuredClone(next || []));
      selectedId = null;
      commit();
    },
    /** Appends a saved layout below whatever is already there. */
    appendBlocks: (next) => {
      checkpoint();
      const offset = canvasRows(blocks);
      const incoming = ensureLayouts(structuredClone(next || [])).map((block) => {
        const copy = reid(block);
        copy.layout = { ...layoutOf(block), y: layoutOf(block).y + offset };
        return copy;
      });
      blocks.push(...incoming);
      commit();
    },
    clearAll: () => {
      checkpoint();
      blocks = [];
      selectedId = null;
      commit();
    },
    canUndo: () => past.length > 0,
    undo,
    redo,
    destroy: () => document.removeEventListener('keydown', onDocumentKey),
  };
}
