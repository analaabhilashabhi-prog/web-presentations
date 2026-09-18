/**
 * The 2026-09-18 review, on Torii: AI Ready Engineer, and the tab order.
 *
 *   node tools/apply-review-2026-09-18.cjs [--dry]
 *
 * Needs the app server, restarted after the schema change this pass depends on
 * (`logo` on a partner, `figure`/`badge` on a frame, `photo` on an item, and
 * 'split'/'people' added to the frame kinds) — without the restart the write is
 * silently normalised and the ten-portrait team frame becomes a list of names.
 * Backs the store up first.
 *
 * WHAT IT DOES
 * ------------
 *   The overview (the deck's cover) loses the credential seal and gains a third
 *   figure, "300+ Hours of Training", so the three cards read 16 Modules ·
 *   50+ AI tools & platforms · 300+ Hours. The seal's own certification is not
 *   lost from the section — it moves to the modules frame as its badge, which
 *   is the slide it is about.
 *
 *   The AI partners are drawn rather than set: the official Claude Partner
 *   Network and OpenAI Select Partner lockups the user supplied. Sarvam AI was
 *   asked for and no file of it exists anywhere in Downloads, so it keeps the
 *   typographic treatment beside them — this deck's standing rule is that a
 *   hand-traced vendor mark is worse than a name in type. Drop the file in, put
 *   its path in SARVAM below, and it becomes a logo like the other two.
 *
 *   Two frames go, which is what makes the modules frame the second slide and
 *   removes the fourth. The deck's views are the cover and then the frames in
 *   order, so with "Built to make engineers" and "What a student walks away
 *   with" both out it reads: cover -> 16 Modules -> the team. Both are kept
 *   whole in the backup this writes.
 *
 *   The team frame is retitled "Claude Certified Architect Team".
 *
 *   And the CEO Profile row moves to the very end, after Organization Snapshot.
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

/* Put a path under /uploads here when the Sarvam mark arrives. */
const SARVAM = '';

const PARTNERS = [
  { name: 'Claude Partner Network', note: 'Member', logo: 'Claude/claude-partner-network.jpeg' },
  { name: 'OpenAI Select Partner', note: '', logo: 'Claude/openai-select-partner.jpeg' },
  { name: 'Sarvam AI', note: 'Partnership', logo: SARVAM },
];

