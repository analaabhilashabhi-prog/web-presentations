/**
 * Proximity magnification — the floating-dock effect, without the dependencies.
 *
 * Items swell as the pointer approaches and settle back as it leaves, each on
 * its own spring, so the row reads as something physical rather than as a set of
 * hover states firing one at a time.
 *
 * Two deliberate departures from the React original this is modelled on:
 *
 * It animates `transform`, not `width`. The original grows a square icon from
 * 40px to 80px, which reflows the row and shoves its neighbours aside — fine for
 * icons, wrong for a pill with words in it, where an animated width would squash
 * and re-wrap the text every frame. Scaling leaves layout untouched, so nothing
 * re-wraps and nothing reflows; the magnified item is lifted above its
 * neighbours with `z-index` instead of pushing them.
 *
 * The spring is exponential smoothing rather than a solved second-order system.
 * The original's constants — mass 0.1, stiffness 150, damping 12 — sit well past
 * critical damping (2·√(k·m) ≈ 7.75), so the motion has no overshoot to
 * reproduce. Smoothing toward the target gives the same shape and is
 * unconditionally stable, where explicit Euler on ω ≈ 39 rad/s would need a
 * frame budget this cannot guarantee.
 *
 * Pointer coordinates and getBoundingClientRect are both in viewport space, so
 * comparing them is safe even inside FitSlide's transform — which is why this
 * measures rects rather than offsets, the opposite of the rule for layout maths.
 */

const REDUCED = window.matchMedia?.('(prefers-reduced-motion: reduce)');

export function dockMagnify(container, options = {}) {
  const {
    selector = null,       // defaults to the container's element children
    radius = 150,          // px from an item's centre at which the effect dies
    amount = 0.24,         // peak extra scale
    lift = 4,              // px of rise at the peak
    rate = 15,             // how fast a value chases its target, per second
    transform = true,      // false leaves the transform entirely to CSS via --dock-k
  } = options;

  if (!container) return () => {};
  const nodes = selector
    ? [...container.querySelectorAll(selector)]
    : [...container.children];
  if (!nodes.length) return () => {};

  /* No motion means no magnification: the whole effect is the motion, and a
     static row of differently sized pills would just look misaligned. */
  if (REDUCED?.matches) return () => {};

  container.classList.add('is-dock');
  const state = nodes.map(() => ({ value: 0, target: 0 }));
  let pointer = null;
  let raf = 0;
  let last = 0;

  const retarget = () => {
    if (!pointer) {
      state.forEach((s) => { s.target = 0; });
      return;
    }
    nodes.forEach((node, i) => {
      const r = node.getBoundingClientRect();
      const dx = pointer.x - (r.left + r.width / 2);
      const dy = pointer.y - (r.top + r.height / 2);
      // Linear falloff, clamped — the same shape as the original's [-150,0,150].
      state[i].target = Math.max(0, 1 - Math.hypot(dx, dy) / radius);
    });
  };

  const frame = (now) => {
    const dt = last ? Math.min(0.05, (now - last) / 1000) : 1 / 60;
    last = now;
    retarget();

    let busy = false;
    const ease = 1 - Math.exp(-rate * dt);
    state.forEach((s, i) => {
      s.value += (s.target - s.value) * ease;
      if (Math.abs(s.target - s.value) > 0.002) busy = true;
      const k = s.value;
      if (k < 0.002) {
        nodes[i].style.removeProperty('--dock-k');
        nodes[i].style.transform = '';
        nodes[i].style.zIndex = '';
        nodes[i].classList.remove('is-near');
        return;
      }
      /* Published as a custom property so the stylesheet decides what proximity
         means. A horizontal rail wants the whole pill to swell; a vertical one
         cannot — a full-width row scaled up runs straight out of its column — so
         there it grows the logo and leans the row outward instead. Same signal,
         two treatments, no second implementation. */
      nodes[i].style.setProperty('--dock-k', k.toFixed(4));
      if (transform) {
        nodes[i].style.transform =
          `translateY(${(-lift * k).toFixed(2)}px) scale(${(1 + amount * k).toFixed(4)})`;
      }
      // Grown items sit over their neighbours rather than shoving them along.
      nodes[i].style.zIndex = String(10 + Math.round(k * 10));
      /* Only the ones genuinely under the pointer take the accent. Styling on
         "has a scale" instead lit the whole rail at once, because the falloff
         leaves every item very slightly scaled. */
      nodes[i].classList.toggle('is-near', k > 0.45);
    });

    if (busy || pointer) {
      raf = requestAnimationFrame(frame);
    } else {
      raf = 0;
      last = 0;
    }
  };

  const start = () => {
    if (!raf) { last = 0; raf = requestAnimationFrame(frame); }
  };
  const onMove = (event) => {
    pointer = { x: event.clientX, y: event.clientY };
    start();
  };
  const onLeave = () => { pointer = null; start(); };

  container.addEventListener('pointermove', onMove);
  container.addEventListener('pointerleave', onLeave);

  return () => {
    container.removeEventListener('pointermove', onMove);
    container.removeEventListener('pointerleave', onLeave);
    if (raf) cancelAnimationFrame(raf);
    container.classList.remove('is-dock');
    nodes.forEach((node) => {
      node.style.removeProperty('--dock-k');
      node.style.transform = '';
      node.style.zIndex = '';
      node.classList.remove('is-near');
    });
  };
}
