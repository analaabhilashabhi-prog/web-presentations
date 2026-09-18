/**
 * Publishes Torii's Organization Snapshot: the drift wall, filled with the whole
 * Torii Minds photograph library, with the Torii mark in the middle.
 *
 *   node tools/publish-torii-snapshot.cjs [--port 9371] [--org torii] [--dry] [--limit N]
 *
 * Needs the app server on 4173 and a headless Chrome to re-encode through —
 * there is no image library in this project and there is not going to be.
 *
 * THE WALL
 * --------
 * The block and its look are unchanged — same columns, tile size, tilt, drift.
 * Only what is on it changes: the 79 tiles Torii inherited from NGI's mirror
 * (Technical Hub's campus, its app, its team) go, and every photograph in
 * `Downloads/TORII/Torii/Torii` comes in — 383 of them across Events,
 * Trainings, Placements, Certifications, MOUs, NT Square and the rest. The
 * wall interleaves tiles by category so no column is all one subject, and the
 * category is the folder each photograph came from.
 *
 * THE BYTES
 * ---------
 * 383 originals are 99MB; a tile is 230x150. Each is re-encoded through the
 * canvas to at most 560px wide at quality 0.82, which is a little over twice
 * the tile at presenting scale and comes to roughly 40kB a tile — about 15MB
 * for the whole wall instead of 99. They go up as assets through `/api/assets`
 * in batches, named `snapshot-<path>.jpg`, and an asset already in the library
 * under that name is reused rather than uploaded again, so the script can be
 * re-run.
 *
 * THE MARK
 * --------
 * `Downloads/TORI LOGO.png` is a 1024px square with the mark in its middle 482x504
 * — orange frame, dark bar, a baked-in glow — on transparency (93% of it is
 * clear). It is cropped to the mark plus its glow and written at 420px, alpha
 * intact, to `uploads/Snapshot/torii-logo.png`; the block points at that path.
 * The plate it sits on is Torii's ink rather than NGI's green.
 *
 * THE NAMES
 * ---------
 * Folder names, normalised: several arrive in Unicode "mathematical bold"
 * letters (𝐒𝐂𝐈𝐍𝐎𝐕𝐀), which NFKC folds back to plain text, and a short list of
 * spellings is corrected by hand (`Achivers day`, `Hackthon`, `Sucess`). No
 * caption is written that is not the folder's own name.
 */
const fs = require('fs');
const path = require('path');
const http = require('http');
const { connect, evaluate } = require('./lib/cdp.cjs');

const ROOT = path.resolve(__dirname, '..');
const SRC = 'C:/Users/HP/Downloads/TORII/Torii/Torii';
const LOGO_SRC = 'C:/Users/HP/Downloads/TORI LOGO.png';
const LOGO_DEST_DIR = path.join(ROOT, 'backend/uploads/Snapshot');
const LOGO_REL = 'Snapshot/torii-logo.png';
const DB = path.join(ROOT, 'backend/data/db.json');
const BACKUPS = path.join(ROOT, 'backend/data/backups');
const HOST = { host: '127.0.0.1', port: Number(process.env.PORT) || 4173 };

const arg = (n, d = null) => {
  const i = process.argv.indexOf(`--${n}`);
  return i > -1 && process.argv[i + 1] && !process.argv[i + 1].startsWith('--') ? process.argv[i + 1] : d;
};
const ORG = arg('org', 'torii');
const KEY = 'organization-snapshot';
const DRY = process.argv.includes('--dry');
const PORT = Number(arg('port', 9371));
const LIMIT = Number(arg('limit', 0)) || 0;
const TILE_MAX_W = 560;
const TILE_Q = 0.82;
const BATCH = 8;

/* Folder spellings corrected by hand. Keys are matched after NFKC folding. */
const FIX = {
  'Achivers day': 'Achievers Day',
  'Internal Hackthon': 'Internal Hackathon',
  'Toriiminds intro': 'Torii Minds Intro',
  'Sucess story': 'Success Story',
  'jpath connect': 'JPath Connect',
  'Redhat Academy day': 'Red Hat Academy Day',
  'Ai Cinema': 'AI Cinema',
  'placements': 'Placements',
  'certifications': 'Certifications',
  'NT SQUARE': 'NT Square',
  'Events': 'Events',
  'Trainings': 'Trainings',
  'MOU': 'MOUs',
  'MoU with 09': 'MoU with o9',
  'Torii X fab': 'Torii x Fab',
  'Ninja pro': 'Ninja Pro',
  'NinjaPlus': 'Ninja Plus',
  'CProgramming': 'C Programming',
  'Googlecloud': 'Google Cloud',
  'Servicenow ITSM': 'ServiceNow ITSM',
  'Cisco Network academy Python Essentials': 'Cisco Networking Academy · Python Essentials',
  'Cisco Networking academy C Essentials 1': 'Cisco Networking Academy · C Essentials 1',
  'Infosys springBoard': 'Infosys Springboard',
  'Beyond Boundries': 'Beyond Boundaries',
  'Student Teachback': 'Student Teach-back',
};
const clean = (name) => {
  const folded = name.normalize('NFKC').replace(/\s+/g, ' ').trim();
  return FIX[folded] || folded;
};
const slug = (v) => v.normalize('NFKC').toLowerCase().replace(/&/g, ' and ').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

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

