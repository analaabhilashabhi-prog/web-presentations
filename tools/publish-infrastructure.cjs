/**
 * Builds NGI's Legacy & Infrastructure slide from the campus folders.
 *
 *   node tools/publish-infrastructure.cjs [--org technical-hub] [--dry]
 *
 * Needs the app server on 4173.
 *
 * WHAT IT MAKES
 * -------------
 * One `tilted-tiles` block, which is two states in one slide. It opens on a
 * tilted wall of drifting photographs with the section's name and a single
 * button held still in the middle; the button swaps in the filtered gallery —
 * the same justified wall Placements and Campus Events use — with a chip per
 * facility and a way back.
 *
 * So the block carries the photographs twice over: `tiles` for the wall, which
 * is a backdrop and repeats them to fill its columns, and `groups` for the
 * gallery, where each appears once, in its own facility.
 *
 * WHAT IT REPLACES
 * ----------------
 * The section holds a `milestone-timeline` — NGI's history, written by hand.
 * This replaces it, and `db.json` is backed up first. If the legacy half of
 * "Legacy & Infrastructure" is wanted back, it is in that backup verbatim.
 */
const fs = require('fs');
const path = require('path');
const http = require('http');

const ROOT = path.resolve(__dirname, '..');
const SRC = 'C:/Users/HP/Downloads/NGI/NGI/Campus Infrastructure';
const BASE = 'Infrastructure';
const DEST = path.join(ROOT, 'backend/uploads', BASE);
const DB = path.join(ROOT, 'backend/data/db.json');
const BACKUPS = path.join(ROOT, 'backend/data/backups');
const HOST = { host: '127.0.0.1', port: Number(process.env.PORT) || 4173 };

const arg = (n, d = null) => {
  const i = process.argv.indexOf(`--${n}`);
  return i > -1 && process.argv[i + 1] && !process.argv[i + 1].startsWith('--') ? process.argv[i + 1] : d;
};
const ORG = arg('org', 'technical-hub');
const KEY = 'history-milestones';
const DRY = process.argv.includes('--dry');

/* Folder on disk -> the name on its filter chip.
 *
 * Written out by hand rather than derived, the same way the events map is: a
 * chip carries its name on one line and twelve of them share the width of the
 * slide, so "Infrastructural Facilities Beautiful sprawling campus of 100
 * acres" cannot be one. Nothing here renames a facility into something it is
 * not — each is the same facility with the scaffolding words removed. The one
 * that loses anything is the solar plant, whose folder also names the street
 * lights and water heaters it runs; the chip keeps the subject.
 */
const FACILITIES = {
  'Banking Facility': 'Banking',
  'Creative Learning Center': 'Creative Learning Center',
  'Facilities': 'Facilities',
  'Food Courts Canteen Eat outs': 'Food Courts & Canteens',
  'Health Center': 'Health Center',
  'Hostels': 'Hostels',
  'Indoor Games': 'Indoor Games',
  'Infrastructural Facilities Beautiful sprawling campus of 100 acres': '100-Acre Campus',
  'Knowledge center': 'Knowledge Center',
  'Outdoor Games': 'Outdoor Games',
  'Roof Top Solar Power Plant, Street lights & Water heaters': 'Rooftop Solar',
  'Transport Facility': 'Transport',
};

const slug = (s) => String(s).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');

function jpegSize(b) {
  let o = 2;
  while (o < b.length) {
    if (b[o] !== 0xFF) { o++; continue; }
    const m = b[o + 1];
    if (m >= 0xC0 && m <= 0xCF && m !== 0xC4 && m !== 0xC8 && m !== 0xCC) {
      return { h: b.readUInt16BE(o + 5), w: b.readUInt16BE(o + 7) };
    }
    o += 2 + b.readUInt16BE(o + 2);
  }
  return null;
}
const pngSize = (b) => (b.length > 24 && b.toString('ascii', 12, 16) === 'IHDR'
  ? { w: b.readUInt32BE(16), h: b.readUInt32BE(20) } : null);

/** Size plus a real completeness check — a truncated file still reports a size. */
function readImage(abs) {
  const ext = path.extname(abs).toLowerCase();
  if (!['.jpg', '.jpeg', '.png', '.webp'].includes(ext)) return { skip: `${ext || 'no extension'} — not an image` };
  const buf = fs.readFileSync(abs);
  const size = ext === '.png' ? pngSize(buf) : jpegSize(buf);
  const tail = buf.slice(-8).toString('hex');
  const whole = ext === '.png' ? tail.includes('49454e44') : tail.endsWith('ffd9');
  if (!size) return { skip: 'unreadable' };
  if (!whole) return { skip: 'truncated' };
  return { buf, ext, size };
}

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
        let json = null; try { json = JSON.parse(b); } catch { /* 204 */ }
        resolve({ json, setCookie: (res.headers['set-cookie'] || []).join(';') });
      });
    });
    req.on('error', reject);
    if (payload) req.write(payload);
    req.end();
  });
}

