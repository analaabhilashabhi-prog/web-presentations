/**
 * Corrects the CASE of every /uploads path stored in the deck.
 *
 *   node tools/fix-uploads-path-case.cjs [--dry]
 *
 * Why this exists. Windows resolves a filename whatever its case, Linux does
 * not — so a block pointing at `Snapshot/torii-logo.png` when the file on disk
 * is `snapshot/torii-logo.png` works perfectly on the machine the deck is built
 * on and 404s the moment it is deployed. A CSS mask or an <img> whose file 404s
 * draws nothing at all rather than complaining, so the failure is silent
 * everywhere except in front of the room.
 *
 * Found 2026-09-18: the Torii mark was missing from three slides on Render —
 * the Centres of Excellence hub, the drift wall's middle and the IT Development
 * brand mark — while all three were correct locally. 77 other references into
 * that same folder used the real lowercase name, so the folder was right and
 * the three references were wrong.
 *
 * It only ever changes case. A path with no case-insensitive match on disk is
 * reported and left exactly as it is: that is a missing file, which is a
 * different problem and not one to paper over by guessing.
 */
const fs = require('fs');
const path = require('path');
const http = require('http');

const ROOT = path.resolve(__dirname, '..');
const DB = path.join(ROOT, 'backend/data/db.json');
const UPLOADS = path.join(ROOT, 'backend/uploads');
const BACKUPS = path.join(ROOT, 'backend/data/backups');
const HOST = { host: '127.0.0.1', port: Number(process.env.PORT) || 4173 };
const DRY = process.argv.includes('--dry');
const MEDIA = /\.(png|jpe?g|webp|gif|svg|mp4|webm|mov|avi|mkv)$/i;

