/**
 * Animates a number from 0 to its target once the element scrolls into view.
 * Falls back to the final value when motion is reduced or IO is unavailable.
 */
import { formatNumber } from '../utils/format.js';

const prefersReducedMotion = () =>
  window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

export function useCountUp(el, target, { prefix = '', suffix = '', duration = 1100 } = {}) {
  const finalText = `${prefix}${formatNumber(target)}${suffix}`;

  if (prefersReducedMotion() || !window.IntersectionObserver) {
    el.textContent = finalText;
    return () => {};
  }

  el.textContent = `${prefix}0${suffix}`;
  let frame = null;

  const run = () => {
    const start = performance.now();
    const tick = (now) => {
      const progress = Math.min(1, (now - start) / duration);
      const eased = 1 - (1 - progress) ** 3;
      el.textContent = `${prefix}${formatNumber(Math.round(target * eased))}${suffix}`;
      if (progress < 1) frame = requestAnimationFrame(tick);
      else el.textContent = finalText;
    };
    frame = requestAnimationFrame(tick);
  };

  const observer = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        observer.disconnect();
        run();
      }
    },
    { threshold: 0.35 },
  );
  observer.observe(el);

  return () => {
    observer.disconnect();
    if (frame) cancelAnimationFrame(frame);
  };
}
