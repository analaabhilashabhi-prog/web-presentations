/** Minimal element builder — the whole component layer is written against it. */
export function h(tag, props = {}, ...children) {
  const el = document.createElement(tag);

  for (const [key, value] of Object.entries(props || {})) {
    if (value === null || value === undefined || value === false) continue;

    if (key === 'class') el.className = value;
    else if (key === 'text') el.textContent = value;
    else if (key === 'html') el.innerHTML = value;
    else if (key === 'style' && typeof value === 'object') applyStyle(el, value);
    else if (key === 'dataset') Object.assign(el.dataset, value);
    else if (key.startsWith('on') && typeof value === 'function') {
      el.addEventListener(key.slice(2).toLowerCase(), value);
    } else if (value === true) el.setAttribute(key, '');
    else el.setAttribute(key, String(value));
  }

  append(el, children);
  return el;
}

const SVG_NS = 'http://www.w3.org/2000/svg';

/**
 * SVG twin of `h`. Vector nodes must be created in the SVG namespace —
 * `document.createElement('svg')` yields an unknown HTML element that never
 * paints, so every icon in the app is built through this.
 */
export function svg(tag, props = {}, ...children) {
  const el = document.createElementNS(SVG_NS, tag);

  for (const [key, value] of Object.entries(props || {})) {
    if (value === null || value === undefined || value === false) continue;
    if (key === 'class') el.setAttribute('class', value);
    else if (key === 'style' && typeof value === 'object') applyStyle(el, value);
    else if (key.startsWith('on') && typeof value === 'function') {
      el.addEventListener(key.slice(2).toLowerCase(), value);
    } else if (value === true) el.setAttribute(key, '');
    else el.setAttribute(key, String(value));
  }

  append(el, children);
  return el;
}

/** Custom properties need setProperty — plain assignment silently does nothing. */
export function applyStyle(el, style) {
  for (const [key, value] of Object.entries(style || {})) {
    if (value === null || value === undefined) continue;
    if (key.startsWith('--')) el.style.setProperty(key, String(value));
    else el.style[key] = value;
  }
  return el;
}

export function append(parent, children) {
  for (const child of children.flat(4)) {
    if (child === null || child === undefined || child === false) continue;
    parent.append(child instanceof Node ? child : document.createTextNode(String(child)));
  }
  return parent;
}

export function clear(node) {
  while (node.firstChild) node.removeChild(node.firstChild);
  return node;
}

export function render(container, ...children) {
  clear(container);
  append(container, children);
  return container;
}

/**
 * Attaches HTML5 drag-and-drop reordering to a list of elements.
 *
 * When `handle` is given, the element only becomes draggable while the pointer
 * is on that handle — otherwise a draggable wrapper swallows text selection in
 * the inputs it contains.
 */
export function enableDragSort(
  items,
  onReorder,
  { dragClass = 'is-dragging', overClass = 'is-dropzone', handle = null } = {},
) {
  let fromIndex = null;

  items.forEach((el, index) => {
    if (handle) {
      el.draggable = false;
      const grip = el.querySelector(handle);
      if (grip) {
        grip.addEventListener('mousedown', () => {
          el.draggable = true;
        });
        grip.addEventListener('touchstart', () => {
          el.draggable = true;
        }, { passive: true });
      }
      el.addEventListener('mouseup', () => {
        el.draggable = false;
      });
    } else {
      el.draggable = true;
    }

    el.addEventListener('dragstart', (event) => {
      fromIndex = index;
      el.classList.add(dragClass);
      event.dataTransfer.effectAllowed = 'move';
      event.dataTransfer.setData('text/plain', String(index));
    });
    el.addEventListener('dragend', () => {
      fromIndex = null;
      el.classList.remove(dragClass);
      if (handle) el.draggable = false;
      items.forEach((other) => other.classList.remove(overClass));
    });
    el.addEventListener('dragover', (event) => {
      event.preventDefault();
      event.dataTransfer.dropEffect = 'move';
      if (fromIndex !== null && fromIndex !== index) el.classList.add(overClass);
    });
    el.addEventListener('dragleave', () => el.classList.remove(overClass));
    el.addEventListener('drop', (event) => {
      event.preventDefault();
      el.classList.remove(overClass);
      const from = fromIndex ?? Number(event.dataTransfer.getData('text/plain'));
      if (Number.isNaN(from) || from === index) return;
      onReorder(from, index);
    });
  });
}

export function moveItem(list, from, to) {
  const copy = [...list];
  const [moved] = copy.splice(from, 1);
  copy.splice(to, 0, moved);
  return copy;
}
