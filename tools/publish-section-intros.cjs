/**
 * Gives every navigation row a title card.
 *
 *   node tools/publish-section-intros.cjs [--org all|torii|technical-hub] [--dry] [--clear]
 *
 * Needs the app server on 4173. Goes through `PATCH /api/sections/:id`.
 *
 * WHAT A TITLE CARD IS
 * --------------------
 * A section carrying a non-empty `intro` gets `slide--intro` in `SlideView`,
 * which draws the string full-screen over the slide, letter by letter, and
 * publishes `--intro-hold: 3s` that every entrance animation on that slide adds
 * to its own delay — so the page behind arrives only once the card has gone.
 * Four of NGI's pages had one (Profile of the Society, Governing Body, Academic
 * Council, Faculty Strength) and nothing else did; the request (2026-09-17) was
 * for every tab in both decks to announce itself the same way.
 *
 * THE TEXT IS THE ROW'S OWN TITLE
 * -------------------------------
 * Not a second name written here. The card says what the pane says and what the
 * dock's Next tab button says, so the room hears one name for one thing — and
 * renaming a row renames its card with no second place to remember. The field
 * is capped at 120 characters server-side; no title is near it.
 *
 * The four pages that already had one keep it: their text is their own title
 * too, so this changes nothing about them and the run is idempotent.
 *
 * --clear takes every card off again, which is the way back.
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
const ORG = arg('org', 'all');
const DRY = process.argv.includes('--dry');
const CLEAR = process.argv.includes('--clear');

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
  const orgs = ORG === 'all' ? [...new Set(db.sections.map((s) => s.orgId))] : [ORG];
  const targets = db.sections
    .filter((s) => orgs.includes(s.orgId))
    .sort((a, b) => (a.orgId + String(a.order).padStart(3, '0')).localeCompare(b.orgId + String(b.order).padStart(3, '0')));
  if (!targets.length) throw new Error(`no sections on ${orgs.join(', ')}`);

  const plan = targets.map((s) => {
    const want = CLEAR ? '' : String(s.title || '').trim();
    return { s, want, from: String(s.intro || ''), changed: String(s.intro || '') !== want };
  });

  let org = null;
  for (const { s, want, from, changed } of plan) {
    if (s.orgId !== org) { org = s.orgId; console.log(`\n  ${org}`); }
    const where = s.parentId ? '  (page)' : '        ';
    console.log(`   ${String(s.order).padStart(2)}${where} ${JSON.stringify(s.title).padEnd(28)} ${changed ? `${JSON.stringify(from)} -> ${JSON.stringify(want)}` : 'already right'}`);
  }
  const todo = plan.filter((p) => p.changed);
  console.log(`\n  ${todo.length} to change, ${plan.length - todo.length} already as asked`);
  if (DRY) { console.log('  dry run — nothing written'); return; }
  if (!todo.length) { console.log('  nothing to do'); return; }

  fs.mkdirSync(BACKUPS, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const saved = path.join(BACKUPS, `db-before-intros-${stamp}.json`);
  fs.copyFileSync(DB, saved);
  JSON.parse(fs.readFileSync(saved, 'utf8'));
  console.log(`  backup  backend/data/backups/${path.basename(saved)}`);

  const admin = (await request('POST', '/api/auth/login', { email: (process.env.ADMIN_EMAIL || 'Torii@123.com'), password: (process.env.ADMIN_PASSWORD || 'Admin@123') }))
    .setCookie.match(/op_session=([^;]+)/)[1];
  for (const { s, want } of todo) await request('PATCH', `/api/sections/${s.id}`, { intro: want }, admin);

  /* Read back from the API, not from the file: the server holds the store in
     memory and is the thing that decides what was stored. */
  let wrong = 0;
  for (const o of orgs) {
    const back = (await request('GET', `/api/orgs/${o}/sections`, null, admin)).json.sections;
    const bad = back.filter((s) => String(s.intro || '') !== (CLEAR ? '' : String(s.title || '').trim()));
    wrong += bad.length;
    console.log(`  ${o}: ${back.length} sections, ${back.filter((s) => s.intro).length} carrying a title card${bad.length ? ` — ${bad.length} WRONG: ${bad.map((s) => s.title).join(', ')}` : ''}`);
  }
  console.log(wrong ? `  !! ${wrong} section(s) did not take` : '  every section says its own name');
})().catch((e) => { console.error('  ERROR ' + e.message); process.exitCode = 1; });
