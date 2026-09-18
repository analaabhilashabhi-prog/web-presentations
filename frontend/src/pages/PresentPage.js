import { h, render, append } from '../utils/dom.js';
import { state, isAdmin, visibleSections, deckSections, setSections } from '../context/appStore.js';
import { SideNav } from '../components/SideNav.js';
import { TopBar } from '../components/TopBar.js';
import { SlideView } from '../components/SlideView.js';
import { FitSlide } from '../components/FitSlide.js';
import { DeckControls } from '../components/DeckControls.js';
import { navigate, refresh } from '../utils/router.js';
import { useShortcuts } from '../hooks/useShortcuts.js';
import { reorderSections } from '../services/contentService.js';
import { toastError, toastSuccess } from '../components/Toast.js';
import { clearSteppers, stepSlide } from '../utils/slideSteps.js';

let disposeShortcuts = null;
/** True only while the whole deck is fullscreen — a video going fullscreen
 *  must not be mistaken for it, or exiting the video would re-render the page
 *  and lose the presenter's place. */
let deckFullscreen = false;

/**
 * The presentation view — the whole portal, in practice. Content is authored in
 * code, so this only navigates and presents; the draft/hidden badges are the one
 * thing an admin sees that a presenter does not.
 */
export function PresentPage(container, { org, section, onLogout }) {
  disposeShortcuts?.();

  const deck = state.presenting ? deckSections() : visibleSections();
  const index = deck.findIndex((item) => item.id === section?.id);

  // TWO MOVEMENTS, AND ONE OF THEM RUNS INTO THE OTHER (2026-09-17).
  //
  // `turn` changes section outright. `advance` is the forward/back gesture a
  // presenter actually makes: it offers the press to whatever the open slide
  // holds of its own — a course deck's courses, a timeline's years, the panels
  // of a leader's story — and only once that is spent does it turn the tab. So
  // pressing forward walks the first sub-tab, then the second, and the press
  // after the last one opens the next tab. Nothing has to be pressed twice and
  // nothing is a dead end.
  //
  // For one cut the arrows were made to stop at the end of a slide, so that the
  // dock was the only thing that could change tab. That was wrong in the room:
  // it made the last sub-tab a wall, and the presenter had to move a hand to the
  // dock to get past every slide that had any depth. The dock's two buttons
  // still change tab *immediately*, from wherever inside a slide you are — that
  // is what they are for, and it is the only way to skip the rest of a run.
  const turn = (delta) => {
    if (!deck.length) return;
    const next = deck[(Math.max(0, index) + delta + deck.length) % deck.length];
    navigate(`/o/${org.id}/${next.id}`);
  };

  const advance = (delta) => {
    if (stepSlide(delta)) return;
    turn(delta);
  };

  // Cleared before the slide is built, so the blocks constructed below are the
  // only ones registered. Stale steppers would hold a deck that had moved on.
  clearSteppers();

  const enterPresenting = async () => {
    state.presenting = true;
    document.body.classList.add('is-presenting');
    deckFullscreen = true;
    try {
      await document.documentElement.requestFullscreen?.();
    } catch {
      /* Fullscreen can be refused; the styled mode still applies. */
    }
    refresh();
  };

  const exitPresenting = async () => {
    state.presenting = false;
    deckFullscreen = false;
    document.body.classList.remove('is-presenting');
    if (document.fullscreenElement === document.documentElement) {
      await document.exitFullscreen?.().catch(() => {});
    }
    refresh();
  };

  disposeShortcuts = useShortcuts({
    /* the slide's own content first, then the next tab */
    ArrowRight: () => advance(1),
    ArrowLeft: () => advance(-1),
    Space: () => advance(1),
    /* A whole tab at a time, whatever the slide is showing. Four keys run the
       deck (2026-09-18, on request): left and right explore what is *in* a tab
       and spill into the next one when it is spent, up and down change tab
       outright from wherever you are. Page Up and Page Down do the same as up
       and down because a presenter's clicker sends those and not arrows. */
    ArrowDown: () => turn(1),
    ArrowUp: () => turn(-1),
    PageDown: () => turn(1),
    PageUp: () => turn(-1),
    Escape: () => state.presenting && exitPresenting(),
    f: () => (state.presenting ? exitPresenting() : enterPresenting()),
  });

  const onReorder = async (order) => {
    try {
      setSections(await reorderSections(org.id, order));
      toastSuccess('Section order saved');
      refresh();
    } catch (err) {
      toastError(err.message);
    }
  };

  const actions = [
    h(
      'button',
      {
        class: 'btn btn--ghost btn--sm',
        'data-tip': 'Previous tab',
        'aria-label': 'Previous tab',
        onclick: () => turn(-1),
      },
      '‹ Prev',
    ),
    h(
      'button',
      {
        class: 'btn btn--ghost btn--sm',
        'data-tip': 'Next tab',
        'aria-label': 'Next tab',
        onclick: () => turn(1),
      },
      'Next ›',
    ),
    h(
      'button',
      {
        class: 'btn btn--dark btn--sm',
        'data-tip': 'Present fullscreen',
        'aria-label': 'Present fullscreen',
        onclick: enterPresenting,
      },
      '▶ Present',
    ),
    /* NO SIGN OUT HERE (2026-09-17, on request). It used to sit in this row,
       immediately right of Present, on the reasoning that a presenter's hand is
       already there when they have finished — which is the same reason it was
       the easiest control in the deck to hit by mistake while reaching for
       Present, and being signed out in front of a room is not a recoverable
       slip. The control lives in the navigation pane's head instead, which is
       drawn whether the pane is open or collapsed to its rail, so nothing is
       stranded. */
  ];

  // The slide is scaled to the space available: a deck is paged, not scrolled.
  // While presenting it fills the display instead, so no screen shape leaves
  // bars down the sides.
  const stage = h(
    'div',
    { class: 'stage stage--fit' },
    FitSlide(SlideView(section, org, { showStatus: isAdmin() }), { fill: 'presenting' }),
  );

  const shell = h(
    'div',
    { class: 'shell shell--fit' },
    SideNav(org, section?.id, { onReorder, onLogout }),
    h(
      'div',
      { class: 'main' },
      TopBar({ org, section, actions }),
      stage,
    ),
  );

  render(container, shell);

  if (state.presenting) {
    append(
      container,
      DeckControls({
        index: Math.max(0, index),
        total: deck.length,
        // The running order itself, so the bar can name the two neighbours.
        deck,
        onPrev: () => turn(-1),
        onNext: () => turn(1),
        onExit: exitPresenting,
      }),
    );
  }

  // Leaving deck fullscreen with Esc/F11 must drop presentation mode too — but
  // a video exiting its own fullscreen must be ignored, so playback and the
  // presenter's scroll position are untouched.
  document.onfullscreenchange = () => {
    if (document.fullscreenElement) return;
    if (!deckFullscreen) return;
    deckFullscreen = false;
    if (!state.presenting) return;
    state.presenting = false;
    document.body.classList.remove('is-presenting');
    refresh();
  };
}
