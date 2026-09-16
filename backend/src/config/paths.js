import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));

export const SRC_DIR = path.resolve(here, '..');
export const BACKEND_ROOT = path.resolve(SRC_DIR, '..');
export const PROJECT_ROOT = path.resolve(BACKEND_ROOT, '..');

export const DATA_DIR = path.join(BACKEND_ROOT, 'data');
export const DB_FILE = path.join(DATA_DIR, 'db.json');
export const UPLOADS_DIR = path.join(BACKEND_ROOT, 'uploads');
export const SEED_UPLOADS_DIR = path.join(UPLOADS_DIR, 'seed');
/** Untouched source files: PSDs and pre-transcode video. */
export const ORIGINALS_DIR = path.join(UPLOADS_DIR, 'originals');

export const FRONTEND_DIR = path.join(PROJECT_ROOT, 'frontend');
export const PUBLIC_DIR = path.join(FRONTEND_DIR, 'public');
export const FRONTEND_SRC_DIR = path.join(FRONTEND_DIR, 'src');

export function ensureDirs() {
  for (const dir of [DATA_DIR, UPLOADS_DIR, SEED_UPLOADS_DIR, ORIGINALS_DIR]) {
    fs.mkdirSync(dir, { recursive: true });
  }
}
