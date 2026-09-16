import { h, render, append } from '../utils/dom.js';
import { state, isAdmin, visibleSections, deckSections, setSections } from '../context/appStore.js';
import { SideNav } from '../components/SideNav.js';
import { TopBar } from '../components/TopBar.js';
import { icon } from '../utils/icons.js';
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

  // A slide may be more than one beat: a block that steps through content of its
  // own gets first refusal on the press, and the deck only turns once it is
  // spent. Same key, same button — the presenter learns one control.
  const go = (delta) => {
    if (stepSlide(delta)) return;
    if (!deck.length) return;
    const next = deck[(Math.max(0, index) + delta + deck.length) % deck.length];
    navigate(`/o/${org.id}/${next.id}`);
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
    ArrowRight: () => go(1),
    ArrowLeft: () => go(-1),
    Space: () => go(1),
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
        'data-tip': 'Previous section',
        'aria-label': 'Previous section',
        onclick: () => go(-1),
      },
      '‹ Prev',
    ),
    h(
      'button',
      {
        class: 'btn btn--ghost btn--sm',
        'data-tip': 'Next section',
        'aria-label': 'Next section',
        onclick: () => go(1),
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
    /* Beside Present, because that is where a presenter's hand already is when they
       have finished. The same control is in the navigation head; a presenter running
       the deck with the pane collapsed would otherwise have to open it to leave. */
    h(
      'button',
      {
        class: 'btn btn--ghost btn--sm btn--icon',
        'data-tip': 'Sign out',
        'aria-label': 'Sign out',
        onclick: onLogout,
      },
      icon('logout', { class: 'ic ic--sm' }),
    ),
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
        // The running order itself, so the bar can name the neighbours and jump.
        deck,
        onPrev: () => go(-1),
        onNext: () => go(1),
        onExit: exitPresenting,
        onJump: (target) => {
          if (target?.id && target.id !== section?.id) navigate(`/o/${org.id}/${target.id}`);
        },
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