(async () => {
  if (!fs.existsSync(SRC)) throw new Error(`source folder not found: ${SRC}`);

  const groups = [];
  const tiles = [];
  const skipped = [];
  const unknown = [];
  let smallest = Infinity;
  let total = 0;

  for (const folder of fs.readdirSync(SRC).sort()) {
    const abs = path.join(SRC, folder);
    if (!fs.statSync(abs).isDirectory()) continue;
    const name = FACILITIES[folder];
    if (!name) { unknown.push(folder); continue; }

    const dir = path.join(DEST, slug(name));
    if (!DRY) fs.mkdirSync(dir, { recursive: true });

    const images = [];
    for (const file of fs.readdirSync(abs).sort()) {
      const img = readImage(path.join(abs, file));
      if (img.skip) { skipped.push(`${folder}/${file}  (${img.skip})`); continue; }
      const out = `${String(images.length + 1).padStart(2, '0')}${img.ext}`;
      if (!DRY) fs.writeFileSync(path.join(dir, out), img.buf);
      const src = `${slug(name)}/${out}`;
      /* Stored at the file's own pixel dimensions. Both the wall's columns and
         the gallery's rows derive every width and height from them, so a
         photograph is only ever scaled — never cropped. */
      images.push({ src, label: name, w: img.size.w, h: img.size.h });
      tiles.push({ src, alt: name, w: img.size.w, h: img.size.h });
      smallest = Math.min(smallest, img.size.w);
      total++;
    }
    if (!images.length) continue;
    groups.push({ name, images });
    console.log(`  ${name.padEnd(24)} ${String(images.length).padStart(2)} photo(s)`);
  }

  console.log(`\n  ${groups.length} facilities, ${total} photographs${DRY ? '   (dry run — nothing written)' : ''}`);
  if (unknown.length) console.log(`  !! not in FACILITIES, left out: ${unknown.join(', ')}`);
  skipped.forEach((x) => console.log(`     skipped ${x}`));
  console.log(`  narrowest photograph: ${smallest}px wide`);

  const block = {
    type: 'tilted-tiles',
    layout: { x: 0, y: 0, w: 12, h: 15 },
    base: BASE,
    eyebrow: 'Nagarjuna Group of Institutions',
    title: 'Legacy & Infrastructure',
    /* The one line of prose here is the user's own, off the folder they filed
       the campus photographs under. Nothing about this campus is claimed that
       they have not already written down. */
    lead: 'A beautiful sprawling campus of 100 acres.',
    ctaLabel: 'See the infrastructure',
    backLabel: 'Back to the campus',
    allLabel: 'All facilities',
    tiles,
    groups,
  };

  const db = JSON.parse(fs.readFileSync(DB, 'utf8'));
  const section = db.sections.find((s) => s.orgId === ORG && s.key === KEY);
  if (!section) throw new Error(`no "${KEY}" section in "${ORG}"`);
  const was = (section.blocks || [])[0];
  console.log(`\n  ${ORG} / ${section.title}: ${was ? was.type : 'empty'} -> tilted-tiles`);
  if (was?.type === 'milestone-timeline') {
    const n = (was.milestones || was.items || was.entries || []).length;
    console.log(`  !! this replaces the hand-written history timeline${n ? ` (${n} milestones)` : ''}.`);
    console.log('     It is kept verbatim in the backup written below.');
  }
  if (DRY) return;

  fs.mkdirSync(BACKUPS, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const saved = path.join(BACKUPS, `db-before-infrastructure-${ORG}-${stamp}.json`);
  fs.copyFileSync(DB, saved);
  JSON.parse(fs.readFileSync(saved, 'utf8'));
  console.log(`  backup  backend/data/backups/${path.basename(saved)}`);

  const admin = (await request('POST', '/api/auth/login', { email: (process.env.ADMIN_EMAIL || 'Torii@123.com'), password: (process.env.ADMIN_PASSWORD || 'Admin@123') }))
    .setCookie.match(/op_session=([^;]+)/)[1];
  await request('PATCH', `/api/sections/${section.id}`, { blocks: [block] }, admin);

  const stored = (await request('GET', `/api/sections/${section.id}`, null, admin)).json.section.blocks[0];
  console.log(`\n  stored: ${stored.type}  base=${stored.base}  ${stored.tiles.length} wall tile(s)  `
    + `${stored.groups.length} group(s), ${stored.groups.reduce((n, g) => n + g.images.length, 0)} image(s)`);

  const missing = [];
  for (const g of stored.groups) for (const im of g.images) {
    if (!fs.existsSync(path.join(ROOT, 'backend/uploads', BASE, im.src))) missing.push(im.src);
  }
  console.log(missing.length ? `  !! ${missing.length} image(s) have no file: ${missing.slice(0, 4).join(', ')}`
    : '  every photograph resolves to a file on disk');

  for (const other of ['torii', 'ncet']) {
    const s = db.sections.find((x) => x.orgId === other && x.key === KEY);
    console.log(`  ${other.padEnd(14)} unchanged: ${JSON.stringify(s?.title)} — ${(s?.blocks || [])[0]?.type}`);
  }
})().catch((e) => { console.error('  ERROR ' + e.message); process.exitCode = 1; });