/* Every real path under uploads, relative and with its true case. */
function walkDisk(dir, prefix = '') {
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const rel = prefix ? `${prefix}/${entry.name}` : entry.name;
    if (entry.isDirectory()) out.push(...walkDisk(path.join(dir, entry.name), rel));
    else out.push(rel);
  }
  return out;
}

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
        if (res.statusCode >= 400) return reject(new Error(`${method} ${p} -> ${res.statusCode} ${b.slice(0, 200)}`));
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
  const real = walkDisk(UPLOADS);
  const exact = new Set(real);
  const byLower = new Map();
  for (const p of real) byLower.set(p.toLowerCase(), p);
  /* A bare filename is not a path. Several blocks store one and resolve it
     against a folder the component knows (a coe-wall's logos, a wall's `base`),
     so judging it against the root would report hundreds of files as missing
     that are on disk one directory down — which is exactly the false positive
     a media check here produced once before. Basenames let those be told apart
     from a genuine absence. */
  const baseNames = new Set(real.map((p) => p.split('/').pop()));

  const db = JSON.parse(fs.readFileSync(DB, 'utf8'));
  const fixes = [];
  const missing = [];

  /* Rewrites a stored string, keeping whatever prefix form it was written in —
     '/uploads/x', 'uploads/x' and bare 'x' are all in use. */
  const correct = (value, where, base) => {
    if (typeof value !== 'string' || !MEDIA.test(value)) return value;
    const m = /^(\/?uploads\/)?(.*)$/.exec(value);
    const prefix = m[1] || '';
    const [bare] = m[2].split(/[#?]/);
    const tail = m[2].slice(bare.length);
    if (!bare) return value;

    /* A stored path is resolved either from the uploads root or from the
       block's own `base` folder — placement-wall and its three other callers
       store `Journeys/banner-1.jpg` under `base: 'Placements'`. Both forms have
       to be tried, and a correction has to be written back in the SAME form it
       was stored in, or the component would look in the wrong place. */
    const under = base ? `${base}/${bare}` : null;
    if (exact.has(bare) || (under && exact.has(under))) return value;

    const rootHit = byLower.get(bare.toLowerCase());
    const baseHit = under ? byLower.get(under.toLowerCase()) : null;

    if (baseHit) {
      /* Keep it base-relative: strip the base the same length it was matched. */
      const rel = baseHit.slice(baseHit.length - bare.length);
      if (rel === bare) return value;
      const fixed = `${prefix}${rel}${tail}`;
      fixes.push({ where, from: value, to: fixed });
      return fixed;
    }
    if (rootHit) {
      const fixed = `${prefix}${rootHit}${tail}`;
      fixes.push({ where, from: value, to: fixed });
      return fixed;
    }
    /* Resolved by its component against a folder of its own: present, and not
       this tool's business. Only a name that is nowhere on disk is reported. */
    if (!bare.includes('/') && baseNames.has(bare)) return value;
    missing.push({ where, value });
    return value;
  };

  const deep = (node, where, base) => {
    if (typeof node === 'string') return correct(node, where, base);
    if (Array.isArray(node)) return node.map((n) => deep(n, where, base));
    if (node && typeof node === 'object') {
      const out = {};
      for (const k of Object.keys(node)) out[k] = deep(node[k], where, base);
      return out;
    }
    return node;
  };

  /* The folder a block's relative paths hang off. `placement-wall` falls back to
     'Placements' in the component itself (PlacementWall.js: `block.base ||
     'Placements'`), so a block that stores no base is still resolving against
     that folder and this has to agree with it — read it from there if it ever
     changes rather than trusting this copy. */
  const baseOf = (b) => {
    if (typeof b.base === 'string' && b.base) return b.base.replace(/^\/+|\/+$/g, '');
    if (b.type === 'placement-wall') return 'Placements';
    return null;
  };

  const touched = [];
  for (const section of db.sections) {
    const before = fixes.length;
    /* Per block, because `base` is a block field. */
    const blocks = (section.blocks || []).map(
      (b) => deep(b, `${section.orgId}/${section.key}`, baseOf(b)),
    );
    if (fixes.length > before) touched.push({ section, blocks });
  }

  if (!fixes.length) {
    console.log('  every stored /uploads path already matches the case on disk — nothing to do');
  } else {
    console.log(`  ${fixes.length} path${fixes.length === 1 ? '' : 's'} whose case does not match disk:`);
    for (const f of fixes) console.log(`      ${f.where}\n        ${f.from}\n     -> ${f.to}`);
  }
  if (missing.length) {
    console.log(`\n  ${missing.length} path${missing.length === 1 ? '' : 's'} with no file on disk at any case — LEFT ALONE, this is a missing file:`);
    for (const m of missing.slice(0, 20)) console.log(`      ${m.where}  ${m.value}`);
  }
  if (DRY) { console.log('\n  dry run — nothing written'); return; }
  if (!touched.length) return;

  fs.mkdirSync(BACKUPS, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const saved = path.join(BACKUPS, `db-before-path-case-${stamp}.json`);
  fs.copyFileSync(DB, saved);
  JSON.parse(fs.readFileSync(saved, 'utf8'));
  console.log(`\n  backup  backend/data/backups/${path.basename(saved)}`);

  const admin = (await request('POST', '/api/auth/login', {
    email: process.env.ADMIN_EMAIL || 'Torii@123.com',
    password: process.env.ADMIN_PASSWORD || 'Admin@123',
  })).setCookie.match(/op_session=([^;]+)/)[1];

  for (const t of touched) {
    await request('PATCH', `/api/sections/${t.section.id}`, { blocks: t.blocks }, admin);
    console.log(`  patched ${t.section.orgId}/${t.section.key}`);
  }

  /* Read back through the API — the normaliser is the authority on what stuck. */
  let stillWrong = 0;
  for (const t of touched) {
    const back = (await request('GET', `/api/orgs/${t.section.orgId}/sections`, null, admin)).json.sections;
    const got = back.find((x) => x.id === t.section.id);
    const j = JSON.stringify(got.blocks);
    for (const f of fixes) if (f.where.endsWith(t.section.key) && j.includes(f.from)) stillWrong++;
  }
  console.log(`\n  read back: ${stillWrong === 0 ? 'every path corrected' : `!! ${stillWrong} still wrong`}`);
})().catch((e) => { console.error('  ERROR ' + e.message); process.exitCode = 1; });
