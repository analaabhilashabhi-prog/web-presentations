/**
 * The 2026-09-19 changes, on Torii: the AI Ready Engineer cover card.
 *
 *   node tools/apply-review-2026-09-19.cjs [--dry]
 *
 * Needs the app server. Backs the store up first. No schema change, so no
 * restart — `stats` has held a free-text value and label since it was written.
 *
 * WHAT IT DOES
 * ------------
 *   The first of the cover's three cards read "16 · Modules". It now reads
 *   "Offline · Classroom Training" (2026-09-19, asked for twice: "in AI Ready
 *   Engineer we have 16 modules, right? So instead of that, I want offline
 *   training to be replaced", after "I want you to show offline classes or like
 *   offline structure").
 *
 *   NO NUMBER IS INVENTED. A card in that row is a figure and a word, and the
 *   figure here is a mode of delivery rather than a count, because no count of
 *   offline sessions, days or hours has ever been supplied. "Offline" is the
 *   whole of what was asked for and the whole of what is written.
 *
 *   The second frame keeps its title, "16 Modules. End to End.", and the course
 *   still has sixteen of them. What changed is what the cover advertises: the
 *   room is being told the training is delivered in person, which is the thing
 *   a college wants to know and which no other card on that slide says. The
 *   curriculum is still named on the slide after it.
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

/* The card that replaces "16 Modules". Both halves are here, so changing the
   wording when the user's own arrives is one edit in one place. */
const OFFLINE = { value: 'Offline', label: 'Classroom Training' };

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
  const aire = db.sections.find((x) => x.orgId === ORG && x.key === 'ai-ready-engineer' && !x.parentId);
  if (!aire) throw new Error(`no ai-ready-engineer row on ${ORG}`);
  const deck = aire.blocks[0];

  /* Found by what it is, not by where it is: the card whose label is Modules.
     Matching on index would rewrite whichever card happened to be first after
     some later pass reorders them, and matching on "16" would break the moment
     the curriculum grows. A second run finds no Modules card and changes
     nothing, which is the behaviour wanted. */
  const at = deck.stats.findIndex((s) => /modules/i.test(s.label || ''));
  if (at < 0) {
    console.log(`  nothing to do — no "Modules" card; the row reads ${deck.stats.map((s) => `${s.value} ${s.label}`).join(' · ')}`);
    return;
  }
  const stats = deck.stats.map((s, i) => (i === at ? { ...OFFLINE } : s));
  const blocks = [{ ...deck, stats }];

  console.log('  AI Ready Engineer');
  console.log(`    was   ${deck.stats.map((s) => `${s.value} ${s.label}`).join(' · ')}`);
  console.log(`    now   ${stats.map((s) => `${s.value} ${s.label}`).join(' · ')}`);
  console.log(`    frame ${deck.frames.map((f) => f.title).join(' | ')}   (untouched)`);

  if (DRY) { console.log('\n  dry run — nothing written'); return; }

  fs.mkdirSync(BACKUPS, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const saved = path.join(BACKUPS, `db-before-review-2026-09-19-${stamp}.json`);
  fs.copyFileSync(DB, saved);
  JSON.parse(fs.readFileSync(saved, 'utf8'));
  console.log(`\n  backup  backend/data/backups/${path.basename(saved)}`);

  const admin = (await request('POST', '/api/auth/login', {
    email: process.env.ADMIN_EMAIL || 'Torii@123.com',
    password: process.env.ADMIN_PASSWORD || 'Admin@123',
  })).setCookie.match(/op_session=([^;]+)/)[1];

  await request('PATCH', `/api/sections/${aire.id}`, { blocks }, admin);

  const back = (await request('GET', `/api/orgs/${ORG}/sections`, null, admin)).json.sections;
  const got = back.find((x) => x.id === aire.id).blocks[0];
  console.log(`  read back  ${got.stats.map((s) => `${s.value} ${s.label}`).join(' · ')}`);
})().catch((e) => { console.error('  ERROR ' + e.message); process.exitCode = 1; });
