import { state } from '../context/appStore.js';

/**
 * Notices when the server starts serving a newer frontend than the one this tab
 * is running, and reloads.
 *
 * The portal loads its modules once and then navigates by hash forever, so a
 * tab left open across a deploy keeps executing the old code with no hint that
 * it is doing so. The symptom is indistinguishable from a broken release: the
 * API returns a new block type correctly and the old renderer, which has never
 * heard of it, prints "This section is blank".
 *
 * Two rules keep the cure from being worse than the disease:
 *
 *   - Never reload mid-presentation. A slide vanishing in front of a room is
 *     far worse than a stale tab. The reload waits for the presenter to leave
 *     presentation mode.
 *   - Never reload on a failed check. Render's free tier sleeps and a cold
 *     start times out; a missing answer is not a new build.
 */

const POLL_MS = 60_000;

let known = null;      // the build this tab is running
let pending = false;   // a new build is out, waiting for a safe moment
let timer = null;

async function currentBuild() {
  const res = await fetch('/api/health', { cache: 'no-store', credentials: 'same-origin' });
  if (!res.ok) throw new Error(`health ${res.status}`);
  const body = await res.json();
  return body.build || null;
}

function reload() {
  // The hash survives a reload, so the presenter lands back on the same slide.
  window.location.reload();
}

async function check() {
  let build;
  try {
    build = await currentBuild();
  } catch {
    return; // Asleep, offline, or restarting — say nothing.
  }
  if (!build) return;            // An older server with no build id.
  if (known === null) { known = build; return; }
  if (build === known) return;

  if (state.presenting) { pending = true; return; }
  reload();
}

export function startBuildWatch() {
  check();
  timer = setInterval(check, POLL_MS);

  // Coming back to the tab is the moment a stale page is most likely to be
  // used — and it is exactly when the user has just deployed and switched over.
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') check();
  });
  window.addEventListener('focus', check);
  window.addEventListener('online', check);

  return () => clearInterval(timer);
}

/** Called when presentation mode ends, to apply a reload that was held back. */
export function flushPendingReload() {
  if (pending && !state.presenting) reload();
}
