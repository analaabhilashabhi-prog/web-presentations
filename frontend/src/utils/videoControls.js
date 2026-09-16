import { h } from './dom.js';
import { icon } from './icons.js';

/**
 * Hover controls for any player in the deck — play/pause and skip either way.
 *
 * Two kinds of player exist here and they are driven completely differently:
 *
 *   A local <video> is direct. play(), pause(), currentTime.
 *
 *   A YouTube <iframe> is on another origin, so nothing about it can be read or
 *   called. It is driven by postMessage instead, which works without loading
 *   YouTube's API script — the deck ships no third-party JavaScript and is not
 *   about to start. Commands need `enablejsapi=1` on the embed URL; without it
 *   the frame ignores everything sent to it and the buttons do nothing at all.
 *
 * Skipping a YouTube video needs its current time, and there is no way to ask
 * for it — the frame only volunteers it, in `infoDelivery` messages, and only
 * after a `listening` handshake. So the position is tracked as it arrives and
 * skip seeks relative to the last figure seen. One window listener serves every
 * frame on the page, keyed by the frame's own window.
 *
 * Proven against a real film rather than assumed: driving the bar on a YouTube
 * embed moves the frame through states 3, 1, 2 — buffering, playing, paused —
 * and its reported clock stops advancing at the moment of the click.
 *
 * The controls are decoration over content that already exists, so they carry
 * aria-hidden on the wrapper and real labels on the buttons — a screen reader
 * gets the buttons, not the scaffolding.
 */

const SKIP = 10;

/* Last known position per YouTube frame. A WeakMap, so a frame that is removed
   from the page takes its entry with it rather than leaking. */
const ytClock = new WeakMap();
let listening = false;

function startListening() {
  if (listening) return;
  listening = true;
  window.addEventListener('message', (event) => {
    /* Only YouTube's own frames. Without this check any page in any frame could
       post a shape that looks like a time update. */
    let host = '';
    try { host = new URL(event.origin).hostname; } catch { return; }
    if (!/(^|\.)youtube(-nocookie)?\.com$/.test(host)) return;

    let data;
    try { data = typeof event.data === 'string' ? JSON.parse(event.data) : event.data; } catch { return; }
    const seconds = data?.info?.currentTime;
    if (typeof seconds === 'number' && event.source) ytClock.set(event.source, seconds);
  });
}

/** Ask a frame to start reporting its state. Harmless to repeat. */
function pokeYouTube(frame) {
  startListening();
  const send = () => frame.contentWindow?.postMessage(
    JSON.stringify({ event: 'listening', id: 1, channel: 'widget' }), '*',
  );
  send();
  frame.addEventListener('load', send);
}

function ytCommand(frame, func, args = []) {
  frame.contentWindow?.postMessage(
    JSON.stringify({ event: 'command', func, args }), '*',
  );
}

/**
 * Add `enablejsapi=1` to an embed URL. Exported because the components build
 * their own URLs, and a control bar over a frame that never enabled the API is
 * a row of buttons that quietly do nothing.
 */
export function withPlayerApi(params) {
  return /enablejsapi=/.test(params) ? params : `${params}&enablejsapi=1`;
}

/**
 * Build the control bar for one player.
 *
 * `player` is either a <video> or a YouTube <iframe>. Returns the overlay to
 * append beside it — the caller decides where, because only the caller knows
 * which element is the hover surface.
 */
export function videoControls(player, { skip = SKIP } = {}) {
  if (!player) return null;
  const isFrame = player.tagName === 'IFRAME';
  if (isFrame) pokeYouTube(player);

  /* Starts as "pause" because everything in this deck autoplays; a bar that
     opened on "play" would be lying about the state it is sitting on.
     And starts muted, because that is the only way anything autoplays at all —
     every browser refuses to start a film with sound until the viewer has asked
     for it. The sound button is that request; there is no setting that skips it. */
  let playing = true;
  let muted = true;

  const glyph = icon('pause', { class: 'ic ic--sm' });
  const toggle = h('button', {
    class: 'vc__btn vc__btn--main', type: 'button', 'aria-label': 'Pause',
    onclick: (e) => { e.stopPropagation(); setPlaying(!playing); },
  }, glyph);

  function paint() {
    toggle.replaceChildren(icon(playing ? 'pause' : 'play', { class: 'ic ic--sm' }));
    toggle.setAttribute('aria-label', playing ? 'Pause' : 'Play');
  }

  function setPlaying(next) {
    playing = next;
    if (isFrame) ytCommand(player, next ? 'playVideo' : 'pauseVideo');
    else if (next) { const go = player.play(); if (go?.catch) go.catch(() => {}); }
    else player.pause();
    paint();
  }

  function jump(by) {
    if (isFrame) {
      const at = ytClock.get(player.contentWindow) ?? 0;
      ytCommand(player, 'seekTo', [Math.max(0, at + by), true]);
      return;
    }
    // Clamped, or seeking past the end on a loop restarts it unexpectedly.
    const end = Number.isFinite(player.duration) ? player.duration : Infinity;
    player.currentTime = Math.min(Math.max(0, player.currentTime + by), end);
  }

  const sound = h('button', {
    class: 'vc__btn', type: 'button', 'aria-label': 'Unmute',
    onclick: (e) => { e.stopPropagation(); setMuted(!muted); },
  }, icon('volume-off', { class: 'ic ic--xs' }));

  function setMuted(next) {
    muted = next;
    if (isFrame) ytCommand(player, next ? 'mute' : 'unMute');
    else player.muted = next;
    sound.replaceChildren(icon(next ? 'volume-off' : 'volume', { class: 'ic ic--xs' }));
    sound.setAttribute('aria-label', next ? 'Unmute' : 'Mute');
    sound.classList.toggle('is-live', !next);
  }

  const step = (by, label, name) => h('button', {
    class: 'vc__btn', type: 'button', 'aria-label': label,
    onclick: (e) => { e.stopPropagation(); jump(by); },
  }, icon(name, { class: 'ic ic--xs' }), h('span', {}, String(skip)));

  /* A native <video> can be played or paused by something other than these
     buttons — a click on the element, the deck pausing it as a card leaves the
     front — so the glyph follows the element rather than only this bar. */
  if (!isFrame) {
    player.addEventListener('play', () => { playing = true; paint(); });
    player.addEventListener('pause', () => { playing = false; paint(); });
    // The element can be muted by something else too; the glyph follows it.
    player.addEventListener('volumechange', () => {
      if (player.muted !== muted) setMuted(player.muted);
    });
  }

  paint();
  return h('div', { class: 'vc', 'aria-hidden': 'false' },
    step(-skip, `Back ${skip} seconds`, 'rewind'),
    toggle,
    step(skip, `Forward ${skip} seconds`, 'forward'),
    sound,
  );
}
