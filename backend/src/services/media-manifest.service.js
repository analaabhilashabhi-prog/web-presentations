/**
 * Every image a deck will ask for, worked out before anybody opens a tab.
 *
 * WHY THIS IS ON THE SERVER
 * -------------------------
 * The browser cannot know a tab's pictures until it has built that tab, and
 * building one is the expensive thing we are trying to get ahead of — the
 * drift wall alone is 5,411 nodes. The server has both halves of the answer:
 * the stored blocks, and the filesystem to check a guess against. So it
 * resolves each stored reference to a real file and hands the client a list it
 * can warm in the background while the first slide is on screen.
 *
 * WHY A GUESS HAS TO BE CHECKED
 * -----------------------------
 * A stored path is not always a path from the uploads root. Most are, but a
 * wall stores its photographs relative to the block's own `base`, a centre of
 * excellence stores `snowflake.png` and the component prefixes `coe/`, and
 * `placement-wall` falls back to `Placements` in the component when no base is
 * stored. Rather than encode every component's habits here — which would rot
 * the moment one changed — each candidate is tried against the disk and the
 * first that exists wins. A reference that resolves nowhere is dropped: a
 * preloader that requests files which do not exist would turn a silent
 * non-problem into a screenful of 404s.
 *
 * FILMS ARE LEFT OUT ON PURPOSE. They are 57MB of the deck's 150 and they
 * stream — the browser fetches the first seconds and seeks for the rest, so
 * downloading them whole ahead of time costs minutes of bandwidth to save
 * nothing. Images are what flash in.
 */
import fs from 'node:fs';
import path from 'node:path';
import { UPLOADS_DIR } from '../config/paths.js';
import * as sectionService from './section.service.js';
import { data } from '../models/db.js';

const IMAGE = /\.(png|jpe?g|webp|gif|svg|avif)$/i;
const VIDEO = /\.(mp4|webm|mov|avi|mkv)$/i;

/* Prefixes a component is known to add to a bare stored name. Ordered, and
   only consulted after the plain path and the block's own base have failed. */
const PREFIXES = ['coe', 'certifications', 'coepics', 'platform-logos', 'platforms'];

let index = null;

/** Every file under uploads, once. Rebuilt when the directory's mtime moves. */
function fileIndex() {
  let stamp = 0;
  try { stamp = fs.statSync(UPLOADS_DIR).mtimeMs; } catch { /* no uploads yet */ }
  if (index && index.stamp === stamp) return index;

  const files = new Set();
  const walk = (dir, prefix) => {
    let entries = [];
    try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { return; }
    for (const entry of entries) {
      const rel = prefix ? `${prefix}/${entry.name}` : entry.name;
      /* Untouched sources — PSDs, pre-transcode video — are never served. */
      if (entry.isDirectory()) {
        if (rel === 'originals') continue;
        walk(path.join(dir, entry.name), rel);
      } else files.add(rel);
    }
  };
  walk(UPLOADS_DIR, '');
  index = { stamp, files };
  return index;
}

/** The real path for a stored reference, or null when nothing matches. */
function resolveRef(ref, base) {
  const raw = String(ref || '').replace(/^\/?uploads\//, '').replace(/^\/+/, '').split(/[#?]/)[0];
  if (!raw) return null;
  const { files } = fileIndex();
  const tries = [raw];
  if (base) tries.push(`${base}/${raw}`);
  for (const p of PREFIXES) tries.push(`${p}/${raw}`);
  for (const candidate of tries) if (files.has(candidate)) return candidate;
  return null;
}

/** Collects every image reference in one section's hydrated blocks. */
function fromSection(section, assetsById) {
  const found = new Set();
  const add = (ref, base) => {
    if (!ref || VIDEO.test(ref)) return;
    if (!IMAGE.test(String(ref).split(/[#?]/)[0])) return;
    const hit = resolveRef(ref, base);
    if (hit) found.add(`/uploads/${hit}`);
  };

  const walk = (node, base) => {
    if (typeof node === 'string') return add(node, base);
    if (Array.isArray(node)) return node.forEach((n) => walk(n, base));
    if (!node || typeof node !== 'object') return;
    for (const [key, value] of Object.entries(node)) {
      /* An asset carries its own served url and needs no resolving. */
      if (/assetId$/i.test(key) && typeof value === 'string') {
        const asset = assetsById.get(value);
        if (asset?.url && IMAGE.test(asset.url)) found.add(asset.url);
      } else if (/assetIds$/i.test(key) && Array.isArray(value)) {
        for (const id of value) {
          const asset = assetsById.get(id);
          if (asset?.url && IMAGE.test(asset.url)) found.add(asset.url);
        }
      }
      walk(value, base);
    }
  };

  for (const block of section.blocks || []) {
    /* `base` is a block field; placement-wall's component default is
       'Placements' (PlacementWall.js), so a block storing none still resolves
       against that folder and this has to agree with it. */
    const base = typeof block.base === 'string' && block.base
      ? block.base.replace(/^\/+|\/+$/g, '')
      : (block.type === 'placement-wall' ? 'Placements' : null);
    walk(block, base);
  }
  return [...found];
}

/**
 * @param {string} orgId
 * @param {string} role
 * @returns {{sections: Array<{id:string,key:string,title:string,order:number,urls:string[]}>, total:number, bytes:number}}
 */
export function manifestFor(orgId, role = 'presenter') {
  const sections = sectionService.listForRole(orgId, role);
  const assetsById = new Map((data().assets || []).map((a) => [a.id, a]));
  const seen = new Set();
  let bytes = 0;

  const out = sections
    .filter((s) => !s.parentId)
    .map((section) => ({
      id: section.id,
      key: section.key,
      title: section.title || '',
      order: section.order,
      urls: fromSection(section, assetsById),
    }));

  for (const row of out) {
    for (const url of row.urls) {
      if (seen.has(url)) continue;
      seen.add(url);
      try { bytes += fs.statSync(path.join(UPLOADS_DIR, url.replace(/^\/uploads\//, ''))).size; } catch { /* counted as 0 */ }
    }
  }
  return { sections: out, total: seen.size, bytes };
}
