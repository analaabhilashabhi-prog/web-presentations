/**
 * Renames one of Beyond's chapters, on Torii.
 *
 *   node tools/rename-beyond-group.cjs "Beyond Boundaries" "Snowflake" [--dry]
 *
 * Needs the app server on 4173. Backs the store up first.
 *
 * The group's `key` and its photographs' `src` paths are deliberately NOT
 * touched. The key is identity only — nothing keys on it outside this block —
 * and the paths are the folder the files actually sit in
 * (`uploads/Beyond/beyond-boundaries/…`). Renaming either would mean moving
 * files to change a label, and a wrong guess moving media is unrecoverable
 * where a stale folder name is only a name.
 *
 * The photographs' own `label` goes with the title, because the label is drawn
 * under the card: a set called Snowflake whose every card said "Beyond
 * Boundaries" would be the rename half done.
 */
const fs = require('fs');
const path = require('path');
const http = require('http');

const ROOT = path.resolve(__dirname, '..');
const DB = path.join(ROOT, 'backend/data/db.json');
const BACKUPS = path.join(ROOT, 'backend/data/backups');
const HOST = { host: '127.0.0.1', port: Number(process.env.PORT) || 4173 };
const DRY = process.argv.includes('--dry');
const [FROM, TO] = process.argv.slice(2).filter((a) => !a.startsWith('--'));

function request(method, p, body, cookie) {
  return new Promise((resolve, reject) => {
    const payload = body ? JSON.stringify(body) : null;
    const headers = {};
    if (payload) { headers['content-type'] = 'application/json'; headers['content-length'] = Buffer.byteLength(payload); }
    if (cookie) headers.cookie = `op_session=${cookie}`;
    const req = http.request({ ...HOST, path: p, method, headers }, (res) => {
      let b = '';
      res.on('data', (d) => { b += d; });
      res.on('end', () => {
        if (res.statusCode >= 400) return reject(new Error(`${method} ${p} -> ${res.statusCode} ${b.slice(0, 200)}`));
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
  if (!FROM || !TO) throw new Error('usage: rename-beyond-group.cjs "<old name>" "<new name>"');
  const db = JSON.parse(fs.readFileSync(DB, 'utf8'));
  const section = db.sections.find((s) => s.orgId === 'torii' && s.key === 'beyond' && !s.parentId);
  if (!section) throw new Error('no Beyond row on torii');
  const block = (section.blocks || []).find((b) => b.type === 'photo-ring');
  if (!block) throw new Error('Beyond holds no photo-ring');

  const hit = (block.groups || []).find((g) => g.name === FROM);
  if (!hit) throw new Error(`no group named "${FROM}" — have: ${(block.groups || []).map((g) => g.name).join(', ')}`);

  const groups = block.groups.map((g) => (g.name !== FROM ? g : {
    ...g,
    name: TO,
    shots: (g.shots || []).map((sh) => (sh.label === FROM ? { ...sh, label: TO } : sh)),
  }));
  const renamedShots = (hit.shots || []).filter((sh) => sh.label === FROM).length;

  console.log(`  "${FROM}" -> "${TO}"`);
  console.log(`  key kept as "${hit.key}", and so are the ${(hit.shots || []).length} src paths`);
  console.log(`  labels renamed: ${renamedShots} of ${(hit.shots || []).length}`);
  if (DRY) { console.log('\n  dry run — nothing written'); return; }

  fs.mkdirSync(BACKUPS, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const saved = path.join(BACKUPS, `db-before-beyond-rename-${stamp}.json`);
  fs.copyFileSync(DB, saved);
  JSON.parse(fs.readFileSync(saved, 'utf8'));
  console.log(`\n  backup  backend/data/backups/${path.basename(saved)}`);

  const admin = (await request('POST', '/api/auth/login', {
    email: process.env.ADMIN_EMAIL || 'Torii@123.com',
    password: process.env.ADMIN_PASSWORD || 'Admin@123',
  })).setCookie.match(/op_session=([^;]+)/)[1];

  const blocks = section.blocks.map((b) => (b === block ? { ...b, groups } : b));
  await request('PATCH', `/api/sections/${section.id}`, { blocks }, admin);

  /* Read back through the API — the normaliser is the authority. */
  const back = (await request('GET', '/api/orgs/torii/sections', null, admin)).json.sections;
  const got = back.find((x) => x.id === section.id).blocks.find((b) => b.type === 'photo-ring');
  console.log('  read back:', got.groups.map((g) => `${g.name} (${(g.shots || []).length})`).join(' · '));
})().catch((e) => { console.error('  ERROR ' + e.message); process.exitCode = 1; });
