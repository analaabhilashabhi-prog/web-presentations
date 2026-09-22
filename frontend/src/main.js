import { h, render } from './utils/dom.js';
import { startRouter, parseRoute, navigate } from './utils/router.js';
import { applyTheme } from './utils/theme.js';
import * as authService from './services/authService.js';
import {
  state,
  isAdmin,
  loadOrgs,
  loadSections,
  orgById,
  sectionByKeyOrId,
  visibleSections,
  deckSections,
  resetSession,
} from './context/appStore.js';
import { LoginPage } from './pages/LoginPage.js';
import { OrgSelectPage } from './pages/OrgSelectPage.js';
import { PresentPage } from './pages/PresentPage.js';
import { toastError } from './components/Toast.js';
import { confirmModal } from './components/Modal.js';
import { startBuildWatch, flushPendingReload } from './utils/buildWatch.js';
import { installTooltips } from './utils/tooltip.js';
import { warmDeck } from './utils/preload.js';

installTooltips();

const container = document.getElementById('app');

/**
 * Re-rendering the same view (after a save, a reorder, or leaving a video's
 * fullscreen) must not scroll the presenter back to the top.
 */
let lastRouteKey = null;

function withScrollKept(routeKey, paint) {
  const sameView = routeKey === lastRouteKey;
  const offset = sameView ? window.scrollY : 0;
  lastRouteKey = routeKey;
  const result = paint();
  if (sameView && offset) {
    requestAnimationFrame(() => window.scrollTo({ top: offset, behavior: 'auto' }));
  }
  return result;
}

function showMessage(text, actionLabel, onAction) {
  render(
    container,
    h(
      'div',
      { class: 'picker' },
      h(
        'div',
        { class: 'picker__head' },
        h('h1', {}, text),
        actionLabel
          ? h('button', { class: 'btn btn--primary', onclick: onAction }, actionLabel)
          : null,
      ),
    ),
  );
}

async function signOut() {
  try {
    await authService.logout();
  } catch {
    /* Signing out locally is enough if the request fails. */
  }
  resetSession();
  document.body.classList.remove('is-presenting');
  applyTheme(null);
  navigate('/login');
}

/* Asked first, because sign out is one click away from every screen and a
   mis-click mid-presentation drops the room back to the login page. */
function onLogout() {
  confirmModal({
    title: 'Sign out?',
    text: 'You will be returned to the login screen and will need to sign in again.',
    confirmLabel: 'Sign out',
    danger: true,
    onConfirm: signOut,
  });
}

async function route() {
  const target = parseRoute();

  // If a deploy landed while a slide was on screen, this is the safe moment to
  // pick it up — the presenter has navigated, not been interrupted.
  flushPendingReload();

  // Anything other than the login screen needs a session.
  if (!state.user) {
    try {
      const session = await authService.fetchSession();
      state.user = session.user;
      state.loginHint = session.loginHint;
      state.prefill = session.prefill || null;
    } catch (err) {
      toastError(err.message);
    }
  }

  if (!state.user) {
    if (target.name !== 'login') return navigate('/login', { replace: true });
    applyTheme(null);
    return LoginPage(container);
  }

  if (target.name === 'login') return navigate('/orgs', { replace: true });

  try {
    await loadOrgs();
  } catch (err) {
    return showMessage(err.message, 'Retry', () => route());
  }

  if (target.name === 'home' || target.name === 'orgs' || !target.orgId) {
    state.presenting = false;
    document.body.classList.remove('is-presenting');
    return OrgSelectPage(container, { onLogout });
  }

  const org = orgById(target.orgId);
  if (!org) return navigate('/orgs', { replace: true });
  applyTheme(org);

  try {
    await loadSections(org.id);
  } catch (err) {
    return showMessage(err.message, 'Back to organizations', () => navigate('/orgs'));
  }

  const sections = visibleSections();
  const section = target.sectionId ? sectionByKeyOrId(target.sectionId) : sections[0];

  /* Warm every picture in the deck in the background, the tab on screen first
     and then the order a presenter will walk. Started here rather than at login
     because this is the first point where the deck's own order is known. It
     returns immediately; nothing below waits on it, and a deck whose manifest
     cannot be fetched simply loads each tab's pictures the way it always did. */
  warmDeck(org.id, section?.id || null, deckSections().map((s) => s.id));

  // Nothing is authored in the browser, so these are dead ends that land back
  // on the section itself.
  if (target.name === 'edit' || target.name === 'settings') {
    return navigate(section ? `/o/${org.id}/${section.id}` : `/o/${org.id}`, { replace: true });
  }

  // Presenters may not deep-link to a draft or hidden tab.
  const allowed = section && (isAdmin() || (section.status === 'published' && !section.hidden));
  const resolved = allowed ? section : sections[0] || null;

  if (resolved && target.sectionId !== resolved.id) {
    return navigate(`/o/${org.id}/${resolved.id}`, { replace: true });
  }
  return withScrollKept(`present:${org.id}:${resolved?.id || ''}`, () =>
    PresentPage(container, { org, section: resolved, onLogout }),
  );
}

startBuildWatch();

startRouter(() => {
  route().catch((err) => {
    console.error(err);
    showMessage(err.message || 'Something went wrong', 'Reload', () => window.location.reload());
  });
});
