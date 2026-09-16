import { promises as fsp, createReadStream } from 'node:fs';
import path from 'node:path';
import { PUBLIC_DIR, FRONTEND_SRC_DIR, UPLOADS_DIR } from '../config/paths.js';

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.bmp': 'image/bmp',
  '.tif': 'image/tiff',
  '.tiff': 'image/tiff',
  '.avif': 'image/avif',
  '.psd': 'image/vnd.adobe.photoshop',
  '.mp4': 'video/mp4',
  '.m4v': 'video/x-m4v',
  '.webm': 'video/webm',
  '.ogv': 'video/ogg',
  '.mov': 'video/quicktime',
  '.avi': 'video/x-msvideo',
  '.mkv': 'video/x-matroska',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.woff': 'font/woff',
  '.ttf': 'font/ttf',
  '.txt': 'text/plain; charset=utf-8',
};

const RANGE_TYPES = /^(video|audio)\//;

// Longest prefix wins, so '/src' is checked before the '/' catch-all.
const MOUNTS = [
  { prefix: '/uploads', dir: UPLOADS_DIR, cache: 'public, max-age=3600' },
  { prefix: '/src', dir: FRONTEND_SRC_DIR, cache: 'no-cache' },
  { prefix: '/', dir: PUBLIC_DIR, cache: 'no-cache' },
];

function resolveTarget(pathname) {
  for (const mount of MOUNTS) {
    if (mount.prefix !== '/' && !pathname.startsWith(`${mount.prefix}/`)) continue;
    const relative = mount.prefix === '/' ? pathname.slice(1) : pathname.slice(mount.prefix.length + 1);
    const decoded = decodeURIComponent(relative || 'index.html');
    const filePath = path.resolve(mount.dir, decoded.endsWith('/') ? `${decoded}index.html` : decoded);
    // Reject anything that escapes the mount root.
    if (filePath !== mount.dir && !filePath.startsWith(mount.dir + path.sep)) return null;
    return { filePath, cache: mount.cache };
  }
  return null;
}

export async function serveStatic(req, res, pathname) {
  if (req.method !== 'GET' && req.method !== 'HEAD') return false;
  if (pathname.startsWith('/api/')) return false;

  let target = resolveTarget(pathname === '/' ? '/index.html' : pathname);
  if (!target) return false;

  let stat = await fsp.stat(target.filePath).catch(() => null);

  // Single-page app: unknown non-file paths fall back to the shell.
  if ((!stat || stat.isDirectory()) && !path.extname(target.filePath)) {
    target = { filePath: path.join(PUBLIC_DIR, 'index.html'), cache: 'no-cache' };
    stat = await fsp.stat(target.filePath).catch(() => null);
  }
  if (!stat || !stat.isFile()) return false;

  const type = MIME[path.extname(target.filePath).toLowerCase()] || 'application/octet-stream';
  const seekable = RANGE_TYPES.test(type);

  // Byte-range replies let the browser seek and scrub video instead of
  // buffering the whole file before it can play.
  const rangeHeader = seekable ? req.headers.range : null;
  if (rangeHeader) {
    const match = /^bytes=(\d*)-(\d*)$/.exec(rangeHeader.trim());
    if (match) {
      let start = match[1] === '' ? null : Number(match[1]);
      let end = match[2] === '' ? null : Number(match[2]);
      if (start === null && end !== null) {
        start = Math.max(0, stat.size - end);
        end = stat.size - 1;
      } else {
        start = start ?? 0;
        end = end === null ? stat.size - 1 : Math.min(end, stat.size - 1);
      }
      if (start > end || start >= stat.size) {
        res.writeHead(416, { 'Content-Range': `bytes */${stat.size}` });
        res.end();
        return true;
      }
      res.writeHead(206, {
        'Content-Type': type,
        'Content-Length': end - start + 1,
        'Content-Range': `bytes ${start}-${end}/${stat.size}`,
        'Accept-Ranges': 'bytes',
        'Cache-Control': target.cache,
      });
      if (req.method === 'HEAD') {
        res.end();
        return true;
      }
      createReadStream(target.filePath, { start, end }).pipe(res);
      return true;
    }
  }

  res.writeHead(200, {
    'Content-Type': type,
    'Content-Length': stat.size,
    'Cache-Control': target.cache,
    ...(seekable ? { 'Accept-Ranges': 'bytes' } : {}),
  });
  if (req.method === 'HEAD') {
    res.end();
    return true;
  }
  createReadStream(target.filePath).pipe(res);
  return true;
}
