/**
 * Where media is served from.
 *
 * Stored paths are relative — "/uploads/Programs/owl.png" — and stay that way,
 * because content that hardcodes a hostname has to be rewritten every time the
 * hosting changes and cannot be presented offline at all. The prefix is applied
 * here, at the point of use.
 *
 * The value arrives on window from /config.js, which the server writes from
 * MEDIA_BASE_URL. Unset, this returns the path untouched and the Node process
 * serves the file itself, exactly as it does in development.
 */
const BASE = String(window.__MEDIA_BASE__ || '').replace(/\/+$/, '');

/**
 * @param {string} p a stored path, with or without a leading slash
 * @returns {string} the same path, prefixed when a CDN is configured
 */
export function media(p) {
  const raw = String(p ?? '');
  if (!raw) return '';
  // Already absolute, or a data URI: nothing to prefix.
  if (/^(https?:)?\/\//i.test(raw) || raw.startsWith('data:')) return raw;
  const path = raw.startsWith('/') ? raw : `/${raw}`;
  // Only /uploads is on the CDN; the app's own files are served by the app.
  if (!path.startsWith('/uploads/')) return path;
  return BASE ? BASE + path : path;
}

/** The same, for a path already known to be relative to /uploads. */
export const upload = (p) => media(`/uploads/${String(p ?? '').replace(/^\/+/, '')}`);
