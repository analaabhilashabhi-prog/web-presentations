/**
 * Torii's AI Partners row — the stack of pinned cards.
 *
 *   node tools/publish-ai-partners.cjs [--dry]
 *
 * Needs the app server, restarted after the schema change this depends on
 * (`scroll-stack` in BLOCK_TYPES and its case in `normalizeBlock`) — without
 * the restart the store holds the old normaliser, every field below is dropped
 * and the row publishes as an empty paragraph. Backs `db.json` up first.
 *
 * WHAT IT DOES
 * ------------
 *   Creates the row if it is not there, rewrites its block, and puts it
 *   immediately before AI Ready Engineer. Run it twice and nothing is
 *   duplicated: the row is found by its key and PATCHed.
 *
 * WHERE THE WORDS AND THE COLOURS COME FROM, because both are rules here
 * ---------------------------------------------------------------------
 *   - **The marks are the ones the user supplied**, already in the library.
 *     Three are the official partner lockups — Claude Partner Network (Member),
 *     OpenAI Select Partner, and the sarvam wordmark — filed under
 *     `uploads/Claude/` for the AI Ready Engineer slide. GitHub has no partner
 *     lockup anywhere, so it takes the plain GitHub wordmark from `uploads/coe`,
 *     which is the file the Centres of Excellence wall already draws. NOTHING
 *     IS HAND-DRAWN: a card with no artwork stands in type instead.
 *
 *   - **`note` is what the lockup itself says**, never a claim beyond it.
 *     "Claude Partner Network · Member" is printed on the badge. GitHub's
 *     "GitHub Campus Program" is the line printed on the pavilion signage in
 *     the NT Square photographs, so it is the user's own too.
 *
 *   - **`tagline` is the deck's own.** Claude, OpenAI and GitHub each already
 *     carry one on the Centres of Excellence block and those are reused
 *     verbatim rather than rewritten. Sarvam has no entry anywhere in the deck;
 *     its line describes the vendor as the vendor publishes itself, which is
 *     the same licence the Certifications skills lines take, and it is the one
 *     line on this slide to replace first.
 *
 *   - **`color` is measured, not chosen.** Claude, OpenAI and GitHub take the
 *     hex already stored against them on the Centres of Excellence block.
 *     Sarvam had none, so its mark was measured: 60,684 ink pixels over a
 *     1600x542 wordmark, mean #3F3F3F.
 *
 *   - **`points` hold only what the deck can already show.** Claude's four and
 *     GitHub's three are written down elsewhere in this deck — the ten
 *     Architect trainers, the two badges on AI Ready Engineer, the Centres of
 *     Excellence list, the Campus Program signage. SARVAM'S ARE DELIBERATELY
 *     EMPTY. Nothing about that partnership is recorded anywhere, and an
 *     invented line on a partner's card is worse on a college's screen than a
 *     short card. The component draws no rule and no list when there are none.
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
const KEY = 'ai-partners';
const BEFORE = 'ai-ready-engineer';

const BLOCK = {
  type: 'scroll-stack',
  layout: { x: 0, y: 0, w: 12, h: 15 },
  eyebrow: 'PARTNERSHIPS',
  title: 'AI Partners',
  lead: 'The platforms Torii builds and teaches on, and the standing each one is held at.',
  partners: [
    {
      name: 'Claude',
      note: 'Claude Partner Network · Member',
      tagline: 'Applied AI, agents & assistants',
      logo: 'Claude/claude-partner-network.jpeg',
      logoAlt: 'Claude Partner Network — Member',
      color: '#D97757',
      points: [
        '10 Claude Certified Architect trainers',
        'Claude Certified Associate for students',
        'Centre of Excellence partner',
        'Carried through the AI Ready Engineer curriculum',
      ],
    },
    {
      name: 'OpenAI',
      note: 'OpenAI Select Partner',
      tagline: 'Generative AI & LLMs',
      logo: 'Claude/openai-select-partner.jpeg',
      logoAlt: 'OpenAI Select Partner',
      color: '#10A37F',
      points: [
        'Centre of Excellence partner',
        'Generative AI across the curriculum',
      ],
    },
    {
      name: 'Sarvam AI',
      note: 'Partnership',
      /* The one line on this slide with no source in the deck. Replace it. */
      tagline: 'Indian-language foundation models',
      logo: 'Claude/sarvam-ai.jpeg',
      logoAlt: 'sarvam',
      color: '#3F3F3F',
      points: [],
    },
    {
      name: 'GitHub',
      note: 'GitHub Campus Program',
      tagline: 'DevOps, source & collaboration',
      logo: 'coe/github full.png',
      logoAlt: 'GitHub',
      color: '#8B7ED8',
      points: [
        'Centre of Excellence partner',
        'GitHub Experience Center at NT Square',
        'Student Developer Pack on campus',
      ],
    },
  ],
};

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
  /* Every mark has to be on disk before the row goes up. A reference that
     resolves nowhere draws nothing at all rather than complaining, so the only
     symptom of a wrong path is a blank plate — and on Linux a wrong CASE is a
     wrong path, which this deck has been caught by once already. */
  for (const p of BLOCK.partners) {
    if (!p.logo) continue;
    const abs = path.join(ROOT, 'backend/uploads', p.logo);
    if (!fs.existsSync(abs)) throw new Error(`no such mark on disk: uploads/${p.logo}`);
    const dir = path.dirname(abs);
    const base = path.basename(abs);
    if (!fs.readdirSync(dir).includes(base)) throw new Error(`case mismatch: uploads/${p.logo}`);
  }
  console.log(`  marks     ${BLOCK.partners.filter((p) => p.logo).length}/${BLOCK.partners.length} on disk, case checked`);

  console.log('');
  BLOCK.partners.forEach((p, i) => {
    console.log(`  ${String(i + 1).padStart(2, '0')}  ${p.name.padEnd(10)} ${p.color}  ${p.note}`);
    console.log(`      ${p.tagline}`);
    console.log(`      ${p.points.length ? p.points.join(' · ') : '(no points — nothing about this partner is written down yet)'}`);
  });

  if (DRY) { console.log('\n  dry run — nothing written'); return; }

  fs.mkdirSync(BACKUPS, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const saved = path.join(BACKUPS, `db-before-ai-partners-${stamp}.json`);
  fs.copyFileSync(DB, saved);
  JSON.parse(fs.readFileSync(saved, 'utf8'));
  console.log(`\n  backup    backend/data/backups/${path.basename(saved)}`);

  const admin = (await request('POST', '/api/auth/login', {
    email: process.env.ADMIN_EMAIL || 'Torii@123.com',
    password: process.env.ADMIN_PASSWORD || 'Admin@123',
  })).setCookie.match(/op_session=([^;]+)/)[1];

  const rowsNow = (await request('GET', `/api/orgs/${ORG}/sections`, null, admin)).json.sections
    .filter((s) => !s.parentId);
  let row = rowsNow.find((s) => s.key === KEY);

  if (!row) {
    row = (await request('POST', `/api/orgs/${ORG}/sections`, {
      key: KEY,
      title: 'AI Partners',
      /* No `intro`: the title cards are off on both decks and a new row must
         not be the one that brings them back. */
      intro: '',
      /* The pane has no artwork for this key, so it falls through to the drawn
         line library — where `partners` is a real glyph. */
      iconKey: 'partners',
      status: 'published',
      hidden: false,
      blocks: [BLOCK],
    }, admin)).json.section;
    console.log(`  created   ${row.id}`);
  } else {
    await request('PATCH', `/api/sections/${row.id}`, {
      title: 'AI Partners', status: 'published', hidden: false, blocks: [BLOCK],
    }, admin);
    console.log(`  updated   ${row.id} (already existed — not duplicated)`);
  }

  /* --------------------------------------------------------- the tab order */
  /* Rebuilt from the order as it stands rather than from a list written here:
     a hard-coded order in a tool is a tool that silently undoes whatever the
     last reorder did. The whole id list goes to an endpoint that refuses a list
     holding another organization's section, so this cannot reach NGI. */
  const all = (await request('GET', `/api/orgs/${ORG}/sections`, null, admin)).json.sections
    .filter((s) => !s.parentId)
    .sort((a, b) => a.order - b.order);
  const target = all.find((s) => s.key === BEFORE);
  if (!target) throw new Error(`no ${BEFORE} row to sit before`);
  const rest = all.filter((s) => s.key !== KEY);
  const at = rest.findIndex((s) => s.key === BEFORE);
  const ordered = [...rest.slice(0, at), all.find((s) => s.key === KEY), ...rest.slice(at)];
  await request('POST', `/api/orgs/${ORG}/sections/reorder`, { order: ordered.map((s) => s.id) }, admin);

  /* Read back through the API — the normaliser is the authority on what stuck. */
  const back = (await request('GET', `/api/orgs/${ORG}/sections`, null, admin)).json.sections
    .filter((s) => !s.parentId)
    .sort((a, b) => a.order - b.order);
  const got = back.find((s) => s.key === KEY).blocks[0];
  console.log('');
  console.log(`  read back  type      ${got.type}${got.type === 'scroll-stack' ? '' : '  !! NORMALISED AWAY — server not restarted?'}`);
  console.log(`             partners  ${(got.partners || []).map((p) => p.name).join(' · ') || '!! DROPPED'}`);
  console.log(`             marks     ${(got.partners || []).filter((p) => p.logo).length} with a logo, ${(got.partners || []).filter((p) => p.color).length} with a colour`);
  console.log(`  tab order  ${back.map((s) => s.title).join(' > ')}`);
})().catch((e) => { console.error('  ERROR ' + e.message); process.exitCode = 1; });
