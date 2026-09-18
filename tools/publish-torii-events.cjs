/**
 * Publishes Torii's Events as the wheel of albums.
 *
 *   node tools/publish-torii-events.cjs [--org torii] [--dry]
 *
 * Needs the app server on 4173. Nothing is copied or converted: the events and
 * their photographs are the ones the section already holds.
 *
 * THE SLIDE
 * ---------
 * Built to a reference the user supplied: a dark room, a great ring on the left
 * with one cover per event on its rim, the open event lit with its name on a
 * card, and the open album running down a column on the right. Wheel, arrows,
 * pills and a press on any cover turn the wheel one event at a time; the wheel
 * over the album, ↑ ↓ and its pill step one photograph at a time; a press on a
 * photograph opens it whole. Both scroll both ways. The reference's ring of
 * icons inside the wheel is left out on request.
 *
 * WHERE THE CONTENT COMES FROM
 * ----------------------------
 * The section's existing block — `event-orbit`, ten events and ninety-four
 * photographs grouped and sized already — is read as it stands and re-issued as
 * an `event-wheel`. Nothing is retyped, no order is changed. `uploads/Events/`
 * holds twelve more folders that this block never listed (they belong to the
 * other decks' Events); they are reported, not added.
 */
const fs = require('fs');
const path = require('path');
const http = require('http');

const ROOT = path.resolve(__dirname, '..');
const DB = path.join(ROOT, 'backend/data/db.json');
const BACKUPS = path.join(ROOT, 'backend/data/backups');
const HOST = { host: '127.0.0.1', port: Number(process.env.PORT) || 4173 };

const arg = (n, d = null) => {
  const i = process.argv.indexOf(`--${n}`);
  return i > -1 && process.argv[i + 1] && !process.argv[i + 1].startsWith('--') ? process.argv[i + 1] : d;
};
const ORG = arg('org', 'torii');
const KEY = 'achievements';   // the row titled "Events"
const DRY = process.argv.includes('--dry');

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
  const db = JSON.parse(fs.readFileSync(DB, 'utf8'));
  const section = db.sections.find((s) => s.orgId === ORG && s.key === KEY);
  if (!section) throw new Error(`no "${KEY}" section in "${ORG}"`);
  const was = (section.blocks || [])[0];
  /* The groups come from whatever event block stands there now — the orbit on
     the first run, this wheel on every run after. */
  const source = was && Array.isArray(was.groups) ? was : null;
  if (!source) throw new Error(`the section holds no grouped events to read (block: ${was ? was.type : 'none'})`);
  const base = source.base || 'Events';
  const uploads = path.join(ROOT, 'backend/uploads', base);

  const groups = source.groups
    .filter((g) => g && g.title && Array.isArray(g.images) && g.images.length)
    .map((g) => ({
      title: g.title,
      date: g.date || '',
      images: g.images.map((im) => ({ src: im.src, label: im.label || g.title, w: im.w, h: im.h })),
    }));
  groups.forEach((g, i) => console.log(`  ${String(i + 1).padStart(2)}  ${g.title.padEnd(32)} ${String(g.images.length).padStart(2)} photos  cover ${g.images[0].src}`));
  const total = groups.reduce((n, g) => n + g.images.length, 0);
  console.log(`\n  ${groups.length} events, ${total} photographs, read from the section's ${was.type}`);

  const listed = new Set(groups.flatMap((g) => g.images.map((im) => im.src.split('/')[0])));
  const folders = fs.existsSync(uploads) ? fs.readdirSync(uploads).filter((d) => fs.statSync(path.join(uploads, d)).isDirectory()) : [];
  const extra = folders.filter((d) => !listed.has(d));
  if (extra.length) console.log(`  (${extra.length} folder(s) under uploads/${base} are not in this deck's list and stay out: ${extra.join(', ')})`);
  const missing = groups.flatMap((g) => g.images).filter((im) => !fs.existsSync(path.join(uploads, im.src)));
  if (missing.length) console.log(`  !! ${missing.length} photograph(s) have no file: ${missing.slice(0, 5).map((m) => m.src).join(', ')}`);

  const block = {
    type: 'event-wheel',
    layout: { x: 0, y: 0, w: 12, h: 15 },
    base,
    eyebrow: 'Event',
    title: source.title || 'Events',
    groups,
  };

  console.log(`\n  ${ORG} / ${section.title}: ${was.type} -> event-wheel`);
  if (DRY) { console.log('  dry run — nothing written'); return; }

  fs.mkdirSync(BACKUPS, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const saved = path.join(BACKUPS, `db-before-events-${ORG}-${stamp}.json`);
  fs.copyFileSync(DB, saved);
  JSON.parse(fs.readFileSync(saved, 'utf8'));
  console.log(`  backup  backend/data/backups/${path.basename(saved)}`);

  const admin = (await request('POST', '/api/auth/login', { email: 'admin@org.local', password: 'Admin@123' }))
    .setCookie.match(/op_session=([^;]+)/)[1];
  await request('PATCH', `/api/sections/${section.id}`, { blocks: [block] }, admin);

  const stored = (await request('GET', `/api/sections/${section.id}`, null, admin)).json.section.blocks[0];
  const storedTotal = stored.groups.reduce((n, g) => n + g.images.length, 0);
  console.log(`\n  stored: ${stored.type}  ${stored.groups.length} events, ${storedTotal} photographs`);
  console.log(storedTotal === total ? '  every photograph survived the schema' : `  !! ${total - storedTotal} photograph(s) dropped by the schema`);
})().catch((e) => { console.error('  ERROR ' + e.message); process.exitCode = 1; });
