/**
 * Flattens the deck: every page becomes a section of its own.
 *
 * Organization Overview and Leadership were groups — a nav row that opened a
 * list rather than a slide. Two groups out of fourteen rows is a rule the deck
 * does not otherwise follow, so the pages come up a level and the two group
 * wrappers go:
 *
 *   Organization Overview  →  Executive Summary   (it always was the hero; the
 *                                                  curated label said so while
 *                                                  the stored title did not)
 *     Organization Snapshot →  its own section
 *     History & Milestones  →  its own section
 *   Leadership             →  deleted, it holds no blocks at all
 *     CEO Profile          →  its own section
 *     Leadership Journey    →  its own section
 *     Success Stories       →  its own section
 *     CEO Vision            →  deleted on request
 *
 * Every section is then given an explicit `iconKey`, because a section's own
 * mark outranks the curated one in `SideNav.sectionGlyph` — leaving them unset
 * meant the pane and any other reader of the data could disagree.
 *
 *   node tools/flatten-navigation.cjs --dry     # say what would change
 *   node tools/flatten-navigation.cjs           # do it
 *
 * Safe to run twice: each step checks the current shape first.
 */
const http = require('http');

const HOST = { host: '127.0.0.1', port: Number(process.env.PORT) || 4173 };
const ORG = 'technical-hub';
const DRY = process.argv.includes('--dry');

/* The deck in presenting order, keyed by the section key, with the icon each one
   is to carry. Fourteen rows, fourteen distinct glyphs — a repeated glyph is a
   row the eye cannot tell from its neighbour. */
const DECK = [
  ['company-profile', 'Executive Summary', 'team-cycle'],
  ['organization-snapshot', 'Organization Snapshot', 'camera-photo'],
  ['history-milestones', 'History & Milestones', 'roadmap'],
  ['ceo-profile', 'CEO Profile', 'ceo-podium'],
  ['leadership-journey', 'Leadership Journey', 'climb-steps'],
  ['success-stories', 'Success Stories', 'rosette'],
  ['programs', 'Programs', 'www-globe'],
  ['team', 'Centers of Excellence', 'handshake-check'],
  ['certifications', 'Certifications', 'seal-check'],
  ['placements', 'Placements', 'job-pin'],
  ['achievements', 'Events', 'event-sign'],
  ['testimonials', 'Video Resumes', 'clapper'],
  ['ai-ready-engineer', 'AI Ready Engineer', 'ai-figure'],
  ['platforms', 'Platforms', 'tap-network'],
];

/* Wrappers with nothing on them, and the one page asked to go. */
const DELETE = ['ceo-vision', 'ceo-message'];

function request(method, path, body, cookie) {
  return new Promise((resolve, reject) => {
    const payload = body ? JSON.stringify(body) : null;
    const headers = {};
    if (payload) {
      headers['content-type'] = 'application/json';
      headers['content-length'] = Buffer.byteLength(payload);
    }
    if (cookie) headers.cookie = `op_session=${cookie}`;
    const req = http.request({ ...HOST, path, method, headers }, (res) => {
      let b = '';
      res.on('data', (d) => { b += d; });
      res.on('end', () => {
        if (res.statusCode >= 400) {
          return reject(new Error(`${method} ${path} -> ${res.statusCode} ${b.slice(0, 240)}`));
        }
        let json = null;
        try { json = JSON.parse(b); } catch { /* 204s carry no body */ }
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
  const token = /op_session=([^;]+)/.exec(r.setCookie)?.[1];
  if (!token) throw new Error('login returned no session cookie');
  return token;
};

(async () => {
  const admin = await login('admin@org.local', 'Admin@123');
  const load = async () => (await request('GET', `/api/orgs/${ORG}/sections`, null, admin)).json.sections;
  let all = await load();
  const byKey = (key) => all.find((s) => s.key === key);

  console.log(`  ${all.length} sections before${DRY ? '   (dry run — nothing will be written)' : ''}\n`);

  /* 1. Up a level. Done before either delete, so no page is ever orphaned by the
        removal of the parent it still points at. */
  for (const [key] of DECK) {
    const s = byKey(key);
    if (!s) { console.log(`  ??  no section keyed ${key}`); continue; }
    if (!s.parentId) continue;
    console.log(`  up   ${s.title}`);
    if (!DRY) await request('PATCH', `/api/sections/${s.id}`, { parentId: null }, admin);
  }

  // 2. The wrappers and CEO Vision.
  for (const key of DELETE) {
    const s = byKey(key);
    if (!s) continue;
    const blocks = (s.blocks || []).length;
    console.log(`  del  ${s.title}  (${blocks} block${blocks === 1 ? '' : 's'})`);
    if (!DRY) await request('DELETE', `/api/sections/${s.id}`, null, admin);
  }

  // 3. Titles and icons.
  for (const [key, title, iconKey] of DECK) {
    const s = byKey(key);
    if (!s) continue;
    const patch = {};
    if (s.title !== title) patch.title = title;
    if (s.iconKey !== iconKey) patch.iconKey = iconKey;
    if (!Object.keys(patch).length) continue;
    console.log(`  set  ${title.padEnd(24)} ${JSON.stringify(patch)}`);
    if (!DRY) await request('PATCH', `/api/sections/${s.id}`, patch, admin);
  }

  // 4. Presenting order.
  if (!DRY) {
    all = await load();
    const order = DECK.map(([key]) => all.find((s) => s.key === key)).filter(Boolean).map((s) => s.id);
    const stragglers = all.filter((s) => !order.includes(s.id)).map((s) => s.id);
    if (stragglers.length) console.log(`  ..   ${stragglers.length} section(s) not in the deck list, kept at the end`);
    await request('POST', `/api/orgs/${ORG}/sections/reorder`, { order: [...order, ...stragglers] }, admin);
  }

  all = await load();
  console.log(`\n  ${all.length} sections after:`);
  for (const s of all.sort((a, b) => a.order - b.order)) {
    console.log(`    ${String(s.order).padStart(2)}  ${String(s.iconKey || '-').padEnd(13)}`
      + `${(s.blocks || []).length} block${(s.blocks || []).length === 1 ? ' ' : 's'}  ${s.title}`
      + (s.parentId ? '   [still a child]' : ''));
  }
  const nested = all.filter((s) => s.parentId);
  const glyphs = new Set(all.map((s) => s.iconKey));
  console.log(`\n  nested: ${nested.length}   distinct icons: ${glyphs.size} of ${all.length}`);
})().catch((e) => { console.error('  ERROR ' + e.message); process.exitCode = 1; });
