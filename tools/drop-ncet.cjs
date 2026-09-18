/**
 * Removes the NCET organization and renames NGI's tab.
 *
 *   node tools/drop-ncet.cjs [--dry] [--name "NGI and NCET"]
 *
 * **Stop the server first.** The store is held in memory and written back on
 * every change, so an edit made to `db.json` under a running server is lost the
 * next time anything is published. This edits the file directly because there is
 * no DELETE route for an organization — `org.routes.js` has list, get, create
 * and update, and nothing else.
 *
 * WHAT GOES
 * ---------
 * The `ncet` organization and all nineteen of its sections: the fifteen rows
 * that mirrored NGI plus the four pages under Governance Council. Checked before
 * writing: no user, session or template mentions it, and the router sends a
 * stale `/o/ncet/...` URL to the organization list rather than to an error.
 *
 * WHAT STAYS
 * ----------
 * The backup, which is the way back — everything removed here is in it, whole.
 * NCET's palette stays in `config/themes.js`, unused, so a restore needs nothing
 * but the backup. And its photographs stay in `uploads/`: assets are shared
 * across organizations and there is no delete route for them either; 73 of the
 * 85 NCET referenced are used by no other deck, and they are left where they
 * are rather than hunted down, because a wrong guess there is unrecoverable and
 * an unused file is only bytes.
 *
 * THE RENAME
 * ----------
 * The tab draws `shortName || name`, so both are set. With two organizations
 * left the strip is two 1fr columns, which is room enough for the longer name.
 */
const fs = require('fs');
const path = require('path');
const http = require('http');

const ROOT = path.resolve(__dirname, '..');
const DB = path.join(ROOT, 'backend/data/db.json');
const BACKUPS = path.join(ROOT, 'backend/data/backups');

const arg = (n, d = null) => {
  const i = process.argv.indexOf(`--${n}`);
  return i > -1 && process.argv[i + 1] && !process.argv[i + 1].startsWith('--') ? process.argv[i + 1] : d;
};
const DRY = process.argv.includes('--dry');
const DROP = 'ncet';
const KEEP = 'technical-hub';
const NAME = arg('name', 'NGI and NCET');

/** Every assetId reachable from a set of sections. */
function assetsOf(sections) {
  const ids = new Set();
  const walk = (v) => {
    if (!v) return;
    if (Array.isArray(v)) return v.forEach(walk);
    if (typeof v !== 'object') return;
    for (const [k, x] of Object.entries(v)) {
      if (k === 'assetId' && typeof x === 'string') ids.add(x);
      else if (k === 'assetIds' && Array.isArray(x)) x.forEach((i) => ids.add(i));
      else walk(x);
    }
  };
  sections.forEach((s) => walk(s.blocks));
  return ids;
}

(async () => {
  /* A running server would write its own copy back over this one. */
  const up = await new Promise((resolve) => {
    const req = http.get({ host: '127.0.0.1', port: Number(process.env.PORT) || 4173, path: '/', timeout: 1500 }, (r) => { r.resume(); resolve(true); });
    req.on('error', () => resolve(false));
    req.on('timeout', () => { req.destroy(); resolve(false); });
  });
  if (up && !DRY) throw new Error('the server is running — stop it first, or this edit will be overwritten');

  const db = JSON.parse(fs.readFileSync(DB, 'utf8'));
  const org = db.organizations.find((o) => o.id === DROP);
  const keep = db.organizations.find((o) => o.id === KEEP);
  if (!keep) throw new Error(`no "${KEEP}" organization to rename`);
  if (!org) console.log(`  "${DROP}" is already gone`);

  const doomed = db.sections.filter((s) => s.orgId === DROP);
  const top = doomed.filter((s) => !s.parentId);
  console.log(`  ${DROP}: ${doomed.length} sections (${top.length} rows + ${doomed.length - top.length} pages under them)`);
  top.sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
    .forEach((s) => console.log(`     ${String(s.order).padStart(3)}  ${JSON.stringify(s.title)}`));

  /* Nothing else may point at it. */
  const blob = JSON.stringify({ users: db.users, sessions: db.sessions, templates: db.templates });
  if (blob.includes(`"${DROP}"`)) throw new Error('a user, session or template still references it — stopping');

  const mine = assetsOf(doomed);
  const others = assetsOf(db.sections.filter((s) => s.orgId !== DROP));
  const orphaned = [...mine].filter((id) => !others.has(id));
  console.log(`  assets: ${mine.size} referenced, ${orphaned.length} of them by no other deck — left in the library, see the note above`);

  console.log(`\n  ${KEEP}: "${keep.name}" / "${keep.shortName}"  ->  "${NAME}" / "${NAME}"`);
  console.log(`  organizations after: ${db.organizations.filter((o) => o.id !== DROP).map((o) => o.id).join(', ')}`);
  if (DRY) { console.log('\n  dry run — nothing written'); return; }

  fs.mkdirSync(BACKUPS, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const saved = path.join(BACKUPS, `db-before-drop-ncet-${stamp}.json`);
  fs.copyFileSync(DB, saved);
  JSON.parse(fs.readFileSync(saved, 'utf8'));
  console.log(`\n  backup  backend/data/backups/${path.basename(saved)}`);

  db.organizations = db.organizations.filter((o) => o.id !== DROP);
  db.sections = db.sections.filter((s) => s.orgId !== DROP);
  keep.name = NAME;
  keep.shortName = NAME;
  keep.updatedAt = new Date().toISOString();
  /* NGI is first in the strip and should stay first. */
  db.organizations.sort((a, b) => (a.order ?? 0) - (b.order ?? 0)).forEach((o, i) => { o.order = i; });

  fs.writeFileSync(DB, `${JSON.stringify(db, null, 2)}\n`);
  const back = JSON.parse(fs.readFileSync(DB, 'utf8'));
  console.log(`  written: ${back.organizations.length} organizations (${back.organizations.map((o) => `${o.id} "${o.shortName}" order ${o.order}`).join(' · ')})`);
  console.log(`  sections: ${back.sections.length} left, ${back.sections.filter((s) => s.orgId === DROP).length} still on "${DROP}"`);
})().catch((e) => { console.error('  ERROR ' + e.message); process.exitCode = 1; });
