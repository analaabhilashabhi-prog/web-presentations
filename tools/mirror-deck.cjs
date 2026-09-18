/**
 * Mirrors one organization's deck into another: every section, its blocks, its
 * children and its running order.
 *
 *   node tools/mirror-deck.cjs --from technical-hub --to torii --replace
 *   node tools/mirror-deck.cjs --from technical-hub --to ncet
 *   node tools/mirror-deck.cjs ... --dry
 *
 * Needs the app server on 4173.
 *
 * WHAT IS COPIED
 * --------------
 * The raw stored blocks, read straight out of db.json rather than from the API.
 * The API hands back *hydrated* sections — assets resolved to URLs, films merged
 * in from Videos.xlsx — and pushing that back through `create` would normalise a
 * merged list as if it were stored content and double it on the next hydrate.
 * The stored shape round-trips through the normaliser unchanged; that is what
 * it is for.
 *
 * Block ids are stripped so the copies get their own, the way `duplicate` does.
 * Asset ids are kept: the library is shared across organizations, so a copied
 * photograph is the same file, not a second upload.
 *
 * Section keys are kept too. The navigation artwork and the curated labels are
 * both keyed on the section key, so a mirrored deck lights up with the same
 * glyphs and names without touching SideNav.
 *
 * --replace deletes whatever the target already holds first. Without it the
 * copies are appended after the target's own sections. Either way a backup of
 * db.json is written to backend/data/backups/ before the first write.
 */
const fs = require('fs');
const path = require('path');
const http = require('http');

const ROOT = path.resolve(__dirname, '..');
const DB = path.join(ROOT, 'backend/data/db.json');
const BACKUPS = path.join(ROOT, 'backend/data/backups');
const HOST = { host: '127.0.0.1', port: Number(process.env.PORT) || 4173 };

const arg = (name, fallback = null) => {
  const i = process.argv.indexOf(`--${name}`);
  return i > -1 && process.argv[i + 1] && !process.argv[i + 1].startsWith('--') ? process.argv[i + 1] : fallback;
};
const FROM = arg('from');
const TO = arg('to');
const REPLACE = process.argv.includes('--replace');
const DRY = process.argv.includes('--dry');

