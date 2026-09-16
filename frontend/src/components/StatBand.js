import { h } from '../utils/dom.js';
import { useCountUp } from '../hooks/useCountUp.js';

/** Animated stat counters, started when the band scrolls into view. */
export function StatBand(items = []) {
  const list = items.filter((item) => item && (item.label || item.value));
  if (!list.length) return null;

  return h(
    'div',
    { class: 'stat-band' },
    ...list.map((item) => {
      const value = h('div', { class: 'stat__value' }, '0');
      useCountUp(value, Number(item.value) || 0, {
        prefix: item.prefix || '',
        suffix: item.suffix || '',
      });
      return h(
        'div',
        { class: 'stat' },
        value,
        h('div', { class: 'stat__label' }, item.label || ''),
      );
    }),
  );
}