/** Every JPEG under the library, with its folder path relative to the root. */
function walk(dir, rel = '') {
  const out = [];
  for (const f of fs.readdirSync(dir)) {
    const abs = path.join(dir, f);
    const st = fs.statSync(abs);
    if (st.isDirectory()) out.push(...walk(abs, rel ? `${rel}/${f}` : f));
    else if (/\.jpe?g$/i.test(f)) out.push({ abs, rel: rel ? `${rel}/${f}` : f, folders: rel ? rel.split('/') : [] });
  }
  return out;
}

(async () => {
  if (!fs.existsSync(SRC)) throw new Error(`library not found: ${SRC}`);
  let files = walk(SRC);
  files.sort((a, b) => a.rel.localeCompare(b.rel));
  if (LIMIT) files = files.slice(0, LIMIT);
  const total = files.reduce((n, f) => n + fs.statSync(f.abs).size, 0);
  console.log(`  ${files.length} photographs in the library, ${(total / 1048576).toFixed(0)}MB`);

  const db = JSON.parse(fs.readFileSync(DB, 'utf8'));
  const section = db.sections.find((s) => s.orgId === ORG && s.key === KEY);
  if (!section) throw new Error(`no "${KEY}" section in "${ORG}"`);
  const was = (section.blocks || [])[0];
  if (!was || was.type !== 'drift-wall') throw new Error(`expected a drift-wall on ${ORG}/${KEY}, found ${was ? was.type : 'nothing'}`);

  const cdp = await connect(PORT);
  await cdp.send('Runtime.enable');

  /* The mark. */
  fs.mkdirSync(LOGO_DEST_DIR, { recursive: true });
  {
    const buf = fs.readFileSync(LOGO_SRC);
    const res = await evaluate(cdp, `(async () => {
      const im = new Image(); im.src = ${JSON.stringify(`data:image/png;base64,${buf.toString('base64')}`)}; await im.decode();
      const c0 = document.createElement('canvas'); c0.width = im.naturalWidth; c0.height = im.naturalHeight;
      const x0 = c0.getContext('2d', { willReadFrequently: true }); x0.drawImage(im, 0, 0);
      const d = x0.getImageData(0, 0, c0.width, c0.height).data;
      /* the mark's box, then a margin for its glow */
      let l = c0.width, t = c0.height, r = 0, b = 0;
      for (let y = 0; y < c0.height; y += 2) for (let X = 0; X < c0.width; X += 2) if (d[(y * c0.width + X) * 4 + 3] > 40) { if (X < l) l = X; if (X > r) r = X; if (y < t) t = y; if (y > b) b = y; }
      const m = 72; l = Math.max(0, l - m); t = Math.max(0, t - m); r = Math.min(c0.width, r + m); b = Math.min(c0.height, b + m);
      const side = Math.max(r - l, b - t); const cx = (l + r) / 2, cy = (t + b) / 2;
      const sx = Math.max(0, cx - side / 2), sy = Math.max(0, cy - side / 2);
      const out = 420; const c = document.createElement('canvas'); c.width = out; c.height = out;
      const x = c.getContext('2d'); x.imageSmoothingQuality = 'high'; x.drawImage(im, sx, sy, side, side, 0, 0, out, out);
      return { box: [l, t, r - l, b - t], side, url: c.toDataURL('image/png') };
    })()`);
    const bytes = Buffer.from(res.url.split(',')[1], 'base64');
    if (!bytes.slice(-8).toString('hex').includes('49454e44')) throw new Error('logo: output is not a complete PNG');
    if (!DRY) fs.writeFileSync(path.join(LOGO_DEST_DIR, 'torii-logo.png'), bytes);
    console.log(`  mark: cropped to ${res.side}x${res.side} around ${JSON.stringify(res.box)} -> 420x420 PNG, ${Math.round(bytes.length / 1024)}kB, alpha kept`);
  }

  /* The tiles: re-encode, then upload what the library does not already hold. */
  const admin = DRY ? null : (await request('POST', '/api/auth/login', { email: (process.env.ADMIN_EMAIL || 'Torii@123.com'), password: (process.env.ADMIN_PASSWORD || 'Admin@123') }))
    .setCookie.match(/op_session=([^;]+)/)[1];
  const existing = new Map();
  if (!DRY) {
    for (const a of (await request('GET', '/api/assets', null, admin)).json.assets || []) existing.set(a.name, a.id);
  }

  const items = [];
  let outBytes = 0;
  let reused = 0;
  let pending = [];
  const flush = async () => {
    if (!pending.length) return;
    if (DRY) { pending.forEach((p) => items.push({ assetId: 'dry', ...p.meta })); pending = []; return; }
    const r = await request('POST', '/api/assets', { files: pending.map((p) => ({ name: p.name, dataUrl: p.dataUrl })) }, admin);
    const created = r.json.assets || r.json.files || [];
    if (created.length !== pending.length) throw new Error(`uploaded ${pending.length}, server returned ${created.length}`);
    created.forEach((a, i) => { existing.set(a.name, a.id); items.push({ assetId: a.id, ...pending[i].meta }); });
    pending = [];
  };

  for (let i = 0; i < files.length; i++) {
    const f = files[i];
    const category = clean(f.folders[0] || 'Torii Minds');
    const title = clean(f.folders[f.folders.length - 1] || f.folders[0] || 'Torii Minds');
    const name = `snapshot-${slug(f.rel.replace(/\.jpe?g$/i, ''))}.jpg`;
    const meta = { title, tag: title, category };
    if (existing.has(name)) { items.push({ assetId: existing.get(name), ...meta }); reused++; continue; }

    const buf = fs.readFileSync(f.abs);
    if (!buf.slice(-2).toString('hex').endsWith('ffd9')) { console.log(`     skipped ${f.rel} (truncated)`); continue; }
    const res = await evaluate(cdp, `(async () => {
      const im = new Image(); im.src = ${JSON.stringify(`data:image/jpeg;base64,${buf.toString('base64')}`)}; await im.decode();
      const scale = Math.min(1, ${TILE_MAX_W} / im.naturalWidth);
      const w = Math.round(im.naturalWidth * scale), h = Math.round(im.naturalHeight * scale);
      const c = document.createElement('canvas'); c.width = w; c.height = h;
      const x = c.getContext('2d'); x.fillStyle = '#fff'; x.fillRect(0, 0, w, h);
      x.imageSmoothingQuality = 'high'; x.drawImage(im, 0, 0, w, h);
      return c.toDataURL('image/jpeg', ${TILE_Q});
    })()`);
    const bytes = Buffer.from(res.split(',')[1], 'base64');
    if (!bytes.slice(-2).toString('hex').endsWith('ffd9')) throw new Error(`${f.rel}: output is not a complete JPEG`);
    outBytes += bytes.length;
    pending.push({ name, dataUrl: res, meta });
    if (pending.length >= BATCH) await flush();
    if ((i + 1) % 50 === 0) console.log(`  … ${i + 1}/${files.length}`);
  }
  await flush();
  cdp.close();

  const byCat = items.reduce((m, it) => { m[it.category] = (m[it.category] || 0) + 1; return m; }, {});
  console.log(`\n  ${items.length} tiles (${reused} already in the library, ${items.length - reused} new · ${Math.round(outBytes / 1048576)}MB uploaded)`);
  Object.entries(byCat).sort((a, b) => b[1] - a[1]).forEach(([k, v]) => console.log(`     ${String(v).padStart(3)}  ${k}`));

  const block = {
    ...was,
    /* The name comes off; the mark goes in its place, on Torii's own plate. */
    titleTop: '',
    titleBottom: '',
    tagline: 'Torii Minds',
    logo: LOGO_REL,
    brand: 'Torii Minds',
    plate: '#171514',
    items,
  };
  delete block.id;

  console.log(`\n  ${ORG} / ${section.title}: drift-wall (${was.items.length} tiles, "${was.titleTop} ${was.titleBottom}") -> drift-wall (${items.length} tiles, the mark)`);
  if (DRY) { console.log('  dry run — nothing uploaded, nothing written'); return; }

  fs.mkdirSync(BACKUPS, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const saved = path.join(BACKUPS, `db-before-snapshot-${ORG}-${stamp}.json`);
  fs.copyFileSync(DB, saved);
  JSON.parse(fs.readFileSync(saved, 'utf8'));
  console.log(`  backup  backend/data/backups/${path.basename(saved)}`);

  await request('PATCH', `/api/sections/${section.id}`, { blocks: [block] }, admin);
  const stored = (await request('GET', `/api/sections/${section.id}`, null, admin)).json.section.blocks[0];
  console.log(`\n  stored: ${stored.type}  ${stored.items.length} tiles  logo=${stored.logo || 'none'}  plate=${stored.plate}  brand=${stored.brand}`);
  const unresolved = stored.items.filter((i) => !i.asset || !i.asset.url).length;
  console.log(unresolved ? `  !! ${unresolved} tile(s) did not resolve to an asset` : '  every tile resolves to an asset');
  console.log(fs.existsSync(path.join(LOGO_DEST_DIR, 'torii-logo.png')) ? '  the mark is on disk' : '  !! the mark is missing');
})().catch((e) => { console.error('  ERROR ' + e.message); process.exitCode = 1; });
