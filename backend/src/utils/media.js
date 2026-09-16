import { spawnSync } from 'node:child_process';
import { logger } from './logger.js';
import { env } from '../config/env.js';

/**
 * Video transcoding. ffmpeg is optional: when present, non-web-safe uploads
 * (MOV, AVI, MKV) are converted to MP4/H.264 with a poster frame. When absent
 * the file is stored and served as-is and the asset is flagged so the admin UI
 * can say so plainly, rather than silently shipping something that won't play.
 */
export const WEB_SAFE_VIDEO = new Set(['video/mp4', 'video/webm', 'video/ogg']);

let cached = null;

export function ffmpegInfo() {
  if (cached) return cached;
  const candidates = [env.ffmpegPath, 'ffmpeg'].filter(Boolean);
  for (const bin of candidates) {
    const probe = spawnSync(bin, ['-version'], { encoding: 'utf8' });
    if (!probe.error && probe.status === 0) {
      const version = (probe.stdout || '').split('\n')[0].trim();
      cached = { available: true, bin, version };
      return cached;
    }
  }
  cached = { available: false, bin: null, version: null };
  return cached;
}

export function logMediaCapabilities() {
  const info = ffmpegInfo();
  if (info.available) logger.info(`ffmpeg found (${info.version}) — video transcoding enabled`);
  else logger.warn('ffmpeg not found — videos are stored as uploaded (MP4/WEBM play natively; MOV/AVI/MKV may not)');
}

function run(args, timeoutMs = 10 * 60 * 1000) {
  const { bin } = ffmpegInfo();
  const result = spawnSync(bin, args, { encoding: 'utf8', timeout: timeoutMs, maxBuffer: 1 << 26 });
  if (result.error) return { ok: false, message: result.error.message };
  if (result.status !== 0) {
    const stderr = (result.stderr || '').split('\n').filter(Boolean).slice(-3).join(' ');
    return { ok: false, message: stderr || `ffmpeg exited with ${result.status}` };
  }
  return { ok: true };
}

/** Re-encode to MP4/H.264 + AAC, web-optimised (moov atom at the front). */
export function transcodeToMp4(inputPath, outputPath) {
  if (!ffmpegInfo().available) return { ok: false, skipped: true, message: 'ffmpeg not installed' };
  return run([
    '-y', '-i', inputPath,
    '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '23',
    '-pix_fmt', 'yuv420p',
    '-vf', 'scale=trunc(iw/2)*2:trunc(ih/2)*2',
    '-c:a', 'aac', '-b:a', '160k',
    '-movflags', '+faststart',
    outputPath,
  ]);
}

/** Grab a single frame for use as the <video> poster. */
export function extractPoster(inputPath, outputPath, atSeconds = 1) {
  if (!ffmpegInfo().available) return { ok: false, skipped: true };
  return run(['-y', '-ss', String(atSeconds), '-i', inputPath, '-frames:v', '1', '-q:v', '3', outputPath], 60_000);
}
