/**
 * Applies the content changes from the review of 2026-09-17 to Torii's deck.
 *
 *   node tools/apply-review-2026-09-17.cjs [--dry]
 *
 * Needs the app server on 4173 — and the server has to have been restarted
 * after the schema change that came with this review (`logo` on a course-deck
 * card, `videoStart` on a thread-board), or two of the writes below are
 * silently dropped by the normaliser. Every write goes through `PATCH
 * /api/sections/:id`; the store is backed up first.
 *
 * Nothing here is invented: every string is the reviewer's own words, and every
 * reorder keeps the rows it does not name in the order they already had.
 *
 *   1. AI Ready Engineer — "What a student walks away with" gains a fifth card,
 *      "Claude Certification", carrying the Claude Certified Architect badge;
 *      the frames "What the campus gains" and "Step In. Stand Out." go.
 *   3. CEO Profile — two lines of experience appended to the body, on their own
 *      line; nothing existing is reworded.
 *   5. "Executive Summary" is retitled "About".
 *   6. Team — Sudhir, Bhargava, Harshavardhini, Naveen, Abraham first (the
 *      review spelt them Sudheer and Bhargav; the stored names are the
 *      filenames the portraits arrived under and are left as they are).
 *   9. Centers of Excellence — Snowflake, Claude, AWS Academy, Oracle Academy,
 *      Red Hat, GitHub, Cisco Networking Academy, o9 first.
 *  11. Project Street — the film begins at 0:13.
 *  15. Beyond — the "Beyond Boundaries" group, whose first shot is the group
 *      photograph the review supplied, is moved to the front so that photograph
 *      is the card the section opens on. The file was already in the section.
 *  16. Certifications — the same photograph becomes the register's backdrop.
 *
 * Items 2 (title cards) and 8 (row order) are done by the tools that own them:
 * `publish-section-intros.cjs --clear` and `order-torii-rows.cjs`.
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

/** Rows named first, in this order; everything else follows in its own order. */
function prefer(list, names, keyOf) {
  const rank = new Map(names.map((n, i) => [n.toLowerCase(), i]));
  const first = names.map((n) => list.find((x) => keyOf(x).toLowerCase() === n.toLowerCase())).filter(Boolean);
  const missing = names.filter((n) => !first.some((x) => keyOf(x).toLowerCase() === n.toLowerCase()));
  if (missing.length) throw new Error(`not found: ${missing.join(', ')}`);
  const rest = list.filter((x) => !rank.has(keyOf(x).toLowerCase()));
  return [...first, ...rest];
}

