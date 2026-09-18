/**
 * Warms every picture in the deck while the first slide is on screen, so that
 * opening a tab never shows a photograph arriving.
 *
 * THE PROBLEM IT SOLVES
 * ---------------------
 * A tab's images are only requested when that tab is built, so the first visit
 * to Events fetched 94 photographs and the room watched them land. Nothing was
 * slow — the frame times were already at the display's limit — but a picture
 * appearing after the slide it belongs to reads as a page that is still
 * loading, and on a three-metre screen that is the whole impression.
 *
 * HOW IT WORKS
 * ------------
 * The server hands over a manifest of every image each section will ask for
 * (`/api/orgs/:id/media-manifest` — it has the blocks and the filesystem, which
 * the browser has neither of until it builds the tab). This walks that list in
 * the order a presenter will meet it, keeps every Image object alive so the
 * bytes stay in memory, and stops there: the browser decodes when the picture
 * is first drawn, which is fast once the bytes are local.
 *
 * FOUR THINGS THAT KEEP IT OUT OF THE WAY
 * ---------------------------------------
 *   - **The open tab is warmed first, then the deck in order.** Warming
 *     alphabetically or by file size would compete with the slide the room is
 *     actually looking at.
 *   - **`fetchPriority: 'low'`.** The browser then puts every one of these
 *     behind anything the current slide asks for, which is exactly the
 *     ordering wanted and costs nothing to declare.
 *   - **Six at a time, and the next batch waits for an idle moment.** The work
 *     is network and decode, neither on the main thread, but the `load` events
 *     are — 806 of them in a burst is a long task. Idle callbacks put them in
 *     the gaps between frames instead.
 *   - **It never blocks anything.** A failed image resolves like a loaded one:
 *     a preloader that retries or reports is a second failure mode for a
 *     picture that will fail again, visibly, when its slide is drawn.
 */
import { media } from './media.js';

const CONCURRENCY = 6;

/** url -> Image. Held for the life of the page: dropping the reference lets the
    browser evict the bytes, which is the one thing this exists to prevent. */
const held = new Map();
/** sectionId -> the urls that section needs, for reprioritising and for
    answering whether a tab is warm. */
const pending = new Map();

let queue = [];
let running = 0;
let started = false;
const state = { total: 0, done: 0, bytes: 0 };

const idle = (fn) => (typeof requestIdleCallback === 'function'
  ? requestIdleCallback(fn, { timeout: 300 })
  : setTimeout(fn, 16));

function loadOne(url) {
  if (held.has(url)) return Promise.resolve();
  return new Promise((resolve) => {
    const img = new Image();
    held.set(url, img);
    /* Behind everything the current slide wants. Not every browser honours it;
       where it is ignored the concurrency cap still holds the line. */
    try { img.fetchPriority = 'low'; } catch { /* older browsers */ }
    img.decoding = 'async';
    const settle = () => { state.done += 1; resolve(); };
    img.onload = settle;
    /* A broken file is not this module's problem to report — it will fail the
       same way when its slide draws it, where it can actually be seen. */
    img.onerror = settle;
    img.src = media(url);
  });
}

function pump() {
  while (running < CONCURRENCY && queue.length) {
    const job = queue.shift();
    running += 1;
    loadOne(job).then(() => {
      running -= 1;
      /* Between batches, not between images: an idle callback per file would
         spend longer scheduling than loading. */
      if (running === 0 || queue.length % CONCURRENCY === 0) idle(pump);
      else pump();
    });
  }
}

/**
 * Begins warming, or re-orders what is left so `firstSectionId` comes next.
 * Safe to call on every navigation — the work already done is never repeated.
 *
 * @param {string} orgId
 * @param {string|null} firstSectionId the tab on screen now
 * @param {string[]} order section ids in the order a presenter will meet them
 */
export async function warmDeck(orgId, firstSectionId, order = []) {
  if (started) return reprioritise(firstSectionId);
  started = true;
  let manifest;
  try {
    const res = await fetch(`/api/orgs/${encodeURIComponent(orgId)}/media-manifest`, {
      credentials: 'same-origin',
    });
    if (!res.ok) throw new Error(String(res.status));
    manifest = await res.json();
  } catch {
    /* No manifest, no preloading — every tab still loads its own pictures the
       way it always did. This is an improvement, never a dependency. */
    started = false;
    return;
  }

  const rows = new Map(manifest.sections.map((s) => [s.id, s.urls]));
  /* The deck's own order, with the open tab first; anything the caller did not
     list (a hidden row, a tab reached by direct link) follows, because it costs
     little and a presenter who opens one should not wait. */
  const ranked = [
    ...(firstSectionId && rows.has(firstSectionId) ? [firstSectionId] : []),
    ...order.filter((id) => id !== firstSectionId && rows.has(id)),
    ...[...rows.keys()].filter((id) => id !== firstSectionId && !order.includes(id)),
  ];

  const seen = new Set();
  for (const id of ranked) {
    const urls = (rows.get(id) || []).filter((u) => !seen.has(u) && (seen.add(u), true));
    queue.push(...urls);
    pending.set(id, rows.get(id) || []);
  }
  state.total = queue.length;
  state.bytes = manifest.bytes || 0;
  idle(pump);
}

/** Moves a section to the front of what has not been loaded yet. */
function reprioritise(sectionId) {
  const wanted = sectionId ? pending.get(sectionId) : null;
  if (!wanted || !wanted.length) return;
  const set = new Set(wanted);
  const front = queue.filter((u) => set.has(u));
  if (!front.length) return;
  queue = [...front, ...queue.filter((u) => !set.has(u))];
}

/** @returns {{total:number,done:number,bytes:number,ready:boolean}} */
export function progress() {
  return { ...state, ready: state.total > 0 && state.done >= state.total };
}

/** Whether every image that section will ask for is already in memory. */
export function isWarm(sectionId) {
  const urls = pending.get(sectionId);
  if (!urls) return false;
  return urls.every((u) => held.has(u));
}
