import { promises as fsp } from 'node:fs';
import path from 'node:path';
import * as assetModel from '../models/asset.model.js';
import { UPLOADS_DIR, SEED_UPLOADS_DIR, ORIGINALS_DIR } from '../config/paths.js';
import { env } from '../config/env.js';
import { HttpError } from '../utils/http.js';
import { newId, slugify } from '../utils/id.js';
import { decodePsdComposite, isPsd } from '../utils/psd.js';
import { encodePng } from '../utils/png.js';
import { WEB_SAFE_VIDEO, transcodeToMp4, extractPoster, ffmpegInfo } from '../utils/media.js';
import { logger } from '../utils/logger.js';

const IMAGE_TYPES = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/webp': 'webp',
  'image/gif': 'gif',
  'image/svg+xml': 'svg',
  'image/bmp': 'bmp',
  'image/tiff': 'tiff',
  'image/avif': 'avif',
  'image/vnd.adobe.photoshop': 'psd',
  'application/x-photoshop': 'psd',
  'image/psd': 'psd',
};

const VIDEO_TYPES = {
  'video/mp4': 'mp4',
  'video/webm': 'webm',
  'video/ogg': 'ogv',
  'video/quicktime': 'mov',
  'video/x-msvideo': 'avi',
  'video/x-matroska': 'mkv',
  'video/x-m4v': 'm4v',
  'video/mpeg': 'mpg',
  'video/3gpp': '3gp',
};

const EXT_FALLBACK = {
  psd: 'image/vnd.adobe.photoshop',
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  webp: 'image/webp',
  gif: 'image/gif',
  svg: 'image/svg+xml',
  bmp: 'image/bmp',
  tif: 'image/tiff',
  tiff: 'image/tiff',
  avif: 'image/avif',
  mp4: 'video/mp4',
  webm: 'video/webm',
  ogv: 'video/ogg',
  mov: 'video/quicktime',
  avi: 'video/x-msvideo',
  mkv: 'video/x-matroska',
  m4v: 'video/x-m4v',
  mpg: 'video/mpeg',
  '3gp': 'video/3gpp',
};

/* Stored paths stay relative — "/uploads/x.jpg" — and are prefixed on the way
   out. Rewriting the store would make the content depend on where it happens to
   be hosted, and would have to be undone to work offline again. */
const mediaUrl = (u) => (u && env.mediaBaseUrl && u.startsWith('/uploads/')
  ? env.mediaBaseUrl + u
  : u);

export function publicAsset(asset) {
  if (!asset) return null;
  return {
    id: asset.id,
    url: mediaUrl(asset.url),
    name: asset.name,
    mime: asset.mime,
    kind: asset.kind || 'image',
    width: asset.width ?? null,
    height: asset.height ?? null,
    posterUrl: mediaUrl(asset.posterUrl) || null,
    originalUrl: asset.originalUrl || null,
    converted: Boolean(asset.converted),
    note: asset.note || null,
  };
}

export function list() {
  return assetModel.all().map(publicAsset);
}

export function resolveMany(ids = []) {
  return assetModel.byIds(ids).map(publicAsset);
}

export function capabilities() {
  const info = ffmpegInfo();
  return {
    transcoding: info.available,
    ffmpegVersion: info.version,
    maxImageMb: Math.round(env.maxUploadBytes / 1024 / 1024),
    maxVideoMb: Math.round(env.maxVideoBytes / 1024 / 1024),
    imageFormats: ['PNG', 'JPG', 'JPEG', 'WEBP', 'GIF', 'SVG', 'BMP', 'TIFF', 'AVIF', 'PSD'],
    videoFormats: ['MP4', 'WEBM', 'MOV', 'AVI', 'MKV', 'OGV'],
  };
}

/** Best-effort type resolution: trust the extension over a vague browser MIME. */
function classify(name, mime) {
  const ext = path.parse(String(name || '')).ext.replace('.', '').toLowerCase();
  const declared = String(mime || '').toLowerCase().split(';')[0];
  const resolved = IMAGE_TYPES[declared] || VIDEO_TYPES[declared] ? declared : EXT_FALLBACK[ext] || declared;

  if (IMAGE_TYPES[resolved]) return { kind: 'image', mime: resolved, ext: IMAGE_TYPES[resolved] };
  if (VIDEO_TYPES[resolved]) return { kind: 'video', mime: resolved, ext: VIDEO_TYPES[resolved] };
  throw new HttpError(
    415,
    `Unsupported file type: ${mime || ext || 'unknown'}. Images: PNG, JPG, WEBP, GIF, SVG, BMP, TIFF, AVIF, PSD. Video: MP4, WEBM, MOV, AVI, MKV.`,
  );
}

/** PNG signature check so a converted PSD can report real dimensions. */
function readPngSize(buffer) {
  if (buffer.length > 24 && buffer.toString('ascii', 1, 4) === 'PNG') {
    return { width: buffer.readUInt32BE(16), height: buffer.readUInt32BE(20) };
  }
  return { width: null, height: null };
}

async function writeFile(dir, filename, bytes) {
  await fsp.mkdir(dir, { recursive: true });
  await fsp.writeFile(path.join(dir, filename), bytes);
}

