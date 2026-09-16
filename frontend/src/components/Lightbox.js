import { h, render } from '../utils/dom.js';
import { useShortcuts } from '../hooks/useShortcuts.js';

/** Click-to-zoom viewer with keyboard and on-screen navigation. */
export function openLightbox(images, startIndex = 0) {
  if (!images.length) return null;
  let index = Math.max(0, Math.min(startIndex, images.length - 1));

  const stage = h('div', { class: 'lightbox__stage' });
  const counter = h('span', {}, '');
  const caption = h('span', { class: 'lightbox__caption' }, '');

  const overlay = h(
    'div',
    { class: 'lightbox', role: 'dialog', 'aria-modal': 'true', 'aria-label': 'Image viewer' },
    h(
      'div',
      { class: 'lightbox__bar' },
      caption,
      h(
        'div',
        { class: 'row-actions' },
        counter,
        h('button', { class: 'icon-btn', title: 'Close (Esc)', onclick: () => close() }, '✕'),
      ),
    ),
    stage,
    h(
      'div',
      { class: 'lightbox__nav' },
      h('button', { class: 'icon-btn', title: 'Previous (←)', onclick: () => step(-1) }, '‹'),
      h('button', { class: 'icon-btn', title: 'Next (→)', onclick: () => step(1) }, '›'),
    ),
  );

  function paint() {
    const image = images[index];
    render(stage, h('img', { src: image.url, alt: image.name || 'Gallery image' }));
    counter.textContent = `${index + 1} / ${images.length}`;
    caption.textContent = image.name || '';
  }

  function step(delta) {
    index = (index + delta + images.length) % images.length;
    paint();
  }

  const disposeKeys = useShortcuts({
    Escape: () => close(),
    ArrowRight: () => step(1),
    ArrowLeft: () => step(-1),
    Space: () => step(1),
  }, { exclusive: true });

  function close() {
    disposeKeys();
    overlay.remove();
  }

  overlay.addEventListener('click', (event) => {
    if (event.target === overlay || event.target === stage) close();
  });

  paint();
  document.body.append(overlay);
  return { close };
}
