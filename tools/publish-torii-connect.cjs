/**
 * Publishes Torii Connect as the folder that opens into a bento wall.
 *
 *   node tools/publish-torii-connect.cjs [--org torii] [--dry]
 *
 * Needs the app server on 4173. Nothing is converted: the three photographs are
 * already PNGs at 465px and are used as they are.
 *
 * THE SLIDE
 * ---------
 * Built to a reference the user supplied: one big folder standing in the middle
 * of the frame, its cards peeking out of the mouth, and the folder's own name
 * and count on the pocket across the front. The button empties it — each
 * photograph flies out of the mouth and lands in a bento of deliberately
 * unequal tiles — and Back sends them home along the same path. The ground is
 * Torii's own two measured colours, drifting.
 *
 * THE ORDER IS THE COMPOSITION
 * ----------------------------
 * The bento for three is one large tile on the left and two stacked to its
 * right, so the first photograph here is the one that can carry the big tile.
 * That is the wide shot down the aisle; the two close shots take the smaller
 * tiles, where a crowd of faces still reads.
 *
 * THE FRAME CAME OFF THEM FIRST
 * -----------------------------
 * All three arrived as 465px exports with a black mat and a red rule burned
 * into them — a picture inside a picture, which in a bento reads as a mistake.
 * The photograph inside measured 387x278 at the same offsets in all three, and
 * `tools/crop-image.cjs` cut it out at 0.000% ratio drift. The framed originals
 * are kept beside them as `NN-framed.png`, the way the Snowflake card was.
 *
 * The crops are written under *new* names rather than over `01.png`: `/uploads`
 * is served `public, max-age=3600` with no validator, so a file replaced in
 * place keeps showing its old bytes in every browser that has already seen it,
 * for an hour. Changing the name changes the URL, and nothing can serve a stale
 * copy of it.
 *
 * THE NAMES ARE READ OFF THE PHOTOGRAPHS
 * --------------------------------------
 * Every name and line below is what is visible in the picture — the banners
 * over the stalls, the screens behind them, what the people in frame are doing.
 * No count of stalls or visitors is stated and nothing is claimed about the
 * event beyond what it shows. Replace them the moment the user's own words
 * arrive.
 */
const fs = require('fs');
const path = require('path');
const http = require('http');

const ROOT = path.resolve(__dirname, '..');
const BASE = 'Torii Connect';
const DEST = path.join(ROOT, 'backend/uploads', BASE);
const DB = path.join(ROOT, 'backend/data/db.json');
const BACKUPS = path.join(ROOT, 'backend/data/backups');
const HOST = { host: '127.0.0.1', port: Number(process.env.PORT) || 4173 };

const arg = (n, d = null) => {
  const i = process.argv.indexOf(`--${n}`);
  return i > -1 && process.argv[i + 1] && !process.argv[i + 1].startsWith('--') ? process.argv[i + 1] : d;
};
const ORG = arg('org', 'torii');
const KEY = 'torii-connect';
const DRY = process.argv.includes('--dry');

/* file -> [name, description, focus]  in composition order; see above. */
const PHOTOS = [
  ['aisle.png', 'The aisle',
    'The full run of stalls down one hall — Operating Systems, Torii Connect, Data Structures — each with its own banner and a group in front of it.',
    '50% 50%'],
  ['stalls.png', 'Data Structures & Java',
    'Two topic stalls side by side, each with its own screen and poster, and students packed at both counters.',
    '50% 45%'],
  ['myna.png', 'MYNA, explained',
    'A Torii trainer taking a group through the MYNA platform at its stall, the product board behind him.',
    '50% 45%'],
];