(async () => {
  const db = JSON.parse(fs.readFileSync(DB, 'utf8'));
  const row = (key) => {
    const s = db.sections.find((x) => x.orgId === ORG && x.key === key && !x.parentId);
    if (!s) throw new Error(`no ${key} row on ${ORG}`);
    return s;
  };
  const writes = [];

  /* 1. AI Ready Engineer ------------------------------------------------ */
  {
    const s = row('ai-ready-engineer');
    const b = s.blocks[0];
    if (b.type !== 'course-deck') throw new Error('AI Ready Engineer is not a course-deck');
    const drop = new Set(['What the campus gains', 'Step In. Stand Out.']);
    const frames = b.frames.filter((f) => !drop.has(f.title));
    if (frames.length !== b.frames.length - 2) throw new Error(`expected to drop 2 frames, dropped ${b.frames.length - frames.length}`);
    const walk = frames.find((f) => f.title === 'What a student walks away with');
    if (!walk) throw new Error('no "What a student walks away with" frame');
    const already = walk.items.some((i) => i.title === 'Claude Certification');
    const items = already ? walk.items : [...walk.items, {
      title: 'Claude Certification',
      body: '',
      icon: 'certificate',
      logo: 'Claude/claude-certified-architect.png',
    }];
    const next = frames.map((f) => (f === walk ? { ...f, items } : f));
    writes.push({ s, blocks: [{ ...b, frames: next }],
      note: `AI Ready Engineer: ${b.frames.length} frames -> ${next.length}; "${walk.title}" ${already ? 'already has' : 'gains'} Claude Certification (${items.length} cards)` });
  }

  /* 3. CEO Profile -------------------------------------------------------- */
  {
    const s = row('ceo-profile');
    const b = s.blocks[0];
    const add = '12+ years of experience in IBM and Wipro. 10+ years of entrepreneurship experience.';
    const body = b.body.includes(add) ? b.body : `${b.body}\n${add}`;
    writes.push({ s, blocks: [{ ...b, body }], note: `CEO Profile: body ${b.body.includes(add) ? 'already carries' : 'gains'} the two experience lines (${body.length}/900 chars)` });
  }

  /* 5. Executive Summary -> About ----------------------------------------- */
  {
    const s = row('company-profile');
    writes.push({ s, title: 'About', note: `"${s.title}" -> "About"` });
  }

  /* 6. Team order --------------------------------------------------------- */
  {
    const s = row('leadership-journey');
    const b = s.blocks[0];
    const members = prefer(b.members, ['Sudhir', 'Bhargava', 'Harshavardhini', 'Naveen', 'Abraham'], (m) => m.name);
    if (members.length !== b.members.length) throw new Error('team count changed');
    writes.push({ s, blocks: [{ ...b, members }], note: `Team: ${members.slice(0, 6).map((m) => m.name).join(', ')}, … (${members.length} members, none dropped)` });
  }

  /* 9. Centers of Excellence order --------------------------------------- */
  {
    const s = row('team');
    const b = s.blocks[0];
    const centers = prefer(b.centers, ['Snowflake', 'Claude', 'AWS Academy', 'Oracle Academy', 'Red Hat', 'GitHub', 'Cisco Networking Academy', 'o9'], (c) => c.name);
    if (centers.length !== b.centers.length) throw new Error('centre count changed');
    writes.push({ s, blocks: [{ ...b, centers }], note: `Centers of Excellence: ${centers.slice(0, 8).map((c) => c.name).join(', ')}, then ${centers.length - 8} more in their old order` });
  }

  /* 11. Project Street film from 0:13 ------------------------------------ */
  {
    const s = row('project-street');
    const b = s.blocks[0];
    writes.push({ s, blocks: [{ ...b, videoStart: 13 }], note: 'Project Street: film begins at 0:13' });
  }

  /* 15. Beyond: the group photograph leads ------------------------------- */
  {
    const s = row('beyond');
    const b = s.blocks[0];
    const groups = prefer(b.groups, ['Beyond Boundaries'], (g) => g.name);
    const lead = groups[0].shots[0];
    if (!/beyond-boundaries\/01\.jpg$/.test(lead.src)) throw new Error(`unexpected leading shot ${lead.src}`);
    writes.push({ s, blocks: [{ ...b, groups }], note: `Beyond: groups ${groups.map((g) => g.name).join(' · ')}; opens on ${lead.src} (${lead.w}x${lead.h})` });
  }

  /* 16. Certifications backdrop ------------------------------------------ */
  {
    const s = row('certifications');
    const b = s.blocks[0];
    const backdrop = 'Beyond/beyond-boundaries/01.jpg';
    if (!fs.existsSync(path.join(ROOT, 'backend/uploads', backdrop))) throw new Error(`${backdrop} is not in uploads`);
    writes.push({ s, blocks: [{ ...b, backdrop }], note: `Certifications: backdrop ${JSON.stringify(b.backdrop)} -> ${JSON.stringify(backdrop)}` });
  }

  writes.forEach((w) => console.log(`  ${w.note}`));
  if (DRY) { console.log('\n  dry run — nothing written'); return; }

  fs.mkdirSync(BACKUPS, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const saved = path.join(BACKUPS, `db-before-review-${stamp}.json`);
  fs.copyFileSync(DB, saved);
  JSON.parse(fs.readFileSync(saved, 'utf8'));
  console.log(`\n  backup  backend/data/backups/${path.basename(saved)}`);

  const admin = (await request('POST', '/api/auth/login', { email: (process.env.ADMIN_EMAIL || 'Torii@123.com'), password: (process.env.ADMIN_PASSWORD || 'Admin@123') }))
    .setCookie.match(/op_session=([^;]+)/)[1];
  for (const w of writes) {
    const patch = {};
    if (w.blocks) patch.blocks = w.blocks;
    if (w.title) patch.title = w.title;
    await request('PATCH', `/api/sections/${w.s.id}`, patch, admin);
  }

  /* Read back what the server kept — the normaliser is the authority. */
  const back = (await request('GET', `/api/orgs/${ORG}/sections`, null, admin)).json.sections;
  const got = (key) => back.find((x) => x.key === key && !x.parentId);
  const cd = got('ai-ready-engineer').blocks[0];
  const walk = cd.frames.find((f) => f.title === 'What a student walks away with');
  const claude = walk.items.find((i) => i.title === 'Claude Certification');
  const checks = [
    ['AI Ready Engineer frames', cd.frames.map((f) => f.title).join(' | ')],
    ['Claude Certification logo kept by the server', claude ? claude.logo || '!! EMPTY — server not restarted?' : '!! card missing'],
    ['CEO body ends', JSON.stringify(got('ceo-profile').blocks[0].body.slice(-90))],
    ['About', got('company-profile').title],
    ['Team first five', got('leadership-journey').blocks[0].members.slice(0, 5).map((m) => m.name).join(', ')],
    ['CoE first eight', got('team').blocks[0].centers.slice(0, 8).map((c) => c.name).join(', ')],
    ['Project Street videoStart', String(got('project-street').blocks[0].videoStart)],
    ['Beyond first group', got('beyond').blocks[0].groups[0].name],
    ['Certifications backdrop', got('certifications').blocks[0].backdrop],
  ];
  console.log('');
  checks.forEach(([k, v]) => console.log(`  ${k.padEnd(44)} ${v}`));
})().catch((e) => { console.error('  ERROR ' + e.message); process.exitCode = 1; });
