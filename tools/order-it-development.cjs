/**
 * The order of the files on Torii's IT Development shelf.
 *
 *   node tools/order-it-development.cjs [--dry]
 *
 * Needs the app server. Backs the store up first.
 *
 * The order was given by name (2026-09-18): MYNA, AI Engineer, TAG, Loop,
 * AI Anchor, Hibi, "after that, the remaining". So ORDER below is the six that
 * were named, in that order, and anything else keeps its own relative order
 * behind them — a product added later lands at the end rather than silently
 * disappearing, which is what a hard-coded list of eight would do.
 *
 * The names are matched loosely (case, spaces and punctuation ignored) because
 * the shelf's own names carry ampersands and view suffixes: the row called
 * "AI Engineer" on the shelf is "AI Engineer LMS".
 */
const fs = require('fs');
const path = require('path');
const http = require('http');

const ROOT = path.resolve(__dirname, '..');
const DB = path.join(ROOT, 'backend/data/db.json');
const BACKUPS = path.join(ROOT, 'backend/data/backups');
const HOST = { host: '127.0.0.1', port: Number(process.env.PORT) || 4173 };
const DRY = process.argv.includes('--dry');

const ORDER = ['MYNA', 'AI Engineer', 'TAG', 'Loop', 'AI Anchor', 'Hibi'];

const key = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9]/g, '');

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
        if (res.statusCode >= 400) return reject(new Error(`${method} ${p} -> ${res.statusCode} ${b.slice(0, 250)}`));
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
  const section = db.sections.find((s) => s.orgId === 'torii' && s.key === 'it-development' && !s.parentId);
  if (!section) throw new Error('no it-development row');
  const block = section.blocks.find((b) => b.type === 'project-showcase');
  if (!block) throw new Error('it-development holds no project-showcase');

  const left = [...block.projects];
  const named = [];
  for (const want of ORDER) {
    /* Starts-with rather than equals: "AI Engineer" is "AI Engineer LMS" on the
       shelf. Longest match first would be safer with more products; with these
       eight there is exactly one candidate each, and the check below proves it. */
    const hits = left.filter((p) => key(p.name).startsWith(key(want)));
    if (hits.length !== 1) {
      throw new Error(`"${want}" matched ${hits.length} projects (${hits.map((p) => p.name).join(', ') || 'none'})`);
    }
    named.push(hits[0]);
    left.splice(left.indexOf(hits[0]), 1);
  }
  const projects = [...named, ...left];

  console.log('  IT Development, in order:');
  projects.forEach((p, i) => console.log(`    ${String(i + 1).padStart(2)}  ${p.name}${named.includes(p) ? '' : '   (not named — kept behind, in its old order)'}`));
  if (DRY) { console.log('\n  dry run — nothing written'); return; }

  fs.mkdirSync(BACKUPS, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const saved = path.join(BACKUPS, `db-before-itdev-order-${stamp}.json`);
  fs.copyFileSync(DB, saved);
  JSON.parse(fs.readFileSync(saved, 'utf8'));
  console.log(`\n  backup  backend/data/backups/${path.basename(saved)}`);

  const admin = (await request('POST', '/api/auth/login', {
    email: process.env.ADMIN_EMAIL || 'Torii@123.com',
    password: process.env.ADMIN_PASSWORD || 'Admin@123',
  })).setCookie.match(/op_session=([^;]+)/)[1];

  const blocks = section.blocks.map((b) => (b === block ? { ...b, projects } : b));
  await request('PATCH', `/api/sections/${section.id}`, { blocks }, admin);

  const back = (await request('GET', '/api/orgs/torii/sections', null, admin)).json.sections;
  const got = back.find((x) => x.id === section.id).blocks.find((b) => b.type === 'project-showcase');
  console.log(`\n  read back  ${got.projects.map((p) => p.name).join(' · ')}`);
})().catch((e) => { console.error('  ERROR ' + e.message); process.exitCode = 1; });
