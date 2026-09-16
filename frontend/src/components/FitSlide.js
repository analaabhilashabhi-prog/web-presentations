import { h } from '../utils/dom.js';

/**
 * Fits a whole slide on the screen at once.
 *
 * A deck is paged, not scrolled — a presenter should never have to drag a
 * scrollbar in front of a room. The slide is laid out at a fixed nominal width
 * and then scaled uniformly to the space available, which is exactly how a
 * slide fits its frame in any presentation tool: nothing is cut off, nothing
 * reflows between screens, and a section looks the same on a laptop as it does
 * on a projector.
 */
export const NOMINAL_WIDTH = 1600;
/** 16:9 — the shape every section is arranged to fill. */
export const NOMINAL_HEIGHT = 900;

/**
 * `fill: 'presenting'` covers the display edge to edge instead of scaling the
 * slide as a fixed-size object, which letterboxes it whenever the screen shape
 * differs from the content's. Width still drives the scale, so type and spacing
 * stay identical between screens; only the height the blocks share changes.
 *
 * It is re-read on every fit rather than captured when the slide is built:
 * entering presentation mode resizes the frame, which refits, and that must work
 * even where the fullscreen request is refused and no re-render follows.
 */
const wantsFill = (fill) =>
  fill === true || (fill === 'presenting' && document.body.classList.contains('is-presenting'));

