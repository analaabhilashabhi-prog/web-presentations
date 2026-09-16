import { h } from '../utils/dom.js';
import { useCountUp } from '../hooks/useCountUp.js';

/**
 * KPI cards — number, label, optional icon and note.
 *
 * The arrangement is the component's job, not the admin's: cards flow into a
 * responsive grid that keeps them equal-width at every viewport, so adding a
 * fourth KPI rebalances the row instead of breaking it.
 */
export function KpiGrid(block, { editing = false } = {}) {
  const items = (block.items || []).filter((item) => item && (item.label || item.value || item.icon));

  if (!items.length) {
    return editing
      ? h('div', { class: 'media-empty' },
          h('span', { class: 'media-empty__icon' }, '▦'),
          h('span', {}, 'No KPI cards yet — use Edit to add one'))
      : null;
  }

  const columns = block.columns && block.columns !== 'auto' ? Number(block.columns) : null;

  const grid = h('div', {
    class: `kpi-grid kpi-grid--${block.variant || 'card'}${columns ? ' kpi-grid--fixed' : ''}`,
    style: columns ? { '--kpi-columns': String(columns) } : {},
  });

  for (const item of items) {
    const value = h('div', { class: 'kpi__value' }, '0');
    useCountUp(value, Number(item.value) || 0, {
      prefix: item.prefix || '',
      suffix: item.suffix || '',
    });

    grid.append(
      h(
        'div',
        { class: 'kpi' },
        item.icon ? h('span', { class: 'kpi__icon' }, item.icon) : null,
        value,
        item.label ? h('div', { class: 'kpi__label' }, item.label) : null,
        item.note ? h('div', { class: 'kpi__note' }, item.note) : null,
      ),
    );
  }

  return grid;
}
