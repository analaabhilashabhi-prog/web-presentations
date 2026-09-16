import { h } from '../utils/dom.js';

/** Generic modal. `render(close)` supplies the body; returns the backdrop node. */
export function openModal({ title, text, render, actions, onClose, wide = false }) {
  const backdrop = h('div', { class: 'modal-backdrop', role: 'dialog', 'aria-modal': 'true' });
  let closed = false;
  const close = () => {
    if (closed) return;
    closed = true;
    backdrop.remove();
    document.removeEventListener('keydown', onKey);
    onClose?.();
  };
  const onKey = (event) => {
    if (event.key === 'Escape') close();
  };

  const modal = h(
    'div',
    { class: `modal${wide ? ' modal--wide' : ''}` },
    title ? h('h3', { class: 'modal__title' }, title) : null,
    text ? h('p', { class: 'modal__text' }, text) : null,
    render ? render(close) : null,
    actions ? h('div', { class: 'modal__actions' }, ...actions(close)) : null,
  );

  backdrop.append(modal);
  backdrop.addEventListener('click', (event) => {
    if (event.target === backdrop) close();
  });
  document.addEventListener('keydown', onKey);
  document.body.append(backdrop);
  modal.querySelector('input, textarea, button')?.focus();
  return { backdrop, close };
}

export function confirmModal({ title, text, confirmLabel = 'Confirm', danger = false, onConfirm }) {
  return openModal({
    title,
    text,
    actions: (close) => [
      h('button', { class: 'btn btn--ghost', onclick: close }, 'Cancel'),
      h(
        'button',
        {
          class: `btn ${danger ? 'btn--danger' : 'btn--primary'}`,
          onclick: async () => {
            close();
            await onConfirm();
          },
        },
        confirmLabel,
      ),
    ],
  });
}

export function promptModal({ title, text, label, value = '', confirmLabel = 'Save', onSubmit }) {
  let input;
  return openModal({
    title,
    text,
    render: () =>
      h(
        'label',
        { class: 'field' },
        h('span', { class: 'field__label' }, label),
        (input = h('input', {
          class: 'input',
          value,
          onkeydown: (event) => {
            if (event.key === 'Enter') event.target.closest('.modal').querySelector('.btn--primary').click();
          },
        })),
      ),
    actions: (close) => [
      h('button', { class: 'btn btn--ghost', onclick: close }, 'Cancel'),
      h(
        'button',
        {
          class: 'btn btn--primary',
          onclick: async () => {
            const next = input.value.trim();
            if (!next) return;
            close();
            await onSubmit(next);
          },
        },
        confirmLabel,
      ),
    ],
  });
}
