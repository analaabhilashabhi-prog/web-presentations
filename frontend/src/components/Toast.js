import { h } from '../utils/dom.js';

const host = () => document.getElementById('toast-host');

export function toast(message, variant = 'info', timeout = 3800) {
  const node = h('div', { class: `toast toast--${variant}`, role: 'status' }, message);
  host().append(node);
  setTimeout(() => {
    node.style.transition = 'opacity .2s ease, transform .2s ease';
    node.style.opacity = '0';
    node.style.transform = 'translateY(8px)';
    setTimeout(() => node.remove(), 220);
  }, timeout);
  return node;
}

export const toastSuccess = (message) => toast(message, 'success');
export const toastError = (message) => toast(message, 'error', 5200);
