/**
 * Publishes Torii's Team section as the skewed ribbon.
 *
 *   node tools/publish-torii-team.cjs --port <chrome debug port> [--org torii] [--dry]
 *
 * Needs the app server on 4173, and a headless Chrome to resize through — there
 * is no image library in this project and there is not going to be, so the
 * browser decodes each file and a canvas re-encodes it, the same way
 * `crop-image.cjs` and `normalise-navicons.cjs` do. `--raw` copies the files
 * through untouched instead, for a machine with no Chrome to hand.
 *
 * WHAT CHANGES
 * ------------
 * The section held a `hub` block: four doors to Profile of the Society,
 * Governing Body, Academic Council and Faculty Strength. Those four are real
 * child sections of this one, so the navigation pane already lists every one of
 * them under the Team row — the block was a second copy of a list the presenter
 * can already see, on the slide that should be showing the team.
 *
 * WHY THE FILES ARE RE-ENCODED
 * ----------------------------
 * The originals are 1080x1080 PNGs with an alpha channel, around 900kB each and
 * 21MB for the set. They are cut-out figures, so the transparency has to
 * survive — which rules out JPEG, whose flattening would put a white box behind
 * every person on a red wall. WebP keeps the alpha at about a twelfth of the
 * weight, and 760px is a little over twice the width a card is ever drawn at.
 *
 * THE NAMES
 * ---------
 * Written out by hand rather than derived from the filenames, for the reason
 * the events map is: `veera babu.png` title-cases to "Veera Babu" but
 * `sampath].png` does not lose its bracket, and no rule turns a filename into a
 * person's name safely. Two people here are both called Prasanth; the files
 * distinguish them and the cards cannot, so both are set as Prasanth until
 * their full names are supplied. No role is invented for anybody.
 */
const fs = require('fs');
const path = require('path');
const http = require('http');
const { connect, evaluate } = require('./lib/cdp.cjs');

const ROOT = path.resolve(__dirname, '..');
const SRC = 'C:/Users/HP/Downloads/Torii/team updated png';
const BASE = 'Team';
const DEST = path.join(ROOT, 'backend/uploads', BASE);
const DB = path.join(ROOT, 'backend/data/db.json');
const BACKUPS = path.join(ROOT, 'backend/data/backups');
const HOST = { host: '127.0.0.1', port: Number(process.env.PORT) || 4173 };

const arg = (n, d = null) => {
  const i = process.argv.indexOf(`--${n}`);
  return i > -1 && process.argv[i + 1] && !process.argv[i + 1].startsWith('--') ? process.argv[i + 1] : d;
};
const ORG = arg('org', 'torii');
const KEY = 'leadership-journey';
const DRY = process.argv.includes('--dry');
const RAW = process.argv.includes('--raw');
const PORT = Number(arg('port', 9371));
const WIDTH = 760;
const QUALITY = 0.9;

/* The red everybody in these photographs is wearing, measured off six of them
   at the shoulder — away from the logo and away from the folds. It dresses the
   whole section: the wall, the glow behind the centre card and the lit top of
   every plate are all derived from this one value. */
const TINT = '#D91823';

/* file on disk -> the name on the card. */
const TEAM = {
  'abhilash.png': 'Abhilash',
  'abhishek.png': 'Abhishek',
  'abraham.png': 'Abraham',
  'akhilesh.png': 'Akhilesh',
  'azarunnisa.png': 'Azarunnisa',
  'bhargava.png': 'Bhargava',
  'bobby.png': 'Bobby',
  'harika.png': 'Harika',
  'harshavardhini.png': 'Harshavardhini',
  'hemavathi.png': 'Hemavathi',
  'jayanth.png': 'Jayanth',
  'kiran.png': 'Kiran',
  'kiran chaithu.png': 'Kiran Chaithu',
  'manikanta.png': 'Manikanta',
  'naveen.png': 'Naveen',
  'peter.png': 'Peter',
  'prasanth.png': 'Prasanth',
  'prasanth sir.png': 'Prasanth',
  'rahul.png': 'Rahul',
  'sampath].png': 'Sampath',
  'satish.png': 'Satish',
  'sudhir.png': 'Sudhir',
  'suneetha.png': 'Suneetha',
  'veera babu.png': 'Veera Babu',
};

const slug = (s) => String(s).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');

const pngSize = (b) => (b.length > 24 && b.toString('ascii', 12, 16) === 'IHDR'
  ? { w: b.readUInt32BE(16), h: b.readUInt32BE(20) } : null);