function request(method, path_, body, cookie) {
  return new Promise((resolve, reject) => {
    const payload = body ? JSON.stringify(body) : null;
    const headers = {};
    if (payload) {
      headers['content-type'] = 'application/json';
      headers['content-length'] = Buffer.byteLength(payload);
    }
    if (cookie) headers.cookie = `op_session=${cookie}`;
    const req = http.request({ ...HOST, path: path_, method, headers }, (res) => {
      let b = '';
      res.on('data', (d) => { b += d; });
      res.on('end', () => {
        if (res.statusCode >= 400) {
          return reject(new Error(`${method} ${path_} -> ${res.statusCode} ${b.slice(0, 300)}`));
        }
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

const login = async (email, password) => {
  const r = await request('POST', '/api/auth/login', { email, password });
  const token = /op_session=([^;]+)/.exec(r.setCookie)?.[1];
  if (!token) throw new Error('login returned no session cookie');
  return token;
};

/* Same as the server's own: the copies get fresh ids from the normaliser. */
function stripIds(blocks) {
  return (blocks || []).map(({ id, children, ...rest }) => ({
    ...rest,
    ...(children ? { children: stripIds(children) } : {}),
  }));
}

function backup() {
  fs.mkdirSync(BACKUPS, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const dest = path.join(BACKUPS, `db-before-mirror-${TO}-${stamp}.json`);
  fs.copyFileSync(DB, dest);
  // Prove it is a whole file and not a torn read of an in-flight write.
  JSON.parse(fs.readFileSync(dest, 'utf8'));
  return dest;
}

(async () => {
  if (!FROM || !TO) throw new Error('need --from <orgId> and --to <orgId>');
  if (FROM === TO) throw new Error('--from and --to are the same organization');

  const admin = await login((process.env.ADMIN_EMAIL || 'Torii@123.com'), (process.env.ADMIN_PASSWORD || 'Admin@123'));

  const orgs = (await request('GET', '/api/orgs', null, admin)).json.organizations;
  const src = orgs.find((o) => o.id === FROM);
  const dst = orgs.find((o) => o.id === TO);
  if (!src) throw new Error(`no organization "${FROM}"`);
  if (!dst) throw new Error(`no organization "${TO}" — create it first`);

  /* Raw, from disk. See the header for why not the API. */
  const db = JSON.parse(fs.readFileSync(DB, 'utf8'));
  const source = db.sections.filter((s) => s.orgId === FROM).sort((a, b) => a.order - b.order);
  const tops = source.filter((s) => !s.parentId);
  const kids = source.filter((s) => s.parentId);
  const blocks = source.reduce((n, s) => n + (s.blocks || []).length, 0);

  console.log(`\n  ${src.name}  ->  ${dst.name}${DRY ? '   (dry run — nothing will be written)' : ''}`);
  console.log(`  ${source.length} sections (${tops.length} top-level, ${kids.length} children), ${blocks} blocks\n`);

  const existing = (await request('GET', `/api/orgs/${TO}/sections`, null, admin)).json.sections;
  if (existing.length && !REPLACE) {
    console.log(`  ${dst.name} already holds ${existing.length} section(s); copies will be appended.`);
    console.log('  Pass --replace to clear them first.\n');
  }

  if (DRY) {
    for (const s of source) {
      console.log(`  ${s.parentId ? '   └ ' : '  '}${(s.key || '').padEnd(24)} ${String((s.blocks || []).length).padStart(2)} block(s)  ${s.title}`);
    }
    if (REPLACE && existing.length) console.log(`\n  would delete ${existing.length} existing section(s) in ${dst.name}`);
    return;
  }

  const saved = backup();
  console.log(`  backup  ${path.relative(ROOT, saved)}`);

  if (REPLACE && existing.length) {
    /* Children first, so no parent is ever removed from under a page that
       still points at it. */
    const order = [...existing.filter((s) => s.parentId), ...existing.filter((s) => !s.parentId)];
    for (const s of order) {
      await request('DELETE', `/api/sections/${s.id}`, null, admin);
    }
    console.log(`  cleared ${existing.length} section(s) from ${dst.name}`);
  }

  /* Tops first, then children with the parent id mapped across. `create`
     appends at the end of the target's order, so the running order is
     restated once everything is in. */
  const idMap = new Map();
  const copy = async (s) => {
    const made = (await request('POST', `/api/orgs/${TO}/sections`, {
      key: s.key,
      title: s.title,
      subtitle: s.subtitle || '',
      intro: s.intro || '',
      icon: s.icon || '',
      iconKey: s.iconKey || '',
      iconAssetId: s.iconAssetId || null,
      parentId: s.parentId ? idMap.get(s.parentId) || null : null,
      hidden: Boolean(s.hidden),
      status: s.status === 'published' ? 'published' : 'draft',
      blocks: stripIds(s.blocks || []),
    }, admin)).json.section;
    idMap.set(s.id, made.id);
    console.log(`  ${s.parentId ? '   └ ' : '  '}${(s.key || '').padEnd(24)} ${made.id}  ${s.title}`);
    return made;
  };
  for (const s of tops) await copy(s);
  for (const s of kids) await copy(s);

  await request('POST', `/api/orgs/${TO}/sections/reorder`, {
    order: [...tops, ...kids].map((s) => idMap.get(s.id)),
  }, admin);

  /* Read back as a presenter — what the room will see — and compare. */
  const presenter = await login('presenter@org.local', 'Present@123');
  const seen = (await request('GET', `/api/orgs/${TO}/sections`, null, presenter)).json.sections;
  const seenBlocks = seen.reduce((n, s) => n + (s.blocks || []).length, 0);
  const missing = source.filter((s) => s.status === 'published' && !s.hidden && !seen.some((t) => t.key === s.key));
  console.log(`\n  presenter sees ${seen.length} section(s), ${seenBlocks} block(s) in ${dst.name}`);
  if (missing.length) console.log(`  !! not visible after copy: ${missing.map((s) => s.title).join(', ')}`);
  else console.log('  every published section came across');
})().catch((e) => { console.error('  ERROR ' + e.message); process.exitCode = 1; });