/* The frames to keep, by the title each carries. Anything else is dropped. */
const KEEP_FRAMES = ['16 Modules. End to End.', 'Claude Certified Architect — 10 Team Members'];

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

  /* ------------------------------------------------- AI Ready Engineer */
  const aire = row('ai-ready-engineer');
  const deck = aire.blocks[0];

  const stats = [
    ...deck.stats.filter((s) => !/hours/i.test(s.label || '')),
    { value: '300+', label: 'Hours of Training' },
  ];

  const seal = deck.credential;
  const kept = KEEP_FRAMES.map((t) => {
    const f = deck.frames.find((x) => x.title === t);
    if (!f) throw new Error(`no frame titled "${t}" — have: ${deck.frames.map((x) => x.title).join(' | ')}`);
    return f;
  });
  const dropped = deck.frames.filter((f) => !kept.includes(f));

  const frames = kept.map((f) => {
    if (f.kind === 'modules') {
      /* The seal leaves the cover and lands on the slide it is about. */
      return { ...f, badge: 'Claude/claude-certified-architect.png', badgeAlt: `${seal.ring} — ${seal.name}` };
    }
    if (f.kind === 'people') return { ...f, title: 'Claude Certified Architect Team' };
    return f;
  });

  const aireBlocks = [{ ...deck, stats, credential: null, partners: PARTNERS, frames }];

  console.log('  AI Ready Engineer');
  console.log(`    cards      ${stats.map((s) => `${s.value} ${s.label}`).join(' · ')}`);
  console.log('    seal       off the cover, now the modules frame badge');
  console.log(`    partners   ${PARTNERS.map((p) => p.name + (p.logo ? ' [logo]' : ' [type]')).join(' · ')}`);
  console.log(`    frames     ${deck.frames.length} -> ${frames.length}`);
  console.log(`      kept     ${kept.map((f) => f.title).join(' | ')}`);
  console.log(`      dropped  ${dropped.map((f) => f.title).join(' | ') || 'none'}`);
  console.log(`    team       retitled, ${frames.find((f) => f.kind === 'people').items.length} members`);

  /* ------------------------------------------------------- the tab order */
  /* The rows switched off in `context/appStore.js`. They are parked at the end
     of the stored order on purpose, so switching one back on puts it after the
     deck rather than in the middle of a sequence somebody chose — and CEO has
     to land before them, or "last" would mean last behind four rows nobody can
     see. */
  const HIDDEN = ['placements', 'industry-alliances', 'history-milestones', 'success-stories', 'testimonials'];

  const all = db.sections
    .filter((s) => s.orgId === ORG && !s.parentId)
    .sort((a, b) => a.order - b.order);
  const ceo = all.find((s) => s.key === 'ceo-profile');
  if (!ceo) throw new Error('no ceo-profile row');
  const shown = all.filter((s) => s !== ceo && !HIDDEN.includes(s.key));
  const parked = all.filter((s) => s !== ceo && HIDDEN.includes(s.key));
  if (shown[shown.length - 1]?.key !== 'organization-snapshot') {
    throw new Error(`expected Organization Snapshot last, found ${shown[shown.length - 1]?.key}`);
  }
  const ordered = [...shown, ceo, ...parked];
  const order = ordered.map((s) => s.id);
  console.log('');
  console.log('  Tab order — CEO Profile last of what is shown');
  console.log('    shown   ' + [...shown, ceo].map((s) => s.title).join(' > '));
  console.log('    parked  ' + parked.map((s) => s.title).join(' > ') + '   (switched off in appStore)');

  if (DRY) { console.log('\n  dry run — nothing written'); return; }

  fs.mkdirSync(BACKUPS, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const saved = path.join(BACKUPS, `db-before-review-2026-09-18-${stamp}.json`);
  fs.copyFileSync(DB, saved);
  JSON.parse(fs.readFileSync(saved, 'utf8'));
  console.log(`\n  backup  backend/data/backups/${path.basename(saved)}`);

  const admin = (await request('POST', '/api/auth/login', {
    email: process.env.ADMIN_EMAIL || 'Torii@123.com',
    password: process.env.ADMIN_PASSWORD || 'Admin@123',
  })).setCookie.match(/op_session=([^;]+)/)[1];

  await request('PATCH', `/api/sections/${aire.id}`, { blocks: aireBlocks }, admin);
  await request('POST', `/api/orgs/${ORG}/sections/reorder`, { order }, admin);

  /* Read back through the API — the normaliser is the authority on what stuck. */
  const back = (await request('GET', `/api/orgs/${ORG}/sections`, null, admin)).json.sections;
  const got = back.find((x) => x.id === aire.id).blocks[0];
  const people = got.frames.find((f) => f.kind === 'people');
  console.log('');
  console.log(`  read back  cards      ${got.stats.map((s) => s.value + ' ' + s.label).join(' · ')}`);
  console.log(`             credential ${got.credential ? '!! STILL THERE' : 'gone'}`);
  console.log(`             partners   ${got.partners.map((p) => p.name + (p.logo ? ' [logo]' : ' [type]')).join(' · ')}`);
  console.log(`             frames     ${got.frames.map((f) => `${f.kind}:${f.title}`).join(' | ')}`);
  console.log(`             badge      ${got.frames.find((f) => f.kind === 'modules')?.badge || '!! DROPPED — server not restarted?'}`);
  console.log(`             team       ${people ? `${people.items.length} members, ${people.items.filter((i) => i.photo).length} with a portrait` : '!! NOT a people frame — server not restarted?'}`);
  const rows = back.filter((s) => !s.parentId).sort((a, b) => a.order - b.order);
  console.log(`  tab order  ${rows.map((s) => s.title).join(' > ')}`);
})().catch((e) => { console.error('  ERROR ' + e.message); process.exitCode = 1; });
