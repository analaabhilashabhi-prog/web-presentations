/** Registers keyboard shortcuts and returns a disposer. */
/**
 * `exclusive` is for an overlay that must own the keyboard while it is up: the
 * handler runs in the capture phase and stops the event there, so a listener
 * bound to the same window in the bubbling phase — presenting's arrows and
 * Escape — never sees it. Without it, Escape in the viewer also left
 * presentation mode and an arrow in the viewer also turned the slide under it.
 */
export function useShortcuts(map, { target = window, exclusive = false } = {}) {
  const handler = (event) => {
    const tag = event.target?.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || event.target?.isContentEditable) {
      if (event.key !== 'Escape') return;
    }
    const key = event.key === ' ' ? 'Space' : event.key;
    const fn = map[key];
    if (!fn) return;
    event.preventDefault();
    if (exclusive) event.stopPropagation();
    fn(event);
  };
  target.addEventListener('keydown', handler, { capture: exclusive });
  return () => target.removeEventListener('keydown', handler, { capture: exclusive });
}
