/**
 * Torii's Workspace row — the tab, created empty and waiting for its pictures.
 *
 *   node tools/create-workspace-row.cjs [--dry]
 *
 * WHAT IT DOES
 * ------------
 *   Creates the row if it is not there, PATCHes it if it is, and puts it
 *   immediately after Team. Run it twice and nothing is duplicated: the row is
 *   found by its key. It writes NO BLOCKS — the slide opens on the deck's own
 *   "This section is blank" card until the photographs arrive and a publisher
 *   is written for them.
 *
 * WHY IT IS PUBLISHED AND BLANK RATHER THAN A DRAFT
 * -------------------------------------------------
 *   Six rows were created as drafts once (2026-09-14) so that a presenter
 *   would not be walked into an empty slide, and the user — who works in the
 *   presenter view — could not see them at all, so they could not tell the row
 *   had been made. Published and blank is the shape that was settled on: the
 *   row is visible, it says it is blank, and nothing pretends to be finished.
 *
 *   BEFORE ANY REAL PRESENTATION, if the content has not landed:
 *     node tools/presenter-visibility.cjs --hide workspace
 *   or add `workspace` to Torii's HIDDEN_ROWS in `context/appStore.js`, which
 *   hides it from everyone including an admin.
 *
 * A KEY IS NOT A TITLE ON THIS DECK, and this tool depends on that twice.
 *   Team is keyed `leadership-journey`. Centers of Excellence is keyed `team` —
 *   so anchoring "after Team" on the key `team` would put this row after
 *   Centres of Excellence, three places from where it was asked for. The anchor
 *   below is the key, taken from db.json, with the title it actually carries
 *   printed at run time so a wrong one is visible before anything is written.
 *
 * THE ICON
 *   `building`, from the drawn line library in `utils/icons.js`. There is no
 *   file in `uploads/navicons/` for this key and none is invented: `NAV_ARTWORK`
 *   is keyed by section key, a key with no artwork falls through to that
 *   library, and every row there has a glyph. Drop a `Workspace.svg` beside the
 *   others and add the mapping if the user supplies one.
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
const KEY = 'workspace';
const TITLE = 'Workspace';
const ICON = 'building';
/* The row this one goes after. `leadership-journey` IS the row titled Team. */
const AFTER = 'leadership-journey';

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
        let json = null;
        try { json = JSON.parse(b); } catch { /* 204 */ }
        resolve({ json, setCookie: (res.headers['set-cookie'] || []).join(';') });
      });
    });
    req.on('error', reject);
    if (payload) req.write(payload);
    req.end();
  });
}

const arrow = ' > ';

(async () => {
  const admin = (await request('POST', '/api/auth/login', {
    email: process.env.ADMIN_EMAIL || 'Torii@123.com',
    password: process.env.ADMIN_PASSWORD || 'Admin@123',
  })).setCookie.match(/op_session=([^;]+)/)[1];

  const rows = () => request('GET', `/api/orgs/${ORG}/sections`, null, admin)
    .then((r) => r.json.sections.filter((s) => !s.parentId).sort((a, b) => a.order - b.order));

  const before = await rows();
  const anchor = before.find((s) => s.key === AFTER);
  if (!anchor) throw new Error(`no ${AFTER} row to sit after`);
  console.log(`  anchor    ${anchor.key} — the row titled "${anchor.title}"`);

  const existing = before.find((s) => s.key === KEY);
  console.log(`  row       ${existing ? `exists (${existing.id}) — will not be duplicated` : 'not there yet — will be created'}`);

  if (DRY) {
    const rest = before.filter((s) => s.key !== KEY);
    const at = rest.findIndex((s) => s.key === AFTER) + 1;
    const preview = [...rest.slice(0, at), { title: `[${TITLE}]` }, ...rest.slice(at)];
    console.log('');
    console.log(`  would read  ${preview.map((s) => s.title).join(arrow)}`);
    console.log('');
    console.log('  dry run — nothing written');
    return;
  }

  fs.mkdirSync(BACKUPS, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const saved = path.join(BACKUPS, `db-before-workspace-row-${stamp}.json`);
  fs.copyFileSync(DB, saved);
  JSON.parse(fs.readFileSync(saved, 'utf8'));
  console.log(`  backup    backend/data/backups/${path.basename(saved)}`);

  if (!existing) {
    const made = (await request('POST', `/api/orgs/${ORG}/sections`, {
      key: KEY,
      title: TITLE,
      /* No `intro`. The title cards are off on both decks and a new row must
         not be the one that brings them back. */
      intro: '',
      iconKey: ICON,
      status: 'published',
      hidden: false,
      /* EMPTY ON PURPOSE. Nothing is designed until the user hands the
         photographs over — that is the working agreement here, and a
         placeholder slide is the one thing worse than a blank one. */
      blocks: [],
    }, admin)).json.section;
    console.log(`  created   ${made.id}`);
  } else {
    /* Blocks are deliberately not in this PATCH: once the page is designed,
       re-running this tool must not wipe it. */
    await request('PATCH', `/api/sections/${existing.id}`, {
      title: TITLE, iconKey: ICON, status: 'published', hidden: false,
    }, admin);
    console.log(`  updated   ${existing.id} (blocks left alone)`);
  }

  /* ---------------------------------------------------------- the tab order */
  /* Rebuilt from the order AS IT STANDS rather than from a list written here:
     a hard-coded order in a tool is a tool that silently undoes whatever the
     last reorder did. The whole id list goes to an endpoint that refuses a list
     holding another organization's section, so this cannot reach NGI. */
  const all = await rows();
  const rest = all.filter((s) => s.key !== KEY);
  const at = rest.findIndex((s) => s.key === AFTER) + 1;
  const ordered = [...rest.slice(0, at), all.find((s) => s.key === KEY), ...rest.slice(at)];
  await request('POST', `/api/orgs/${ORG}/sections/reorder`, { order: ordered.map((s) => s.id) }, admin);

  const back = await rows();
  const row = back.find((s) => s.key === KEY);
  const blocks = (row.blocks || []).length;
  console.log('');
  console.log(`  read back  key       ${row.key}`);
  console.log(`             title     ${row.title}`);
  console.log(`             icon      ${row.iconKey}`);
  console.log(`             blocks    ${blocks}${blocks ? '' : '  (blank — opens on the "This section is blank" card)'}`);
  console.log(`             status    ${row.status}${row.hidden ? ' · hidden' : ' · visible'}`);
  console.log(`  tab order  ${back.map((s) => s.title).join(arrow)}`);
})().catch((e) => { console.error('  ERROR ' + e.message); process.exitCode = 1; });
