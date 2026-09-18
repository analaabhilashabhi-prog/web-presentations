/**
 * "The pointer is on this" — but only while it is actually being used.
 *
 * Five slides stop their own motion while a pointer is over them, so that a
 * presenter pointing at a photograph does not have it walk out from under their
 * hand. Every one of them read that as `pointerenter` until `pointerleave`,
 * which is wrong in the one situation that matters most:
 *
 *   a presenter collapses the pane, presents, and drives the deck from the
 *   keyboard. The mouse is wherever they last left it, and on a three-metre
 *   screen that is almost certainly somewhere over the slide. Nothing moves it
 *   again for the rest of the talk, so `pointerleave` never fires and the slide
 *   they are standing in front of never moves either.
 *
 * So a hold is taken on pointer MOVEMENT and released by stillness: any move
 * holds, and `idle` milliseconds without one lets go. A hand resting on a desk
 * releases the slide; a hand actually pointing at something keeps it, because
 * pointing is never perfectly still. Leaving the element still releases at once
 * — that has not changed and is the ordinary case.
 *
 * `onRelease` is how a component whose loop has stopped starts it again. A loop
 * that is still running only needs to read `.held` each frame and can ignore it.
 *
 * @param {HTMLElement} el
 * @param {{ idle?: number, onRelease?: () => void }} [options]
 * @returns {{ held: boolean }} live — read `.held`, do not copy it
 */
export function pointerHold(el, { idle = 3000, onRelease } = {}) {
  const state = { held: false };
  let timer = 0;

  const release = () => {
    if (timer) { clearTimeout(timer); timer = 0; }
    if (!state.held) return;
    state.held = false;
    if (onRelease) onRelease();
  };

  const wake = () => {
    state.held = true;
    if (timer) clearTimeout(timer);
    timer = setTimeout(release, idle);
  };

  el.addEventListener('pointerenter', wake);
  el.addEventListener('pointermove', wake);
  el.addEventListener('pointerleave', release);
  /* A pointer that goes down and stays down is a drag, and a drag is being
     used even while it is still. */
  el.addEventListener('pointerdown', wake);

  return state;
}
