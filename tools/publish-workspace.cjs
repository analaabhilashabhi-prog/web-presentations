/**
 * Torii's Workspace — the photo spread.
 *
 *   node tools/publish-workspace.cjs [--dry]
 *
 * Needs the app server, restarted after the schema change this depends on
 * (`photo-spread` in BLOCK_TYPES and its case in `normalizeBlock`) — without
 * the restart the store holds the old normaliser, every field is dropped and
 * the row publishes as an empty paragraph. Backs `db.json` up first.
 *
 * WHAT IT DOES
 * ------------
 *   Finds the Workspace row (`tools/create-workspace-row.cjs` made it) and
 *   writes its one block: the thirteen photographs from the user's
 *   `Downloads/TORII/classroom`, filed under `uploads/Workspace/`, laid out as
 *   the spread the user's reference image shows. The row's title, icon and
 *   place in the deck are not touched here.
 *
 * THE PHOTOGRAPHS, AND WHAT WAS DONE TO EACH
 * ------------------------------------------
 *   Five are 8192x5464 camera originals at 12–16MB apiece; they are re-encoded
 *   through the canvas to 2000px wide (`crop-image.cjs --max-width 2000`), a
 *   little over twice the widest slot, because the same file opens full size in
 *   the viewer. Two arrived as finished social cards with the Nagarjuna and the
 *   AI Centre of Excellence lockups burned into a header band; the band is cut
 *   (`--top 225`) so the page's own type carries the message, which is the
 *   deck's rule about posters. The rest are copied as they are. Every one is
 *   renamed by what it shows, because a slot is chosen for a photograph by its
 *   shape and its subject and `1 (3).jpeg` says neither.
 *
 *   THE BUILDING OPENS IN THE MIDDLE — "use the infrastructure one main photo".
 *   It is a square render with the building across its middle band, so in the
 *   16:9 slot it is framed on the building (`focus: 'center 58%'`), sky and
 *   road giving way first. The other twelve are dealt into the twelve slots by
 *   shape: the tall slots take pictures with an upright subject and a focus on
 *   it, the landscape slots the wide hall shots.
 *
 * THE WORDS
 * ---------
 *   The reference carries four handwritten notes on a timeline and three lines
 *   of copy. NONE OF THAT WAS SUPPLIED. The notes and the copy below are
 *   written from the photographs and from nothing else — what is visibly in
 *   them: a projector at the front, a laptop on every desk, two screens over
 *   the rows, a trainer between them, a wall lettered with Claude, a building
 *   with TORII on it. No count, no date, no time of day (the reference's
 *   "Sat. 8:12 a.m." has no equivalent here, and one would be invented). The
 *   tagline is the one in the Torii lockup on the building and on every
 *   photograph in this deck. REPLACE ALL OF IT when the user's words arrive;
 *   `NOTES` and `COPY` are the two places.
 */
const fs = require('fs');
const path = require('path');
const http = require('http');

const ROOT = path.resolve(__dirname, '..');
const DB = path.join(ROOT, 'backend/data/db.json');
const BACKUPS = path.join(ROOT, 'backend/data/backups');
const UPLOADS = path.join(ROOT, 'backend/uploads');
const HOST = { host: '127.0.0.1', port: Number(process.env.PORT) || 4173 };
const DRY = process.argv.includes('--dry');
const ORG = 'torii';
const KEY = 'workspace';
const BASE = 'Workspace';

/* Written from the photographs. Replace with the user's own. */
const NOTES = [
  { label: '01 · The building', text: 'Torii, from the road.' },
  { label: '02 · The lecture hall', text: 'A projector at the front, a laptop on every desk.' },
  { label: '03 · The training floor', text: 'Two screens over the rows, a trainer between them.' },
  { label: '04 · The AI Centre of Excellence', text: 'A wall lettered with Claude.' },
];
/* One paragraph, wrapped by the column — a hand-placed break landed mid-clause
   and put the copy on three uneven lines. */
