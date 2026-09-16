/**
 * Rebuilds Student Achievements from the folders the user files them in.
 *
 *   node tools/publish-achievements.cjs [--org technical-hub] [--dry]
 *
 * Needs the app server on 4173.
 *
 * One folder is one achievement and one card. The folder's name is the
 * achievement's name — it is what the card's foot reads and what the headline
 * changes to as the collection is stepped through, so it is used verbatim and
 * nothing is invented around it.
 *
 * The largest photograph in the folder goes on the card and the rest become its
 * backdrop, filling the wall behind it while that card is centred. Largest by
 * pixel area rather than by filename: these folders are numbered in the order
 * they were pasted into a document, not by which picture is the best one, and
 * the biggest file is reliably the posed shot rather than a cropped inset.
 *
 * A folder holding a single photograph has no backdrop, and the wall keeps its
 * own gradient.
 *
 * The section's own title becomes "Student Achievements"; it was "The Legacy of
 * Babji Neelam", which is a different section's headline.
 */
const fs = require('fs');
const path = require('path');
const http = require('http');

const ROOT = path.resolve(__dirname, '..');
const SRC = 'C:/Users/HP/Downloads/NGI/NGI/Student Achievements/Student Achievements';
const REL = 'achievements';
const DEST = path.join(ROOT, 'backend/uploads', REL);
const DB = path.join(ROOT, 'backend/data/db.json');
const BACKUPS = path.join(ROOT, 'backend/data/backups');
const HOST = { host: '127.0.0.1', port: Number(process.env.PORT) || 4173 };

const arg = (n, d = null) => {
  const i = process.argv.indexOf(`--${n}`);
  return i > -1 && process.argv[i + 1] && !process.argv[i + 1].startsWith('--') ? process.argv[i + 1] : d;
};
const ORG = arg('org', 'technical-hub');
const DRY = process.argv.includes('--dry');
const TITLE = 'Student Achievements';

const slug = (s) => String(s).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60);

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
const login = async (email, password) => {
  const r = await request('POST', '/api/auth/login', { email, password });
  const t = /op_session=([^;]+)/.exec(r.setCookie)?.[1];
  if (!t) throw new Error('login returned no session cookie');
  return t;
};

(async () => {
  if (!fs.existsSync(SRC)) throw new Error(`source folder not found: ${SRC}`);

  const stories = [];
  const skipped = [];
  let files = 0;

  for (const folder of fs.readdirSync(SRC).sort()) {
    const abs = path.join(SRC, folder);
    if (!fs.statSync(abs).isDirectory()) continue;

    const shots = [];
    for (const file of fs.readdirSync(abs).sort()) {
      const img = readImage(path.join(abs, file));
      if (img.skip) { skipped.push(`${folder}/${file}  (${img.skip})`); continue; }
      shots.push({ ...img, file });
    }
    if (!shots.length) { skipped.push(`${folder}  (no usable images)`); continue; }

    // Biggest first: that one goes on the card, the rest behind it.
    shots.sort((a, b) => (b.size.w * b.size.h) - (a.size.w * a.size.h));

    const dir = path.join(DEST, slug(folder));
    if (!DRY) fs.mkdirSync(dir, { recursive: true });

    const written = shots.map((shot, i) => {
      const name = `${String(i + 1).padStart(2, '0')}${shot.ext}`;
      if (!DRY) fs.writeFileSync(path.join(dir, name), shot.buf);
      files++;
      return `${REL}/${slug(folder)}/${name}`;
    });

    stories.push({
      photo: written[0],
      backdrop: written.slice(1),
      // The folder's name, verbatim — it is the achievement.
      name: folder,
      role: '',
      body: '',
      quote: '',
    });
    console.log(`  ${String(shots.length).padStart(2)} photo(s)  card ${shots[0].size.w}x${shots[0].size.h}`
      + `  ${written.length > 1 ? String(written.length - 1) + ' behind' : 'gradient behind'}   ${folder}`);
  }

  console.log(`\n  ${stories.length} achievements, ${files} photographs${DRY ? '   (dry run — nothing written)' : ''}`);
  skipped.forEach((x) => console.log(`     skipped ${x}`));
  const solo = stories.filter((s) => !s.backdrop.length).length;
  console.log(`  ${solo} achievement(s) have one photograph and keep the gradient behind them`);

  const db = JSON.parse(fs.readFileSync(DB, 'utf8'));
  const section = db.sections.find((s) => s.orgId === ORG && s.key === 'success-stories');
  if (!section) throw new Error(`no student achievements section in "${ORG}"`);
  const block = (section.blocks || [])[0];
  if (!block || block.type !== 'story-wall') throw new Error('that section does not hold a story-wall block');

  console.log(`\n  title: ${JSON.stringify(block.title)} -> ${JSON.stringify(TITLE)}`);
  console.log(`  cards: ${(block.stories || []).length} -> ${stories.length}`);
  if (DRY) return;

  fs.mkdirSync(BACKUPS, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const saved = path.join(BACKUPS, `db-before-achievements-${ORG}-${stamp}.json`);
  fs.copyFileSync(DB, saved);
  JSON.parse(fs.readFileSync(saved, 'utf8'));
  console.log(`  backup  ${path.relative(ROOT, saved)}`);

  const admin = await login('admin@org.local', 'Admin@123');
  await request('PATCH', `/api/sections/${section.id}`, {
    blocks: [{ ...block, title: TITLE, eyebrow: '', subtitle: '', stories }],
  }, admin);

  const after = (await request('GET', `/api/sections/${section.id}`, null, admin)).json.section.blocks[0];
  console.log(`\n  stored: "${after.title}"  ${after.stories.length} card(s), `
    + `${after.stories.reduce((n, s) => n + (s.backdrop || []).length, 0)} backdrop photo(s)`);

  const missing = [];
  for (const s of after.stories) {
    for (const p of [s.photo, ...(s.backdrop || [])]) {
      if (!fs.existsSync(path.join(ROOT, 'backend/uploads', p))) missing.push(p);
    }
  }
  console.log(missing.length ? `  !! ${missing.length} missing file(s): ${missing.slice(0, 4).join(', ')}`
    : '  every photograph resolves to a file on disk');
})().catch((e) => { console.error('  ERROR ' + e.message); process.exitCode = 1; });
