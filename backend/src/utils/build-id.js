import { createHash } from 'node:crypto';
import { promises as fsp } from 'node:fs';
import path from 'node:path';
import { PUBLIC_DIR, FRONTEND_SRC_DIR } from '../config/paths.js';

/**
 * A fingerprint of the frontend the server is currently serving.
 *
 * This exists because of a failure mode that looks exactly like a broken
 * deploy. The portal is a single page: the browser loads its ES modules once,
 * and every click after that is a hash change. Hash changes do not re-execute
 * modules. So a tab left open across a deploy keeps running the old code
 * forever — the new section returns its data perfectly and the old renderer,
 * which has never heard of that block type, draws "This section is blank".
 * No cache header can fix that; the browser was never asked for the file again.
 *
 * The id is a hash of the *contents* of every frontend file, not their mtimes.
 * A redeploy of identical code must produce an identical id, or every restart
 * on the host would kick presenters out of their slide for nothing.
 */

const HASHED = /\.(js|css|html)$/;

async function walk(dir, out = []) {
  let entries;
  try {
    entries = await fsp.readdir(dir, { withFileTypes: true });
  } catch {
    return out; // A missing directory simply contributes nothing.
  }
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) await walk(full, out);
    else if (HASHED.test(entry.name)) out.push(full);
  }
  return out;
}

let cached = null;

export async function buildId() {
  if (cached) return cached;
  const files = [
    ...(await walk(FRONTEND_SRC_DIR)),
    ...(await walk(PUBLIC_DIR)),
  ].sort(); // Directory order is not guaranteed; the hash must not depend on it.

  const hash = createHash('sha256');
  for (const file of files) {
    hash.update(path.basename(file));
    hash.update(await fsp.readFile(file));
  }
  cached = hash.digest('hex').slice(0, 16);
  return cached;
}
