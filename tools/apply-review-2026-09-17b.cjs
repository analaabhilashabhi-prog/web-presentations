/**
 * The second pass of the 2026-09-17 review, on Torii's deck.
 *
 *   node tools/apply-review-2026-09-17b.cjs [--dry]
 *
 * Needs the app server on 4173, restarted after the schema change that came
 * with this pass (`highlights` on a leader-hero, `onRegister` on a credential),
 * or two of the writes below are silently dropped by the normaliser. Backs the
 * store up first; one PATCH per row.
 *
 * WHAT IT DOES
 * ------------
 *   IT Development — the shelf is cut to the five products asked for, portal
 *   only: MYNA, Torii Minds & JPath, OwlCoder, AI Engineer LMS, TAG. The two
 *   admin consoles go. Three further products are added by name — **Loop**,
 *   **AI Anchor** and **Hibi** — with nothing but their names, because nothing
 *   else was supplied: no logo (so each shows the design's initial disc, as
 *   every file did before the logos arrived), no recording and no site, so the
 *   monitor shows its own "Demo is being prepared" card. Fill them in when the
 *   logos and the copy land; `LOGOS` in `publish-it-development.cjs` is where a
 *   logo goes.
 *
 *   The reviewer said "add two more" and then named three. All three are added:
 *   a name that was said is a name that was wanted, and removing one is a line
 *   in this file, whereas a missing one has to be asked for again.
 *
 *   Certifications — the four badges that are PHOTOGRAPHS of badges rather than
 *   badge artwork are taken off the register's arcs (`onRegister: false`) and
 *   stay everywhere else. They are not hand-picked: every badge in the block was
 *   measured, and these four are exactly the ones whose four corners are opaque
 *   and not white — a brick wall, a dark card, a green sheet, a brown bar —
 *   while all eleven others are transparent artwork. Skills Unlocked draws every
 *   badge, as asked.
 *
 *   CEO Profile — the two experience lines move out of the body paragraph, where
 *   they read as more of the same prose, and become `highlights`: two figures
 *   under the social row. Same words, split into a figure and its description.
 */
const fs = require('fs');
const path = require('path');
const http = require('http');

const ROOT = path.resolve(__dirname, '..');
const DB = path.join(ROOT, 'backend/data/db.json');
const BACKUPS = path.join(ROOT, 'backend/data/backups');
const HOST = { host: '127.0.0.1', port: Number(process.env.PORT) || 4173 };
const DRY = process.argv.includes('--dry');
const ORG = 'torii';

/* The products to keep, in this order, by the name and view each file carries.
   A `view` of '' means the file has no view suffix in its tag. */
const KEEP = [
  { name: 'MYNA', view: '' },
  { name: 'Torii Minds & JPath', view: '' },
  { name: 'OwlCoder', view: '' },
  { name: 'AI Engineer LMS', view: 'Portal' },
  { name: 'TAG', view: 'Portal' },
];

/* Named by the reviewer, nothing else supplied. */
const NEW = ['Loop', 'AI Anchor', 'Hibi'];

/* Badges that are photographs of a badge rather than the artwork. Measured, not
   chosen: these are the files whose corners are all opaque. */
