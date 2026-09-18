/**
 * Rebuilds Campus Events as a filtered photo wall.
 *
 *   node tools/publish-events.cjs [--org technical-hub] [--dry]
 *
 * Needs the app server on 4173.
 *
 * WHAT CHANGES
 * ------------
 * The section held an `event-reel` block: six tabs — The Journey, Events &
 * Arenas, Programs, Centers of Excellence, The Team, Technical Hub AI — and 91
 * films, every one of them a YouTube id. There is no network at presentation
 * time, so none of them could play in the room; the posters come from i.ytimg.com
 * and fall back to type. Those tabs were not wanted, and are replaced by the
 * photographs from `Downloads/NGI/NGI/campus events`.
 *
 * It becomes a `placement-wall` — the same gallery Placements uses, which already
 * solves everything asked for here: justified rows that scale every picture by
 * its own aspect ratio and never crop, filter chips built from the group names,
 * the staggered fade-in, and a stage that scrolls. One chapter, so its tab rail
 * hides itself and the chips are the only control.
 *
 * `base: 'Events'` is what points the block at `uploads/Events/` instead of
 * `uploads/Placements/`.
 *
 * Torii and NCET keep their event-reel and their films.
 */
const fs = require('fs');
const path = require('path');
const http = require('http');

const ROOT = path.resolve(__dirname, '..');
const SRC = 'C:/Users/HP/Downloads/NGI/NGI/campus events/campus events';
const BASE = 'Events';
const DEST = path.join(ROOT, 'backend/uploads', BASE);
const DB = path.join(ROOT, 'backend/data/db.json');
const BACKUPS = path.join(ROOT, 'backend/data/backups');
const HOST = { host: '127.0.0.1', port: Number(process.env.PORT) || 4173 };

const arg = (n, d = null) => {
  const i = process.argv.indexOf(`--${n}`);
  return i > -1 && process.argv[i + 1] && !process.argv[i + 1].startsWith('--') ? process.argv[i + 1] : d;
};
const ORG = arg('org', 'technical-hub');
const DRY = process.argv.includes('--dry');

/* Folder on disk -> the name on its filter chip.
 *
 * Shortened by hand, and written out rather than derived. A chip carries the
 * name on one line and thirteen of them share the width of the slide, so
 * "A 3-Day Hands-on-Workshop on IOT & Embedded Systems by the Department of ECE"
 * cannot be a chip — at full length the chip row wrapped to five lines and took
 * the stage with it. Nothing here renames an event into something it was not:
 * each is the same event with the scaffolding words removed.
 */
