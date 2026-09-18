/**
 * Sets the order of Torii's navigation rows.
 *
 *   node tools/order-torii-rows.cjs [--org torii] [--dry]
 *
 * Needs the app server on 4173. Goes through `POST /orgs/:id/sections/reorder`,
 * which takes the whole list of section ids in the order wanted and refuses a
 * list holding a section from another organization — so this cannot reach the
 * other deck by accident.
 *
 * THE ORDER IS THE USER'S
 * -----------------------
 * Thirteen rows were named (2026-09-17): Executive Summary, CEO Profile, Team,
 * Trainings, Centers of Excellence, Certifications, Placements, Torii Connect,
 * Project Week, Project Street, NT Square, Beyond, and IT Development last.
 *
 * Amended the same day — **Placements and Events go after Beyond**, so the run
 * of Torii's own occasions (Torii Connect, Project Week, Project Street, NT
 * Square, Beyond) now closes the deck's middle and the two record rows follow
 * it. IT Development stays last, which is the one position the user has named
 * twice.
 *
 * TWO WERE NOT NAMED, AND ARE PLACED BY WHAT THEY ARE
 * ---------------------------------------------------
 * The deck has sixteen rows showing. Events was one of the unnamed three until
 * the amendment named it; two are still placed by what they are, and neither is
 * inserted between two rows the user named consecutively:
 *
 *   - **Organization Snapshot** after Team. It is the wall of the whole
 *     photograph library — every event, training, placement and certification at
 *     once — so it reads as the bridge from who Torii is (summary, CEO, team)
 *     into what it does. The first three keep the positions they were given.
 *   - **AI Ready Engineer** after Trainings. It is a programme, and Trainings is
 *     the programmes shelf; they belong side by side.
 *
 * Events keeps its place beside Placements rather than being re-derived: the
 * user moved the pair together, so they stay a pair, in the order they were in.
 *
 * THE FOUR SWITCHED-OFF ROWS GO LAST
 * ----------------------------------
 * Industry Alliances, History & Milestones, Success Stories and Video Resumes
 * are hidden by `HIDDEN_ROWS` in `context/appStore.js`, not by anything in the
 * store, so they still carry an order. They are parked after IT Development so
 * that switching one back on puts it at the end rather than in the middle of a
 * sequence somebody chose.
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
const DRY = process.argv.includes('--dry');

/* Section keys, in the order the rows should read. A key is not a title — Team
   is keyed `leadership-journey`, Centers of Excellence is keyed `team`, Events
   is keyed `achievements` and Video Resumes is keyed `testimonials` — so these
   come from `db.json`, never from the names. */
/* The review of 2026-09-17 (afternoon) set this sequence outright, About first
   and Organization Snapshot last. It named fifteen rows; Placements was not
   among them and nothing may be removed, so it follows the fifteen. */
const ORDER = [
  ['company-profile', 'review: 1 — About'],
  ['ceo-profile', 'review: 2'],
  ['leadership-journey', 'review: 3 — Team'],
  ['programs', 'review: 4 — Trainings'],
  ['team', 'review: 5 — Centers of Excellence'],
  ['certifications', 'review: 6'],
  ['ai-ready-engineer', 'review: 7'],
  ['torii-connect', 'review: 8'],
  ['nt-square', 'review: 9'],
  ['project-week', 'review: 10'],
  ['project-street', 'review: 11'],
  ['beyond', 'review: 12'],
  ['achievements', 'review: 13 — Events'],
  ['it-development', 'review: 14'],
  ['organization-snapshot', 'review: 15, last'],
  ['placements', 'not named by the review; kept, after the fifteen'],
  /* switched off in code — parked at the end */
  ['industry-alliances', 'switched off'],
  ['history-milestones', 'switched off'],
  ['success-stories', 'switched off'],
  ['testimonials', 'switched off'],
];

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
  const rows = db.sections.filter((s) => s.orgId === ORG && !s.parentId);
  const byKey = new Map(rows.map((s) => [s.key, s]));

  const missing = ORDER.filter(([k]) => !byKey.has(k)).map(([k]) => k);
  if (missing.length) throw new Error(`these keys are not rows on "${ORG}": ${missing.join(', ')}`);
  const unlisted = rows.filter((s) => !ORDER.some(([k]) => k === s.key));
  if (unlisted.length) throw new Error(`these rows are not in ORDER and would be left where they are: ${unlisted.map((s) => s.key).join(', ')}`);

  /* Child pages keep their own order under their parent; the reorder endpoint
     wants every section of the organization, so they follow the rows. */
  const pages = db.sections.filter((s) => s.orgId === ORG && s.parentId);
  const ids = [...ORDER.map(([k]) => byKey.get(k).id), ...pages.map((s) => s.id)];

  console.log(`  ${ORG}: ${rows.length} rows${pages.length ? ` (+${pages.length} child pages, order untouched)` : ''}`);
  ORDER.forEach(([k, why], i) => {
    const s = byKey.get(k);
    const moved = s.order === i ? '' : `   was ${s.order}`;
    console.log(`  ${String(i + 1).padStart(2)}  ${JSON.stringify(s.title).padEnd(26)} ${why.padEnd(46)}${moved}`);
  });
  if (DRY) { console.log('\n  dry run — nothing written'); return; }

  fs.mkdirSync(BACKUPS, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const saved = path.join(BACKUPS, `db-before-order-${ORG}-${stamp}.json`);
  fs.copyFileSync(DB, saved);
  JSON.parse(fs.readFileSync(saved, 'utf8'));
  console.log(`\n  backup  backend/data/backups/${path.basename(saved)}`);

  const admin = (await request('POST', '/api/auth/login', { email: (process.env.ADMIN_EMAIL || 'Torii@123.com'), password: (process.env.ADMIN_PASSWORD || 'Admin@123') }))
    .setCookie.match(/op_session=([^;]+)/)[1];
  await request('POST', `/api/orgs/${ORG}/sections/reorder`, { order: ids }, admin);

  const back = (await request('GET', `/api/orgs/${ORG}/sections`, null, admin)).json.sections
    .filter((s) => !s.parentId).sort((a, b) => a.order - b.order);
  const wrong = back.filter((s, i) => s.key !== ORDER[i][0]);
  console.log(`  stored: ${back.map((s) => s.title).join(' · ')}`);
  console.log(wrong.length ? `  !! ${wrong.length} row(s) did not land where asked` : '  every row landed where it was asked to');
})().catch((e) => { console.error('  ERROR ' + e.message); process.exitCode = 1; });