const PHOTO_BADGES = [
  'certifications/torii/redhat-python-programming-course-attendance.png',
  'certifications/torii/codechef.png',
  'certifications/torii/oracle-certified-foundations-associate-database.png',
  'certifications/torii/postman-api-fundamentals-student-expert.png',
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
  const row = (key) => {
    const s = db.sections.find((x) => x.orgId === ORG && x.key === key && !x.parentId);
    if (!s) throw new Error(`no ${key} row on ${ORG}`);
    return s;
  };
  const writes = [];

  /* ---------------------------------------------------- IT Development */
  {
    const s = row('it-development');
    const b = s.blocks[0];
    const viewOf = (p) => {
      const m = /^(Portal|Admin)\s+·/.exec(p.tag || '');
      return m ? m[1] : '';
    };
    const kept = KEEP.map((want) => {
      const hit = b.projects.find((p) => p.name === want.name && viewOf(p) === want.view);
      if (!hit) throw new Error(`no project "${want.name}"${want.view ? ` (${want.view})` : ''}`);
      return hit;
    });
    const dropped = b.projects.filter((p) => !kept.includes(p));
    const added = NEW.filter((n) => !kept.some((p) => p.name === n)).map((name) => ({
      name,
      tag: '',
      description: '',
      features: [],
      stack: [],
      links: { live: '', code: '' },
      media: null,
      site: '',
      logins: [],
    }));
    const projects = [...kept, ...added];
    writes.push({ s, blocks: [{ ...b, projects }],
      note: `IT Development: ${b.projects.length} files -> ${projects.length}\n`
        + `      kept    ${kept.map((p) => p.name + (viewOf(p) ? ` (${viewOf(p)})` : '')).join(', ')}\n`
        + `      dropped ${dropped.map((p) => p.name + (viewOf(p) ? ` (${viewOf(p)})` : '')).join(', ') || 'none'}\n`
        + `      added   ${added.map((p) => p.name).join(', ') || 'none'} — name only, no logo/film/site yet` });
  }

  /* ---------------------------------------------------- Certifications */
  {
    const s = row('certifications');
    const b = s.blocks[0];
    const missing = PHOTO_BADGES.filter((f) => !b.credentials.some((c) => c.badge === f));
    if (missing.length) throw new Error(`badge not on any credential: ${missing.join(', ')}`);
    const credentials = b.credentials.map((c) => (
      PHOTO_BADGES.includes(c.badge) ? { ...c, onRegister: false } : { ...c, onRegister: true }
    ));
    const off = credentials.filter((c) => c.onRegister === false);
    writes.push({ s, blocks: [{ ...b, credentials }],
      note: `Certifications: ${off.length} of ${credentials.length} badges off the register's arcs, all still in Skills Unlocked\n`
        + off.map((c) => `      - ${c.name}`).join('\n') });
  }

  /* --------------------------------------------------------- CEO Profile */
  {
    const s = row('ceo-profile');
    const b = s.blocks[0];
    const line = '12+ years of experience in IBM and Wipro. 10+ years of entrepreneurship experience.';
    const body = b.body.replace(`\n${line}`, '').replace(line, '').trim();
    const highlights = [
      { value: '12+ years', label: 'Experience in IBM and Wipro' },
      { value: '10+ years', label: 'Entrepreneurship experience' },
    ];
    writes.push({ s, blocks: [{ ...b, body, highlights }],
      note: `CEO Profile: the two lines leave the body (${b.body.length} -> ${body.length} chars) and become figures under the social row\n`
        + highlights.map((x) => `      - ${x.value} · ${x.label}`).join('\n') });
  }

  writes.forEach((w) => console.log(`  ${w.note}`));
  if (DRY) { console.log('\n  dry run — nothing written'); return; }

  fs.mkdirSync(BACKUPS, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const saved = path.join(BACKUPS, `db-before-review-b-${stamp}.json`);
  fs.copyFileSync(DB, saved);
  JSON.parse(fs.readFileSync(saved, 'utf8'));
  console.log(`\n  backup  backend/data/backups/${path.basename(saved)}`);

  const admin = (await request('POST', '/api/auth/login', { email: (process.env.ADMIN_EMAIL || 'Torii@123.com'), password: (process.env.ADMIN_PASSWORD || 'Admin@123') }))
    .setCookie.match(/op_session=([^;]+)/)[1];
  for (const w of writes) await request('PATCH', `/api/sections/${w.s.id}`, { blocks: w.blocks }, admin);

  /* Read back what the server kept — the normaliser is the authority. */
  const back = (await request('GET', `/api/orgs/${ORG}/sections`, null, admin)).json.sections;
  const got = (key) => back.find((x) => x.key === key && !x.parentId).blocks[0];
  const it = got('it-development');
  const cs = got('certifications');
  const ceo = got('ceo-profile');
  console.log('');
  console.log(`  IT Development files   ${it.projects.map((p) => p.name).join(', ')}`);
  console.log(`  register badges off    ${cs.credentials.filter((c) => c.onRegister === false).length} (kept by the server: ${cs.credentials.some((c) => c.onRegister === false) ? 'yes' : '!! NO — server not restarted?'})`);
  console.log(`  CEO highlights         ${(ceo.highlights || []).map((x) => x.value + ' ' + x.label).join(' · ') || '!! EMPTY — server not restarted?'}`);
  console.log(`  CEO body ends          ${JSON.stringify(ceo.body.slice(-60))}`);
})().catch((e) => { console.error('  ERROR ' + e.message); process.exitCode = 1; });
