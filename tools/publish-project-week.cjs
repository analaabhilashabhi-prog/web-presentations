/**
 * Publishes Torii's Project Week as the photo collage.
 *
 *   node tools/publish-project-week.cjs --port <chrome debug port> [--org torii] [--dry]
 *
 * Needs the app server on 4173. The nine collage photographs are PNG and are
 * re-encoded to JPEG through a headless Chrome — there is no image library in
 * this project — but only once: if `01.jpg` … `09.jpg` already stand in the
 * uploads folder they are reused and no Chrome is needed. `--reencode` forces
 * the pass; `--raw` copies the files untouched.
 *
 * THE LAYOUT
 * ----------
 * Built to a reference image the user supplied: copy in the left third, a
 * staggered collage of nine photographs to its right, a short list set into a
 * gap in the collage. Every card has its own entrance. The pill and every card
 * open the shared viewer, where each photograph is shown whole.
 *
 * THE ORDER
 * ---------
 * The nine are dealt into nine fixed slots, so the order here IS the layout.
 * Each is matched to a slot near its own shape where that was possible — the
 * wide hall shots to the wide cards, the two-person shots to the square ones —
 * and the two tall cards take pictures with a strong vertical subject and a
 * `focus` that keeps it in frame. Written out by hand: which photograph goes
 * where is a judgement, not a filename.
 *
 * THE WALL
 * --------
 * Everything beyond the nine goes under the collage, as a justified wall the
 * slide scrolls down to (`more[]`). Those come from a second folder, already
 * JPEG and no wider than 1920, so they are copied as they are — `m01.jpg` on,
 * in filename order, which for these is the order they were taken. No caption
 * is written on any of them: the files are named by timestamp and nothing
 * else, and a caption guessed off a picture is worse than none.
 *
 * THE COPY
 * --------
 * Written from the photographs, at the user's request, and from nothing else:
 * numbered Project Week tent cards, chart-paper blueprints (Google Cloud
 * Fundamentals, Student Attendance Tracker, Wheel N Deal), laptops, Torii
 * mentors in red at the tables, a full hall. No count is stated and nothing is
 * claimed about outcomes. Replace it the moment the user's own words arrive.
 */
const fs = require('fs');
const path = require('path');
const http = require('http');
const { connect, evaluate } = require('./lib/cdp.cjs');

const ROOT = path.resolve(__dirname, '..');
const SRC = 'C:/Users/HP/Downloads/TORII/project week';
const MORE_SRC = 'C:/Users/HP/Downloads/TORII/Torii/Torii/Events/Project Week';
const BASE = 'ProjectWeek';
const DEST = path.join(ROOT, 'backend/uploads', BASE);
const DB = path.join(ROOT, 'backend/data/db.json');
const BACKUPS = path.join(ROOT, 'backend/data/backups');
const HOST = { host: '127.0.0.1', port: Number(process.env.PORT) || 4173 };

const arg = (n, d = null) => {
  const i = process.argv.indexOf(`--${n}`);
  return i > -1 && process.argv[i + 1] && !process.argv[i + 1].startsWith('--') ? process.argv[i + 1] : d;
};
const ORG = arg('org', 'torii');
const KEY = 'project-week';
const DRY = process.argv.includes('--dry');
const RAW = process.argv.includes('--raw');
const REENCODE = process.argv.includes('--reencode');
const PORT = Number(arg('port', 9371));
const WIDTH = 1600;
const QUALITY = 0.88;