/* Two lines in the 1060px column at 20px, measured; a word longer put "Claude."
   alone on a third. */
const COPY = 'Where Torii teaches. A hall with a projector at the front and a laptop on every desk; a training floor with two screens over the rows and a trainer between them; the AI Centre of Excellence, its wall lettered with Claude.';

/* Order is layout: [0] opens in the middle, then the twelve slots in the order
   `PhotoSpread.js` lists them — left three, bottom left, then across the right
   cluster. `focus` is an object-position: where the subject is, so the slot's
   crop keeps it. */
const PHOTOS = [
  { src: 'building.jpg',      w: 1080, h: 1080, focus: 'center 58%' },  // the middle
  { src: 'lab-girls.jpg',     w: 2000, h: 1334, focus: '42% 45%' },     // far left, tall
  { src: 'coe-wall.jpg',      w: 1080, h: 855,  focus: '48% 45%' },     // small square over the edge
  { src: 'hall-screen.jpg',   w: 2000, h: 1334, focus: '50% 50%' },     // landscape under it
  { src: 'floor-wide.jpg',    w: 1280, h: 960,  focus: '50% 58%' },     // bottom left
  { src: 'lab-boys.jpg',      w: 2000, h: 1334, focus: '52% 45%' },     // tall over the right edge
  { src: 'floor-desks-1.jpg', w: 1280, h: 960,  focus: '36% 58%' },     // right, top row
  { src: 'floor-mic.jpg',     w: 1280, h: 960,  focus: '54% 58%' },
  { src: 'coe-visit.jpg',     w: 1080, h: 855,  focus: '46% 62%' },     // second row
  { src: 'floor-screens.jpg', w: 1280, h: 960,  focus: '50% 48%' },
  { src: 'hall-behind.jpg',   w: 2000, h: 1334, focus: '56% 50%' },     // big, cut by the right edge
  { src: 'floor-desks-2.jpg', w: 1280, h: 960,  focus: '38% 58%' },     // portrait, low
  { src: 'hall-rows.jpg',     w: 2000, h: 1334, focus: '50% 45%' },     // landscape, low
];

/* NO WORDS ON THE SLIDE (2026-09-21, on request: "remove all this stuff… I
   just want the photographs"). The timeline notes, the copy, the mark and the
   badge were built to the reference and then taken off; the schema still
   accepts `notes`, `copy`, `logo`, `badge` and `tagline`, and the component
   no longer draws any of them, so nothing is sent. `NOTES` and `COPY` above
   are kept only as the record of what was written and from what. */
const BLOCK = {
  type: 'photo-spread',
  layout: { x: 0, y: 0, w: 12, h: 15 },
  title: 'Workspace',
  base: BASE,
  photos: PHOTOS,
  /* The Torii wordmark under the spread ("in the down i want torii logo") —
     the SAME file the navigation pane's head draws, `organizations[torii]
     .logoAssetId`, so the deck says its own name one way. A path under
     /uploads, not an asset id, the way the newer blocks carry theirs. */
  logo: 'torii-wordmark-de8205d983b44fd5.svg',
  logoAlt: 'Torii',
};

function request(method, p, body, cookie) {
  return new Promise((resolve, reject) => {
    const payload = body ? JSON.stringify(body) : null;
    const headers = {};
    if (payload) {
      headers['content-type'] = 'application/json';
      headers['content-length'] = Buffer.byteLength(payload);
    }
    if (cookie) headers.cookie = `op_session=${cookie}`;
    const req = http.request({ ...HOST, path: p, method, headers }, (res) => {
      let b = '';
      res.on('data', (d) => { b += d; });
      res.on('end', () => {
        if (res.statusCode >= 400) return reject(new Error(`${method} ${p} -> ${res.statusCode} ${b.slice(0, 300)}`));
        let json = null;
        try { json = JSON.parse(b); } catch { /* 204 */ }
        resolve({ json, setCookie: (res.headers['set-cookie'] || []).join(';') });
      });
    });
    req.on('error', reject);
    if (payload) req.write(payload);
    req.end();
  });
}