export function FitSlide(content, { nominalWidth = NOMINAL_WIDTH, fill = false } = {}) {
  const inner = h('div', { class: 'fit-slide__inner', style: { width: `${nominalWidth}px` } }, content);
  const frame = h('div', { class: 'fit-slide' }, inner);

  let raf = null;
  const fit = () => {
    // The space the slide may occupy is the frame's *content* box, so the gutter
    // has to come off the measurement — using the border box would overshoot by
    // exactly the padding and push that much of the slide past the edge. The
    // rect is used rather than clientWidth/clientHeight because it keeps its
    // fractional part, and a rounded-up pixel here is a pixel of the slide lost.
    const box = frame.getBoundingClientRect();
    const style = getComputedStyle(frame);
    const px = (value) => parseFloat(value) || 0;
    const insetX = px(style.paddingLeft) + px(style.paddingRight)
      + px(style.borderLeftWidth) + px(style.borderRightWidth);
    const insetY = px(style.paddingTop) + px(style.paddingBottom)
      + px(style.borderTopWidth) + px(style.borderBottomWidth);
    const availWidth = box.width - insetX;
    const availHeight = box.height - insetY;
    if (availWidth <= 0 || availHeight <= 0) return;

    // Filling: the nominal box takes the screen's aspect, so both axes land
    // exactly on the edges and there is nothing to letterbox. scrollHeight is a
    // layout value, so it ignores the transform we are about to apply and cannot
    // feed back into itself.
    // The measurement is always taken unstretched. Measuring a slide that has
    // already been given the screen's height would be reading back the answer
    // this is trying to decide, and on the frames before the grid settles that
    // reads long and the slide gives up filling for no reason.
    // Cleared alongside the height, and for the same reason. Sections whose
    // root needs a definite height read this to get the slide's, and measuring
    // while it is set would be measuring the answer this pass is about to give:
    // the height it produced last time feeds straight back into the decision and
    // the slide flips between filling and not on every resize. Cleared, every
    // pass measures the same baseline — each root's own fallback height.
    inner.style.height = '';
    inner.style.removeProperty('--slide-h');
    const contentHeight = inner.scrollHeight;
    if (!contentHeight) return;

    // A section arranged taller than the screen cannot fill it without losing the
    // bottom of itself, and losing content in front of a room is worse than a
    // margin — so only a section that already fits gets stretched to the edges.
    //
    // The slack matters: a section sized to the screen lands within a pixel of
    // the box, and an integer scrollHeight rounding up would otherwise drop it
    // out of filling for a fraction of a pixel. Anything inside this margin is
    // absorbed by the slide's own bottom gutter, so no content is at risk.
    const OVERFLOW_SLACK = 24;
    const screenShaped = Math.max(1, Math.round(nominalWidth * (availHeight / availWidth)));
    const filled = wantsFill(fill) && contentHeight <= screenShaped + OVERFLOW_SLACK;
    const natural = filled ? screenShaped : contentHeight;
    if (filled) {
      inner.style.height = `${screenShaped}px`;
      // The slide's height in its own nominal pixels, for the sections that
      // cannot use a percentage. `.canvas-block > *` sets `flex: 1`, and its
      // `flex-basis: 0%` beats `height` on the main axis, so those roots need a
      // definite length or they grow to their content and this decides against
      // filling. 860 was that length, and it is only correct on a 16:9 screen —
      // a 16:10 display makes the slide 1000 nominal rows and the section stopped
      // 140 short, which reads from the room as the page missing its bottom.
      // Only set when filling: an unfilled slide is its content's height, and a
      // section stretched past that would hang off the end of it.
      inner.style.setProperty('--slide-h', `${screenShaped}px`);
    }
    const scale = filled ? availWidth / nominalWidth : Math.min(availWidth / nominalWidth, availHeight / natural);
    frame.dataset.fill = String(filled);
    // Centre the slide ourselves rather than leaning on the frame's alignment.
    // The slide's layout box is the full nominal size, which is larger than the
    // frame, so the grid has nothing to centre it in and it sits at the content
    // corner; scaling about its own middle would then carry it off to one side.
    // Scaling from that corner and translating by the leftover space is exact at
    // any size.
    const offsetX = (availWidth - nominalWidth * scale) / 2;
    const offsetY = (availHeight - natural * scale) / 2;
    inner.style.transform = `translate(${offsetX}px, ${offsetY}px) scale(${scale})`;
    frame.dataset.scale = scale.toFixed(3);
    // Published for the same reason as the height. Anything that has to clear a
    // fixed-size chrome element — the deck bar is 83 real pixels whatever the
    // slide is scaled to — needs to convert real pixels into the slide's own,
    // and the slide's own are `scale` times smaller. A clearance written as a
    // flat nominal figure is only ever right at one screen size: 83 real pixels
    // is 69 nominal at scale 1.2 and 92 at scale 0.9, so a padding that clears
    // the bar on a 1920 display leaves the controls under it on a 1440 one.
    inner.style.setProperty('--slide-scale', scale.toFixed(4));
  };

  const schedule = () => {
    if (raf) cancelAnimationFrame(raf);
    raf = requestAnimationFrame(() => {
      raf = null;
      fit();
    });
  };

  /**
   * The blocks are still arriving when the first fit runs — entrance animations
   * are mid-flight and the KPI counters are counting, which measures as much as
   * 30px taller than the settled layout. That is the difference between a slide
   * deciding it fits the screen and deciding it does not, so the decision is
   * retaken a few times while the motion finishes. Bounded, so it always stops.
   */
  const settle = () => [140, 420, 1000].forEach((ms) => setTimeout(schedule, ms));

  // The frame changes size on window resize, on entering fullscreen and when
  // the side nav collapses at a breakpoint.
  if (window.ResizeObserver) new ResizeObserver(schedule).observe(frame);
  window.addEventListener('resize', schedule);

  // Entering or leaving presentation mode changes whether the slide fills the
  // display, and it is a class on <body> rather than a resize of this frame — so
  // without watching for it the first fit's answer would be the final one.
  if (fill === 'presenting' && window.MutationObserver) {
    new MutationObserver(() => {
      schedule();
      settle();
    }).observe(document.body, { attributes: true, attributeFilter: ['class'] });
  }

  // An image that has not decoded yet has no height, so refit as they arrive.
  requestAnimationFrame(() => {
    for (const image of inner.querySelectorAll('img')) {
      if (!image.complete) {
        image.addEventListener('load', schedule, { once: true });
        image.addEventListener('error', schedule, { once: true });
      }
    }
    document.fonts?.ready.then(schedule).catch(() => {});
    // Fit on this frame rather than scheduling another one: the slide must
    // never be painted at the wrong size, even for a single frame.
    fit();
    // The first pass runs before the block grid has settled at its final row
    // heights, so the fill/fit decision is confirmed as the motion finishes.
    settle();
  });

  return frame;
}