/* file -> [caption, focus]  in slot order. See "THE ORDER" above. */
const PHOTOS = [
  ['IMG_0491.png',  'Mapping Google Cloud Fundamentals on chart paper', '50% 45%'],   // under the pill, ~square
  ['IMG_0492.png',  'Working through a cloud flow diagram', '55% 40%'],               // col 2 top, ~square
  ['IMG_0503.png',  'Team 24 at the table with Wheel N Deal', '50% 55%'],             // col 2 bottom, wide
  ['IMG_0500.png',  'Two heads, one laptop', '52% 45%'],                              // col 3 top, ~square
  ['_D7A0021.png',  'Laptops open beside the blueprint', '50% 50%'],                  // col 3 bottom, 3:2
  ['_D7A0023.png',  'A Torii mentor at the table', '34% 50%'],                        // col 4, tall
  ['_D7A0004.png',  'The hall, every table taken', '50% 50%'],                        // col 5 top, wide
  ['IMG_0508.png',  'Checking the Student Attendance Tracker blueprint', '52% 42%'],  // col 5 tall
  ['_D7A0013.png',  'Teams at work across the room', '50% 50%'],                      // col 5 bottom, wide
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
  return { buf, ext, size, mime: ext === '.png' ? 'image/png' : 'image/jpeg' };
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
  const onDisk = fs.readdirSync(SRC);
  const missing = PHOTOS.map(([f]) => f).filter((f) => !onDisk.includes(f));
  const unused = onDisk.filter((f) => /\.(jpe?g|png|webp)$/i.test(f) && !PHOTOS.some(([p]) => p === f));
  if (missing.length) console.log(`  !! in PHOTOS but not on disk: ${missing.join(', ')}`);
  if (unused.length) console.log(`  !! on disk but not in PHOTOS: ${unused.join(', ')}`);

  /* The re-encoded collage already on disk is reused unless told otherwise:
     the input has not changed, and it spares the run a Chrome. */
  const encoded = PHOTOS.map((_, i) => path.join(DEST, `${String(i + 1).padStart(2, '0')}.jpg`));
  const reuse = !RAW && !REENCODE && encoded.every((f) => fs.existsSync(f));
  if (reuse) console.log('  collage: reusing the nine JPEGs already in uploads (--reencode to redo them)');
  const cdp = RAW || DRY || reuse ? null : await connect(PORT);
  if (cdp) await cdp.send('Runtime.enable');
  if (!DRY) fs.mkdirSync(DEST, { recursive: true });

  const photos = [];
  let before = 0;
  let after = 0;
  for (const [file, name, focus] of PHOTOS) {
    const abs = path.join(SRC, file);
    if (!fs.existsSync(abs)) continue;
    const img = readImage(abs);
    if (img.skip) { console.log(`     skipped ${file}  (${img.skip})`); continue; }
    before += img.buf.length;

    /* JPEG out, whatever came in: these are photographs, and PNG is why nine of
       them weigh eleven megabytes. */
    const out = `${String(photos.length + 1).padStart(2, '0')}.jpg`;
    let bytes = img.buf;
    let size = img.size;
    if (reuse) {
      bytes = fs.readFileSync(path.join(DEST, out));
      size = jpegSize(bytes);
    } else if (cdp) {
      const dataUrl = `data:${img.mime};base64,${img.buf.toString('base64')}`;
      const res = await evaluate(cdp, `(async () => {
        const im = new Image(); im.src = ${JSON.stringify(dataUrl)}; await im.decode();
        const scale = Math.min(1, ${WIDTH} / im.naturalWidth);
        const w = Math.round(im.naturalWidth * scale), h = Math.round(im.naturalHeight * scale);
        const c = document.createElement('canvas'); c.width = w; c.height = h;
        const x = c.getContext('2d');
        x.fillStyle = '#ffffff'; x.fillRect(0, 0, w, h);   // JPEG has no alpha; an untouched canvas encodes black
        x.imageSmoothingEnabled = true; x.imageSmoothingQuality = 'high';
        x.drawImage(im, 0, 0, w, h);
        return { w, h, url: c.toDataURL('image/jpeg', ${QUALITY}) };
      })()`);
      bytes = Buffer.from(res.url.split(',')[1], 'base64');
      if (!bytes.slice(-8).toString('hex').endsWith('ffd9')) throw new Error(`${file}: output is not a complete JPEG`);
      size = { w: res.w, h: res.h };
    }
    after += bytes.length;
    if (!DRY && !reuse) fs.writeFileSync(path.join(DEST, out), bytes);
    photos.push({ src: out, name, focus, w: size.w, h: size.h });
    console.log(`  ${String(photos.length).padStart(2)}  ${name.padEnd(52)} ${img.size.w}x${img.size.h} `
      + `${String(Math.round(img.buf.length / 1024)).padStart(5)}kB -> ${size.w}x${size.h} ${String(Math.round(bytes.length / 1024)).padStart(4)}kB`);
  }
  if (cdp) cdp.close();
  console.log(`\n  ${photos.length} photographs  ${Math.round(before / 1024)}kB -> ${Math.round(after / 1024)}kB`
    + (before ? `  (${(100 - (after / before) * 100).toFixed(1)}% smaller)` : '') + (DRY ? '   (dry run)' : ''));

  /* The wall. Copied as they are — see "THE WALL" above. */
  const more = [];
  if (fs.existsSync(MORE_SRC)) {
    const files = fs.readdirSync(MORE_SRC).filter((f) => /\.(jpe?g)$/i.test(f)).sort();
    let bytes = 0;
    for (const file of files) {
      const img = readImage(path.join(MORE_SRC, file));
      if (img.skip) { console.log(`     skipped ${file}  (${img.skip})`); continue; }
      const out = `m${String(more.length + 1).padStart(2, '0')}.jpg`;
      if (!DRY) fs.writeFileSync(path.join(DEST, out), img.buf);
      more.push({ src: out, name: '', w: img.size.w, h: img.size.h });
      bytes += img.buf.length;
    }
    console.log(`  wall: ${more.length} more photographs from ${path.basename(MORE_SRC)}/  ${Math.round(bytes / 1024)}kB, copied as they are`);
  } else {
    console.log(`  wall: no folder at ${MORE_SRC} — the slide will have no wall`);
  }

  const block = {
    type: 'photo-collage',
    layout: { x: 0, y: 0, w: 12, h: 15 },
    base: BASE,
    /* Just the organization here: the title below says Project Week, and the
       eyebrow saying it too was the same words twice. */
    eyebrow: 'Torii Minds',
    /* The blobs behind the collage: the orange measured off the mark on the
       brand film's closing card, and the red measured off the polo everybody in
       the team photographs wears. The stylesheet takes both down to a fifteenth
       of their strength — the ground should stop being flat, not become a
       gradient anybody looks at. */
    glow: '#F05D29',
    glow2: '#D91823',
    title: 'Project Week',
    lead: 'Project Week puts students into numbered teams with chart paper, laptops and a week — while Torii mentors move table to table as the ideas take shape.',
    points: ['Numbered teams.', 'Blueprints on chart paper.', 'Mentors, table to table.', 'Cloud, drawn by hand.'],
    ctaLabel: 'See every photograph',
    photos,
    more,
    moreLabel: 'Every photograph',
    topLabel: 'Back to the top',
  };

  const db = JSON.parse(fs.readFileSync(DB, 'utf8'));
  const section = db.sections.find((s) => s.orgId === ORG && s.key === KEY);
  if (!section) throw new Error(`no "${KEY}" section in "${ORG}"`);
  const was = (section.blocks || [])[0];
  console.log(`\n  ${ORG} / ${section.title}: ${was ? was.type : 'blank'} -> photo-collage`);
  if (DRY) return;

  fs.mkdirSync(BACKUPS, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const saved = path.join(BACKUPS, `db-before-projectweek-${ORG}-${stamp}.json`);
  fs.copyFileSync(DB, saved);
  JSON.parse(fs.readFileSync(saved, 'utf8'));
  console.log(`  backup  backend/data/backups/${path.basename(saved)}`);

  const admin = (await request('POST', '/api/auth/login', { email: 'admin@org.local', password: 'Admin@123' }))
    .setCookie.match(/op_session=([^;]+)/)[1];
  await request('PATCH', `/api/sections/${section.id}`, { blocks: [block] }, admin);

  const stored = (await request('GET', `/api/sections/${section.id}`, null, admin)).json.section.blocks[0];
  console.log(`\n  stored: ${stored.type}  base=${stored.base}  ${stored.photos.length} photo(s) + ${(stored.more || []).length} more  ${stored.points.length} point(s)`);
  const gone = [...stored.photos, ...(stored.more || [])].filter((p) => !fs.existsSync(path.join(DEST, p.src)));
  console.log(gone.length ? `  !! ${gone.length} photo(s) have no file` : '  every photograph resolves to a file on disk');
})().catch((e) => { console.error('  ERROR ' + e.message); process.exitCode = 1; });
