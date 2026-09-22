/**
 * Torii's Trusted By row — the institutions' marks as a fan of cards in depth.
 *
 *   node tools/publish-trusted-by.cjs [--dry]
 *
 * Needs the app server, restarted after the schema change this depends on
 * (`trust-fan` in BLOCK_TYPES and its case in `normalizeBlock`). Backs
 * `db.json` up first.
 *
 * WHAT IT DOES
 * ------------
 *   Creates the row if it is not there, rewrites its block, and puts it
 *   immediately after AI Partners — the row it is closest kin to. Run it twice
 *   and nothing is duplicated: the row is found by its key and PATCHed, and
 *   the tab order is rebuilt from the order AS IT STANDS, not from a list
 *   written here.
 *
 * THE MARKS, AND WHAT WAS DONE TO EACH
 * ------------------------------------
 *   Nine files from the user's `Downloads/TORII/partner logos`, filed under
 *   `uploads/TrustedBy/` and renamed by the institution each one names — a
 *   slot on this slide is a mark and the name under it, and `Vector Smart
 *   Object-3.png` says neither. Eight are copied as they are. `ngi.png` is a
 *   1080x1080 canvas with the mark in a band across its middle and clear
 *   everywhere else; contained in a 340x260 plate it would have been a sliver,
 *   so its ink was measured through the canvas and it is cut to the ink plus
 *   40px of air (`crop-image.cjs`), written to PNG so the transparency
 *   survives. Three (Geeta, SRKR, YCCE) arrive on a baked white ground with no
 *   alpha; the plate is white, so nothing shows.
 *
 * THE NAMES ARE THE MARKS' OWN. Every one of these logos prints the name of
 *   its institution, and that is what the card says — nothing shortened,
 *   nothing added. YCCE's prints both its initials and its full name; the
 *   card takes the full name, since a room does not know the initials. No
 *   line is written about what any of them is to Torii: `note` is in the
 *   schema for it and is left empty until the user says.
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
const KEY = 'trusted-by';
const TITLE = 'Trusted By';
const ICON = 'handshake-check';
/* The row this one goes after. A key is not a title on this deck; this one is. */
const AFTER = 'ai-partners';
const BASE = 'TrustedBy';

/* In the order they stand round the ring; THE FIRST OPENS AT THE FRONT. The
   user pointed at the scene they want the slide to open on (2026-09-21): YCCE
   in the middle, SRKR and Geeta to its left, NGI and its engineering college
   to its right. That is this ring with YCCE first — the same neighbours as
   before, since a ring has no start, only a card the row is opened on. */
const LOGOS = [
  { src: 'ycce.png',                                           name: 'Yeshwantrao Chavan College of Engineering' },
  { src: 'nagarjuna-group-of-institutions.png',                name: 'Nagarjuna Group of Institutions' },
  { src: 'nagarjuna-college-of-engineering-and-technology.png', name: 'Nagarjuna College of Engineering & Technology' },
  { src: 'nagarjuna-college-of-management-studies.png',        name: 'Nagarjuna College of Management Studies' },
  { src: 'nagarjuna-degree-college.png',                       name: 'Nagarjuna Degree College' },
  { src: 'nagarjuna-pre-university-college.png',               name: 'Nagarjuna Pre-University College' },
  { src: 'nagarjuna-vidyaniketan.png',                         name: 'Nagarjuna Vidyaniketan' },
  { src: 'geeta-university.png',                               name: 'Geeta University' },
  { src: 'srkr-engineering-college.png',                       name: 'SRKR Engineering College' },
];

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

/* PNG dimensions off the IHDR, and whether the file ends in IEND — a header
   intact enough to report a size does not prove a file is whole. */
function pngSize(file) {
  const b = fs.readFileSync(file);
  if (b.slice(1, 4).toString() !== 'PNG') return null;
  return { w: b.readUInt32BE(16), h: b.readUInt32BE(20), whole: b.slice(-8).toString('latin1').includes('IEND') };
}