const pngSize = (b) => (b.length > 24 && b.toString('ascii', 12, 16) === 'IHDR'
  ? { w: b.readUInt32BE(16), h: b.readUInt32BE(20) } : null);
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
/** Size plus a real completeness check — a truncated file still reports a size. */
function readImage(abs) {
  const ext = path.extname(abs).toLowerCase();
  const buf = fs.readFileSync(abs);
  const size = ext === '.png' ? pngSize(buf) : jpegSize(buf);
  const tail = buf.slice(-8).toString('hex');
  const whole = ext === '.png' ? tail.includes('49454e44') : tail.endsWith('ffd9');
  if (!size) return { skip: 'unreadable' };
  if (!whole) return { skip: 'truncated' };
  return { buf, size };
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
  if (!fs.existsSync(DEST)) throw new Error(`no photographs at ${DEST}`);
  const onDisk = fs.readdirSync(DEST).filter((f) => /\.(png|jpe?g)$/i.test(f));
  /* The framed originals live beside the crops and are not published. */
  const unused = onDisk.filter((f) => !/-framed\.png$/i.test(f) && !PHOTOS.some(([p]) => p === f));
  if (unused.length) console.log(`  !! on disk but not in PHOTOS: ${unused.join(', ')}`);

  const photos = [];
  for (const [file, name, desc, focus] of PHOTOS) {
    const abs = path.join(DEST, file);
    if (!fs.existsSync(abs)) { console.log(`  !! missing: ${file}`); continue; }
    const img = readImage(abs);
    if (img.skip) { console.log(`     skipped ${file}  (${img.skip})`); continue; }
    photos.push({ src: file, name, desc, focus, w: img.size.w, h: img.size.h });
    console.log(`  ${String(photos.length).padStart(2)}  ${name.padEnd(24)} ${img.size.w}x${img.size.h}  ${desc.slice(0, 58)}…`);
  }
  if (!photos.length) throw new Error('nothing to publish');

  const block = {
    type: 'photo-folder',
    layout: { x: 0, y: 0, w: 12, h: 15 },
    base: BASE,
    /* No eyebrow: the reference has nothing above the folder, and the user
       asked for the label to go. */
    eyebrow: '',
    title: 'Torii Connect',
    openLabel: 'View photos',
    backLabel: 'Back to the folder',
    /* The two measured colours: the orange off the mark on the brand film's
       closing card, the red off the polo the team wears. The stylesheet takes
       both right down — the sheet stops being flat, and that is all. */
    glow: '#F05D29',
    glow2: '#D91823',
    photos,
  };

  const db = JSON.parse(fs.readFileSync(DB, 'utf8'));
  const section = db.sections.find((s) => s.orgId === ORG && s.key === KEY);
  if (!section) throw new Error(`no "${KEY}" section in "${ORG}"`);
  const was = (section.blocks || [])[0];
  console.log(`\n  ${ORG} / ${section.title}: ${was ? was.type : 'blank'} -> photo-folder (${photos.length} photographs)`);
  if (DRY) { console.log('  dry run — nothing written'); return; }

  fs.mkdirSync(BACKUPS, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const saved = path.join(BACKUPS, `db-before-toriiconnect-${ORG}-${stamp}.json`);
  fs.copyFileSync(DB, saved);
  JSON.parse(fs.readFileSync(saved, 'utf8'));
  console.log(`  backup  backend/data/backups/${path.basename(saved)}`);

  const admin = (await request('POST', '/api/auth/login', { email: (process.env.ADMIN_EMAIL || 'Torii@123.com'), password: (process.env.ADMIN_PASSWORD || 'Admin@123') }))
    .setCookie.match(/op_session=([^;]+)/)[1];
  await request('PATCH', `/api/sections/${section.id}`, { blocks: [block] }, admin);

  const stored = (await request('GET', `/api/sections/${section.id}`, null, admin)).json.section.blocks[0];
  console.log(`\n  stored: ${stored.type}  base=${stored.base}  ${stored.photos.length} photograph(s)`);
  const gone = stored.photos.filter((p) => !fs.existsSync(path.join(DEST, p.src)));
  console.log(gone.length ? `  !! ${gone.length} have no file` : '  every photograph resolves to a file on disk');
  stored.photos.forEach((p) => {
    if (!p.name) console.log(`  !! a photograph lost its name in the schema`);
    if (!p.desc) console.log(`  !! ${p.name} lost its description in the schema`);
  });
})().catch((e) => { console.error('  ERROR ' + e.message); process.exitCode = 1; });