/* JPEG dimensions off the file's own SOF marker — the stored `w`/`h` have to be
   the file's, and a table typed by hand drifts from the disk. */
function jpegSize(file) {
  const b = fs.readFileSync(file);
  let i = 2;
  while (i < b.length) {
    if (b[i] !== 0xFF) { i += 1; continue; }
    const m = b[i + 1];
    if (m >= 0xC0 && m <= 0xCF && m !== 0xC4 && m !== 0xC8 && m !== 0xCC) {
      return { h: b.readUInt16BE(i + 5), w: b.readUInt16BE(i + 7), whole: b[b.length - 2] === 0xFF && b[b.length - 1] === 0xD9 };
    }
    i += 2 + b.readUInt16BE(i + 2);
  }
  return null;
}

(async () => {
  /* Every file on disk, whole, with the case it is stored under — a wrong case
     is a missing picture on Linux and nothing at all warns on Windows. */
  const dir = path.join(UPLOADS, BASE);
  const onDisk = fs.readdirSync(dir);
  for (const p of PHOTOS) {
    if (!onDisk.includes(p.src)) throw new Error(`not on disk (or wrong case): uploads/${BASE}/${p.src}`);
    const s = jpegSize(path.join(dir, p.src));
    if (!s) throw new Error(`not a JPEG: ${p.src}`);
    if (!s.whole) throw new Error(`truncated file: ${p.src}`);
    if (s.w !== p.w || s.h !== p.h) {
      console.log(`  size      ${p.src}: table said ${p.w}x${p.h}, file is ${s.w}x${s.h} — file wins`);
      p.w = s.w; p.h = s.h;
    }
  }
  console.log(`  photos    ${PHOTOS.length} on disk, whole, sizes checked`);
  console.log(`  middle    ${PHOTOS[0].src}`);
  console.log(`  slots     ${PHOTOS.slice(1).map((p) => p.src.replace('.jpg', '')).join(' · ')}`);
  console.log('  words     none — the slide is the photographs');

  if (DRY) { console.log('\n  dry run — nothing written'); return; }

  fs.mkdirSync(BACKUPS, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const saved = path.join(BACKUPS, `db-before-workspace-${stamp}.json`);
  fs.copyFileSync(DB, saved);
  JSON.parse(fs.readFileSync(saved, 'utf8'));
  console.log(`  backup    backend/data/backups/${path.basename(saved)}`);

  const admin = (await request('POST', '/api/auth/login', {
    email: process.env.ADMIN_EMAIL || 'Torii@123.com',
    password: process.env.ADMIN_PASSWORD || 'Admin@123',
  })).setCookie.match(/op_session=([^;]+)/)[1];

  const rows = (await request('GET', `/api/orgs/${ORG}/sections`, null, admin)).json.sections.filter((s) => !s.parentId);
  const row = rows.find((s) => s.key === KEY);
  if (!row) throw new Error(`no ${KEY} row — run tools/create-workspace-row.cjs first`);

  await request('PATCH', `/api/sections/${row.id}`, { blocks: [BLOCK] }, admin);
  console.log(`  updated   ${row.id}`);

  /* Read back through the API — the normaliser is the authority on what stuck. */
  const back = (await request('GET', `/api/orgs/${ORG}/sections`, null, admin)).json.sections.find((s) => s.id === row.id);
  const got = back.blocks[0] || {};
  console.log('');
  console.log(`  read back  type    ${got.type}${got.type === 'photo-spread' ? '' : '  !! NORMALISED AWAY — server not restarted?'}`);
  console.log(`             photos  ${(got.photos || []).length}   mark ${got.logo || '!! NONE'}   words ${(got.notes || []).length || got.copy || got.badge || got.tagline ? '!! some still stored' : 'none'}`);
})().catch((e) => { console.error('  ERROR ' + e.message); process.exitCode = 1; });