/**
 * Single ingest path for every upload, whether it arrived as a data URL or as
 * a raw binary stream.
 */
export async function ingest({ name, mime, bytes }) {
  if (!bytes?.length) throw new HttpError(400, 'Uploaded file is empty');

  const { kind, mime: resolvedMime, ext } = classify(name, mime);
  const limit = kind === 'video' ? env.maxVideoBytes : env.maxUploadBytes;
  if (bytes.length > limit) {
    throw new HttpError(413, `${kind === 'video' ? 'Video' : 'Image'} is larger than ${Math.round(limit / 1024 / 1024)}MB`);
  }

  const id = newId('ast');
  const stem = `${slugify(path.parse(String(name || kind)).name, kind)}-${id.slice(4)}`;

  const record = {
    id,
    name: String(name || `${stem}.${ext}`),
    kind,
    mime: resolvedMime,
    size: bytes.length,
    createdAt: new Date().toISOString(),
  };

  if (kind === 'image') {
    const looksPsd = ext === 'psd' || isPsd(bytes);
    if (looksPsd) {
      // Browsers cannot render PSD: keep the original, display a PNG.
      await writeFile(ORIGINALS_DIR, `${stem}.psd`, bytes);
      record.originalUrl = `/uploads/originals/${stem}.psd`;
      try {
        const composite = decodePsdComposite(bytes);
        const png = encodePng(composite);
        await writeFile(UPLOADS_DIR, `${stem}.png`, png);
        Object.assign(record, {
          url: `/uploads/${stem}.png`,
          mime: 'image/png',
          converted: true,
          width: composite.width,
          height: composite.height,
          note: 'Converted from PSD for browser display. The original PSD is kept.',
        });
      } catch (err) {
        logger.warn(`PSD conversion failed for ${record.name}: ${err.message}`);
        throw new HttpError(
          422,
          `Could not convert this PSD (${err.message}). Flatten it in Photoshop and re-save with "Maximize Compatibility" enabled, or export a PNG.`,
        );
      }
    } else {
      await writeFile(UPLOADS_DIR, `${stem}.${ext}`, bytes);
      record.url = `/uploads/${stem}.${ext}`;
      if (ext === 'png') Object.assign(record, readPngSize(bytes));
    }
    return publicAsset(await assetModel.insert(record));
  }

  // ---------------------------------------------------------------- video
  const webSafe = WEB_SAFE_VIDEO.has(resolvedMime);
  const sourceName = `${stem}.${ext}`;
  const targetDir = webSafe ? UPLOADS_DIR : ORIGINALS_DIR;
  await writeFile(targetDir, sourceName, bytes);
  const sourcePath = path.join(targetDir, sourceName);

  if (webSafe) {
    record.url = `/uploads/${sourceName}`;
  } else {
    record.originalUrl = `/uploads/originals/${sourceName}`;
    const outputName = `${stem}.mp4`;
    const result = transcodeToMp4(sourcePath, path.join(UPLOADS_DIR, outputName));
    if (result.ok) {
      Object.assign(record, {
        url: `/uploads/${outputName}`,
        mime: 'video/mp4',
        converted: true,
        note: `Transcoded from ${ext.toUpperCase()} to MP4 for reliable playback.`,
      });
      record.size = (await fsp.stat(path.join(UPLOADS_DIR, outputName))).size;
    } else {
      // No ffmpeg (or it failed): serve the upload and be explicit about it.
      await writeFile(UPLOADS_DIR, sourceName, bytes);
      Object.assign(record, {
        url: `/uploads/${sourceName}`,
        note: result.skipped
          ? `Stored as ${ext.toUpperCase()} without conversion — ffmpeg is not installed on the server. H.264 files usually still play; if this one does not, install ffmpeg (or set FFMPEG_PATH) and re-upload.`
          : `Conversion failed (${result.message}). Stored as ${ext.toUpperCase()}; playback depends on the browser.`,
      });
    }
  }

  const posterName = `${stem}-poster.jpg`;
  const poster = extractPoster(sourcePath, path.join(UPLOADS_DIR, posterName));
  if (poster.ok) record.posterUrl = `/uploads/${posterName}`;

  return publicAsset(await assetModel.insert(record));
}

/** Data-URL ingest, kept for the JSON upload path. */
export async function saveDataUrl({ name, dataUrl }) {
  const match = /^data:([a-z0-9.+/-]*);base64,(.+)$/i.exec(String(dataUrl || ''));
  if (!match) throw new HttpError(400, 'File must be sent as a base64 data URL');
  return ingest({ name, mime: match[1], bytes: Buffer.from(match[2], 'base64') });
}

/** Used by the seeder to generate offline placeholder art. */
export async function saveSvg({ name, svg, width, height }) {
  const id = newId('ast');
  const filename = `${slugify(name, 'seed')}-${id.slice(4)}.svg`;
  await writeFile(SEED_UPLOADS_DIR, filename, Buffer.from(svg, 'utf8'));
  return assetModel.insert({
    id,
    name,
    kind: 'image',
    mime: 'image/svg+xml',
    size: Buffer.byteLength(svg),
    width,
    height,
    seeded: true,
    url: `/uploads/seed/${filename}`,
    createdAt: new Date().toISOString(),
  });
}