(async () => {
  const dir = path.join(UPLOADS, BASE);
  const onDisk = fs.readdirSync(dir);
  for (const l of LOGOS) {
    if (!onDisk.includes(l.src)) throw new Error(`not on disk (or wrong case): uploads/${BASE}/${l.src}`);
    const s = pngSize(path.join(dir, l.src));
    if (!s) throw new Error(`not a PNG: ${l.src}`);
    if (!s.whole) throw new Error(`truncated: ${l.src}`);
    l.w = s.w; l.h = s.h;
  }
  console.log(`  marks     ${LOGOS.length} on disk, whole, case checked`);
  LOGOS.forEach((l, i) => console.log(`  ${String(i + 1).padStart(2, '0')}  ${l.name.padEnd(46)} ${l.src}  ${l.w}x${l.h}`));

  /* `countLabel` is the words after the figure under the fan; the figure
     itself is the length of LOGOS, computed by the component, never typed. The
     words are the user's own ("how many trusted partners"). */
  const BLOCK = { type: 'trust-fan', layout: { x: 0, y: 0, w: 12, h: 15 }, title: TITLE, base: BASE, logos: LOGOS, countLabel: 'trusted partners' };

  if (DRY) { console.log('\n  dry run — nothing written'); return; }

  fs.mkdirSync(BACKUPS, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const saved = path.join(BACKUPS, `db-before-trusted-by-${stamp}.json`);
  fs.copyFileSync(DB, saved);
  JSON.parse(fs.readFileSync(saved, 'utf8'));
  console.log(`  backup    backend/data/backups/${path.basename(saved)}`);

  const admin = (await request('POST', '/api/auth/login', {
    email: process.env.ADMIN_EMAIL || 'Torii@123.com',
    password: process.env.ADMIN_PASSWORD || 'Admin@123',
  })).setCookie.match(/op_session=([^;]+)/)[1];

  const rows = () => request('GET', `/api/orgs/${ORG}/sections`, null, admin)
    .then((r) => r.json.sections.filter((s) => !s.parentId).sort((a, b) => a.order - b.order));

  let all = await rows();
  let row = all.find((s) => s.key === KEY);
  if (!row) {
    row = (await request('POST', `/api/orgs/${ORG}/sections`, {
      key: KEY, title: TITLE, intro: '', iconKey: ICON, status: 'published', hidden: false, blocks: [BLOCK],
    }, admin)).json.section;
    console.log(`  created   ${row.id}`);
  } else {
    await request('PATCH', `/api/sections/${row.id}`, { title: TITLE, status: 'published', hidden: false, blocks: [BLOCK] }, admin);
    console.log(`  updated   ${row.id} (already existed — not duplicated)`);
  }

  /* The tab order, rebuilt from the order as it stands. */
  all = await rows();
  const anchor = all.find((s) => s.key === AFTER);
  if (!anchor) throw new Error(`no ${AFTER} row to sit after`);
  const rest = all.filter((s) => s.key !== KEY);
  const at = rest.findIndex((s) => s.key === AFTER) + 1;
  const ordered = [...rest.slice(0, at), all.find((s) => s.key === KEY), ...rest.slice(at)];
  await request('POST', `/api/orgs/${ORG}/sections/reorder`, { order: ordered.map((s) => s.id) }, admin);

  const back = await rows();
  const got = back.find((s) => s.key === KEY).blocks[0] || {};
  console.log('');
  console.log(`  read back  type   ${got.type}${got.type === 'trust-fan' ? '' : '  !! NORMALISED AWAY — server not restarted?'}`);
  console.log(`             marks  ${(got.logos || []).length}   named ${(got.logos || []).filter((l) => l.name).length}`);
  console.log(`  tab order  ${back.map((s) => s.title).join(' > ')}`);
})().catch((e) => { console.error('  ERROR ' + e.message); process.exitCode = 1; });
