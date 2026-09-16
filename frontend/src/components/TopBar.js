import { h } from '../utils/dom.js';
import { isAdmin } from '../context/appStore.js';

/** Breadcrumbs plus the contextual actions for the current view. */
export function TopBar({ org, section, actions = [], crumbTail }) {
  return h(
    'header',
    { class: 'topbar' },
    h(
      'div',
      { class: 'topbar__crumbs' },
      h('span', {}, org?.name || 'Organization'),
      h('span', {}, '›'),
      h('strong', {}, crumbTail || section?.title || ''),
      isAdmin()
        ? h('span', { class: 'badge badge--accent' }, 'Admin')
        : h('span', { class: 'badge badge--live' }, 'Presenting'),
    ),
    h('div', { class: 'topbar__spacer' }),
    h('div', { class: 'topbar__actions' }, ...actions.filter(Boolean)),
  );
}