const EVENTS = {
  'A 3-Day Hands-on-Workshop on IOT & Embedded Systems by the Department of ECE': 'IoT & Embedded Systems',
  'A 3-Day Hands-on-Workshop on VLSI Full Chip Development by the Department of ECE': 'VLSI Full Chip Development',
  'AI Pre-Summit held at NCET': 'AI Pre-Summit',
  'AICTE sponsored VAANI workshop': 'AICTE VAANI Workshop',
  'Awareness Programme on Pradhan Mantri Vikasit Bharath Rozgar Yojana': 'Vikasit Bharat Rozgar Yojana',
  'GCAT 2025- IEEE International Conference on': 'GCAT 2025 — IEEE',
  'Graduation Day': 'Graduation Day',
  'Inauguration of First Year Classes': 'First Year Inauguration',
  'Industrial Visit to ISRO – Master Control Facility': 'ISRO Industrial Visit',
  'Investors Awareness Programme': 'Investors Awareness',
  'Silver Jubilee Alumni Meet': 'Silver Jubilee Alumni Meet',
  'Smart India Hackathon 2025 hosted at NCET': 'Smart India Hackathon 2025',
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

/** Size plus a real completeness check — a truncated JPEG still reports a size. */
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
const login = async (email, password) => {
  const r = await request('POST', '/api/auth/login', { email, password });
  const t = /op_session=([^;]+)/.exec(r.setCookie)?.[1];
  if (!t) throw new Error('login returned no session cookie');
  return t;
};

(async () => {
  if (!fs.existsSync(SRC)) throw new Error(`source folder not found: ${SRC}`);

  const groups = [];
  const skipped = [];
  const unknown = [];
  let total = 0;
  let smallest = Infinity;

  for (const folder of fs.readdirSync(SRC).sort()) {
    const abs = path.join(SRC, folder);
    if (!fs.statSync(abs).isDirectory()) continue;
    const name = EVENTS[folder];
    if (!name) { unknown.push(folder); continue; }

    const dir = path.join(DEST, slug(name));
    if (!DRY) fs.mkdirSync(dir, { recursive: true });

    const images = [];
    for (const file of fs.readdirSync(abs).sort()) {
      const img = readImage(path.join(abs, file));
      if (img.skip) { skipped.push(`${folder}/${file}  (${img.skip})`); continue; }
      const out = `${String(images.length + 1).padStart(2, '0')}${img.ext}`;
      if (!DRY) fs.writeFileSync(path.join(dir, out), img.buf);
      /* Stored at the file's own pixel dimensions. The row solver derives every
         width from them, so a photograph is only ever scaled — never cropped. */
      images.push({ src: `${slug(name)}/${out}`, label: name, w: img.size.w, h: img.size.h });
      smallest = Math.min(smallest, img.size.w);
    }
    if (!images.length) continue;
    groups.push({ name, images });
    total += images.length;
    console.log(`  ${name.padEnd(30)} ${String(images.length).padStart(2)} photo(s)`);
  }

  console.log(`\n  ${groups.length} events, ${total} photographs${DRY ? '   (dry run — nothing written)' : ''}`);
  if (unknown.length) console.log(`  !! not in EVENTS, left out: ${unknown.join(', ')}`);
  skipped.forEach((x) => console.log(`     skipped ${x}`));
  console.log(`  narrowest photograph: ${smallest}px wide`);

  const block = {
    type: 'placement-wall',
    layout: { x: 0, y: 0, w: 12, h: 15 },
    base: BASE,
    allLabel: 'All events',
    eyebrow: 'Campus Life',
    title: 'Campus Events',
    lead: 'Workshops, conferences, visits and ceremonies — every photograph at its own proportions, filed by event.',
    chapters: [{
      key: 'events',
      name: 'Campus Events',
      blurb: '',
      // Photographs, not designed cards: `photo` is the row height that suits them.
      kind: 'photo',
      icon: 'event-sign',
      groups,
    }],
  };

  const db = JSON.parse(fs.readFileSync(DB, 'utf8'));
  const section = db.sections.find((s) => s.orgId === ORG && s.key === 'achievements');
  if (!section) throw new Error(`no events section in "${ORG}"`);
  const was = (section.blocks || [])[0];
  console.log(`\n  ${section.title}: ${was ? was.type : 'empty'} -> placement-wall`);
  if (was?.type === 'event-reel') {
    const films = (was.chapters || []).reduce((n, c) => n + (c.groups || []).reduce((m, g) => m + (g.films || []).length, 0), 0);
    console.log(`  replacing ${was.chapters.length} tab(s) and ${films} YouTube film(s): `
      + was.chapters.map((c) => c.name).join(', '));
  }

  if (DRY) return;

  fs.mkdirSync(BACKUPS, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const saved = path.join(BACKUPS, `db-before-events-${ORG}-${stamp}.json`);
  fs.copyFileSync(DB, saved);
  JSON.parse(fs.readFileSync(saved, 'utf8'));
  console.log(`  backup  ${path.relative(ROOT, saved)}`);

  const admin = await login((process.env.ADMIN_EMAIL || 'Torii@123.com'), (process.env.ADMIN_PASSWORD || 'Admin@123'));
  await request('PATCH', `/api/sections/${section.id}`, { blocks: [block] }, admin);

  const after = (await request('GET', `/api/sections/${section.id}`, null, admin)).json.section;
  const ch = after.blocks[0].chapters[0];
  console.log(`\n  stored: base=${after.blocks[0].base}  ${ch.groups.length} group(s)  `
    + `${ch.groups.reduce((n, g) => n + g.images.length, 0)} image(s)`);

  const missing = [];
  for (const g of ch.groups) for (const im of g.images) {
    if (!fs.existsSync(path.join(ROOT, 'backend/uploads', BASE, im.src))) missing.push(im.src);
  }
  console.log(missing.length ? `  !! ${missing.length} image(s) have no file: ${missing.slice(0, 4).join(', ')}`
    : '  every image resolves to a file on disk');
})().catch((e) => { console.error('  ERROR ' + e.message); process.exitCode = 1; });