/** Size plus a real completeness check — a truncated file still reports a size. */
function readPng(abs) {
  const buf = fs.readFileSync(abs);
  const size = pngSize(buf);
  if (!size) return { skip: 'not a PNG' };
  if (!buf.slice(-8).toString('hex').includes('49454e44')) return { skip: 'truncated' };
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
const login = async (email, password) => {
  const r = await request('POST', '/api/auth/login', { email, password });
  const t = /op_session=([^;]+)/.exec(r.setCookie)?.[1];
  if (!t) throw new Error('login returned no session cookie');
  return t;
};

(async () => {
  if (!fs.existsSync(SRC)) throw new Error(`source folder not found: ${SRC}`);

  const files = fs.readdirSync(SRC).filter((f) => f.toLowerCase().endsWith('.png')).sort();
  const unknown = files.filter((f) => !TEAM[f]);
  const missing = Object.keys(TEAM).filter((f) => !files.includes(f));
  if (unknown.length) console.log(`  !! not in TEAM, left out: ${unknown.join(', ')}`);
  if (missing.length) console.log(`  !! in TEAM but not on disk: ${missing.join(', ')}`);

  const cdp = RAW || DRY ? null : await connect(PORT);
  if (cdp) await cdp.send('Runtime.enable');

  if (!DRY) fs.mkdirSync(DEST, { recursive: true });

  const members = [];
  let before = 0;
  let after = 0;

  for (const file of files) {
    const name = TEAM[file];
    if (!name) continue;
    const img = readPng(path.join(SRC, file));
    if (img.skip) { console.log(`     skipped ${file}  (${img.skip})`); continue; }
    before += img.buf.length;

    const out = `${slug(file.replace(/\.png$/i, ''))}.${cdp ? 'webp' : 'png'}`;
    let bytes = img.buf;
    let size = img.size;

    if (cdp) {
      const dataUrl = `data:image/png;base64,${img.buf.toString('base64')}`;
      const res = await evaluate(cdp, `(async () => {
        const img = new Image();
        img.src = ${JSON.stringify(dataUrl)};
        await img.decode();
        const scale = Math.min(1, ${WIDTH} / img.naturalWidth);
        const w = Math.round(img.naturalWidth * scale);
        const h = Math.round(img.naturalHeight * scale);
        const c = document.createElement('canvas');
        c.width = w; c.height = h;
        const ctx = c.getContext('2d');
        /* No ground painted under it: these are cut-out figures and the
           transparency is the point — a white fill would put a box behind every
           person on the wall. WebP carries the alpha; JPEG could not. */
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(img, 0, 0, w, h);
        return { w, h, from: { w: img.naturalWidth, h: img.naturalHeight }, url: c.toDataURL('image/webp', ${QUALITY}) };
      })()`);
      if (!res || !res.url || !res.url.startsWith('data:image/webp')) {
        throw new Error(`${file}: the canvas did not return a WebP — Chrome on port ${PORT} may be too old`);
      }
      bytes = Buffer.from(res.url.split(',')[1], 'base64');
      // A canvas that ran out of memory returns a short string rather than
      // throwing, so the result is checked for its own container before it is
      // written: 'RIFF' at 0 and 'WEBP' at 8.
      if (bytes.slice(0, 4).toString('ascii') !== 'RIFF' || bytes.slice(8, 12).toString('ascii') !== 'WEBP') {
        throw new Error(`${file}: output is not a complete WebP`);
      }
      size = { w: res.w, h: res.h };
    }

    after += bytes.length;
    if (!DRY) fs.writeFileSync(path.join(DEST, out), bytes);
    members.push({ photo: `${BASE}/${out}`, name, role: '' });
    console.log(`  ${name.padEnd(16)} ${String(img.size.w)}x${img.size.h} ${String(Math.round(img.buf.length / 1024)).padStart(5)}kB`
      + `  ->  ${size.w}x${size.h} ${String(Math.round(bytes.length / 1024)).padStart(4)}kB   ${out}`);
  }
  if (cdp) cdp.close();

  console.log(`\n  ${members.length} member(s)${DRY ? '   (dry run — nothing written)' : ''}`);
  console.log(`  ${Math.round(before / 1024)}kB of PNG -> ${Math.round(after / 1024)}kB`
    + `  (${(100 - (after / before) * 100).toFixed(1)}% smaller)`);

  const block = {
    type: 'skew-carousel',
    layout: { x: 0, y: 0, w: 12, h: 15 },
    eyebrow: 'Torii Minds',
    title: 'The Team',
    lead: '',
    tint: TINT,
    members,
  };

  const db = JSON.parse(fs.readFileSync(DB, 'utf8'));
  const section = db.sections.find((s) => s.orgId === ORG && s.key === KEY);
  if (!section) throw new Error(`no "${KEY}" section in "${ORG}"`);
  const was = (section.blocks || [])[0];
  console.log(`\n  ${section.title}: ${was ? was.type : 'empty'} -> skew-carousel`);
  if (was?.type === 'hub') {
    console.log(`  the ${(was.doors || []).length} hub door(s) it replaces are all real child sections of this one, `
      + 'and the pane lists every one of them under this row:');
    (was.doors || []).forEach((d) => console.log(`     ${d.label}`));
  }
  if (DRY) return;

  fs.mkdirSync(BACKUPS, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const saved = path.join(BACKUPS, `db-before-team-${ORG}-${stamp}.json`);
  fs.copyFileSync(DB, saved);
  JSON.parse(fs.readFileSync(saved, 'utf8'));
  console.log(`  backup  ${path.relative(ROOT, saved)}`);

  const admin = await login('admin@org.local', 'Admin@123');
  await request('PATCH', `/api/sections/${section.id}`, { blocks: [block] }, admin);

  const stored = (await request('GET', `/api/sections/${section.id}`, null, admin)).json.section.blocks[0];
  console.log(`\n  stored: ${stored.type}  tint=${stored.tint}  ${stored.members.length} member(s)`);
  const gone = stored.members.filter((m) => !fs.existsSync(path.join(ROOT, 'backend/uploads', m.photo)));
  console.log(gone.length ? `  !! ${gone.length} photograph(s) have no file: ${gone.map((m) => m.photo).join(', ')}`
    : '  every photograph resolves to a file on disk');
})().catch((e) => { console.error('  ERROR ' + e.message); process.exitCode = 1; });
