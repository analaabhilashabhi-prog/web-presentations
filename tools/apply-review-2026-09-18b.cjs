/**
 * The 2026-09-18 review, second pass: NT Square's copy and its two buttons.
 *
 *   node tools/apply-review-2026-09-18b.cjs [--dry]
 *
 * Needs the app server. Backs the store up first.
 *
 * WHAT IT DOES
 * ------------
 *   The slide loses its eyebrow and its headline — "NT Square", "Torii, on
 *   campus." and "Step IN. Stand OUT." — on request: the section is the
 *   photographs, and the hand turns on its own now, so every row the copy took
 *   came off the pictures.
 *
 *   The headline was never the user's own (this brief has said so since it was
 *   written: there is still no description of NT Square anywhere, and both
 *   lines were read off the signage in the photographs). So nothing authored is
 *   lost here — it is in the backup either way.
 *
 *   Two buttons remain and no others: "See Inside", and the deck's own pill,
 *   relabelled "Get Git Experience Center". The pill takes its words from
 *   `deck.label`, so renaming it is a field and not a line of code.
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

(async () => {
  const db = JSON.parse(fs.readFileSync(DB, 'utf8'));
  const section = db.sections.find((s) => s.orgId === ORG && s.key === 'nt-square' && !s.parentId);
  if (!section) throw new Error('no nt-square row');
  const fan = section.blocks.find((b) => b.type === 'card-fan');
  if (!fan) throw new Error('nt-square holds no card-fan');

  const buttons = (fan.buttons || []).map((b) => ({ ...b, label: 'See Inside' }));
  const deck = { ...fan.deck, label: 'Get Git Experience Center' };
  const blocks = section.blocks.map((b) => (b !== fan ? b : {
    ...b, eyebrow: '', title: '', buttons, deck,
  }));

  console.log('  NT Square');
  console.log(`    eyebrow  ${JSON.stringify(fan.eyebrow)} -> ""`);
  console.log(`    title    ${JSON.stringify(fan.title)} -> ""`);
  console.log(`    buttons  ${buttons.map((b) => b.label).join(' · ')} + deck pill "${deck.label}"`);
  console.log(`    cards    ${(fan.cards || []).length} in the hand, ${(fan.deck?.photos || []).length} behind the pill`);
  if (DRY) { console.log('\n  dry run — nothing written'); return; }

  fs.mkdirSync(BACKUPS, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const saved = path.join(BACKUPS, `db-before-ntsquare-copy-${stamp}.json`);
  fs.copyFileSync(DB, saved);
  JSON.parse(fs.readFileSync(saved, 'utf8'));
  console.log(`\n  backup  backend/data/backups/${path.basename(saved)}`);

  const admin = (await request('POST', '/api/auth/login', {
    email: process.env.ADMIN_EMAIL || 'Torii@123.com',
    password: process.env.ADMIN_PASSWORD || 'Admin@123',
  })).setCookie.match(/op_session=([^;]+)/)[1];
  await request('PATCH', `/api/sections/${section.id}`, { blocks }, admin);

  const back = (await request('GET', `/api/orgs/${ORG}/sections`, null, admin)).json.sections;
  const got = back.find((x) => x.id === section.id).blocks.find((b) => b.type === 'card-fan');
  console.log('');
  console.log(`  read back  eyebrow ${JSON.stringify(got.eyebrow)} · title ${JSON.stringify(got.title)}`);
  console.log(`             buttons ${got.buttons.map((b) => b.label).join(' · ')} · deck "${got.deck.label}"`);
})().catch((e) => { console.error('  ERROR ' + e.message); process.exitCode = 1; });
