/**
 * Works out how to play a pasted video link.
 *
 * Direct file links play in a normal <video> element, exactly like an upload,
 * so they get the same fullscreen and back-to-presentation behaviour. Hosted
 * providers are played in an embed, which the same wrapper can take fullscreen.
 */
const FILE_EXTENSION = /\.(mp4|webm|ogv|ogg|m4v|mov)(\?.*)?$/i;

function safeUrl(raw) {
  const value = String(raw || '').trim();
  if (!value) return null;
  // Relative paths are ours (an uploaded file referenced by path).
  if (value.startsWith('/')) return { relative: true, href: value };
  try {
    const parsed = new URL(value);
    if (!['http:', 'https:'].includes(parsed.protocol)) return null;
    return { relative: false, href: parsed.href, parsed };
  } catch {
    return null;
  }
}

/**
 * @returns {null | {kind:'file'|'youtube'|'vimeo'|'drive', playbackUrl:string|null,
 *                   embedUrl:string|null, watchUrl:string, label:string}}
 */
export function parseVideoUrl(raw) {
  const safe = safeUrl(raw);
  if (!safe) return null;

  if (safe.relative) {
    return { kind: 'file', playbackUrl: safe.href, embedUrl: null, watchUrl: safe.href, label: 'Direct file' };
  }

  const { parsed, href } = safe;
  const host = parsed.hostname.replace(/^www\./, '').toLowerCase();

  // YouTube: watch?v=, youtu.be/ID, /embed/ID, /shorts/ID
  if (host === 'youtube.com' || host === 'm.youtube.com' || host === 'youtube-nocookie.com' || host === 'youtu.be') {
    let id = null;
    if (host === 'youtu.be') id = parsed.pathname.split('/').filter(Boolean)[0];
    else if (parsed.searchParams.get('v')) id = parsed.searchParams.get('v');
    else {
      const parts = parsed.pathname.split('/').filter(Boolean);
      const marker = parts.findIndex((p) => ['embed', 'shorts', 'live', 'v'].includes(p));
      if (marker !== -1) id = parts[marker + 1];
    }
    if (id && /^[\w-]{6,20}$/.test(id)) {
      const start = Number(parsed.searchParams.get('t') || parsed.searchParams.get('start') || 0) || 0;
      const query = new URLSearchParams({ rel: '0', modestbranding: '1', playsinline: '1', controls: '0', showinfo: '0', loop: '1', playlist: id });
      if (start) query.set('start', String(start));
      return {
        kind: 'youtube',
        playbackUrl: null,
        embedUrl: `https://www.youtube-nocookie.com/embed/${id}?${query}`,
        watchUrl: href,
        label: 'YouTube',
      };
    }
  }

  // Vimeo: vimeo.com/ID or player.vimeo.com/video/ID
  if (host === 'vimeo.com' || host === 'player.vimeo.com') {
    const id = parsed.pathname.split('/').filter(Boolean).find((part) => /^\d{6,12}$/.test(part));
    if (id) {
      return {
        kind: 'vimeo',
        playbackUrl: null,
        embedUrl: `https://player.vimeo.com/video/${id}`,
        watchUrl: href,
        label: 'Vimeo',
      };
    }
  }

  // Google Drive share links
  if (host === 'drive.google.com') {
    const match = /\/file\/d\/([\w-]+)/.exec(parsed.pathname) ||
      (parsed.searchParams.get('id') ? [null, parsed.searchParams.get('id')] : null);
    if (match?.[1]) {
      return {
        kind: 'drive',
        playbackUrl: null,
        embedUrl: `https://drive.google.com/file/d/${match[1]}/preview`,
        watchUrl: href,
        label: 'Google Drive',
      };
    }
  }

  if (FILE_EXTENSION.test(parsed.pathname)) {
    return { kind: 'file', playbackUrl: href, embedUrl: null, watchUrl: href, label: 'Direct file' };
  }

  return null;
}

export function describeVideoUrlSupport() {
  return 'Paste a direct video link (.mp4, .webm, .ogv, .mov) or a YouTube, Vimeo or Google Drive share link.';
}
