/**
 * Decides which sections a presenter can see.
 *
 * A presenter is shown a section only when it is `published` and not `hidden`;
 * an admin is shown everything. That rule already existed — what was missing was
 * a way to set it without hand-editing the store, and a default that matched
 * reality: every section shipped as `published`, so a presenter opening the deck
 * met fifteen blank slides.
 *
 *   node tools/presenter-visibility.js                 # show what a presenter sees
 *   node tools/presenter-visibility.js --show "Leadership Journey" "CEO Profile"
 *   node tools/presenter-visibility.js --hide "Placements"
 *
 * Titles are matched case-insensitively and may be partial.
 */
const http = require('http');

const HOST = { host: '127.0.0.1', port: Number(process.env.PORT) || 4173 };
const ORGS = ['technical-hub', 'torii', 'ncet'];

function request(method, path, body, cookie) {
  return new Promise((resolve, reject) => {
    const payload = body ? JSON.stringify(body) : null;
    const headers = {};
    if (payload) { headers['content-type'] = 'application/json'; headers['content-length'] = Buffer.byteLength(payload); }
    if (cookie) headers.cookie = `op_session=${cookie}`;
    const req = http.request({ ...HOST, path, method, headers }, (res) => {
      let b = '';
      res.on('data', (d) => (b += d));
      res.on('end', () => {
        if (res.statusCode >= 400) return reject(new Error(`${method} ${path} -> ${res.statusCode} ${b.slice(0, 200)}`));
        let json = null; try { json = JSON.parse(b); } catch {}
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
  return /op_session=([^;]+)/.exec(r.setCookie)?.[1];
};

(async () => {
  const mode = process.argv[2];
  const names = process.argv.slice(3).map((n) => n.toLowerCase());
  const admin = await login((process.env.ADMIN_EMAIL || 'Torii@123.com'), (process.env.ADMIN_PASSWORD || 'Admin@123'));

  for (const org of ORGS) {
    const all = (await request('GET', `/api/orgs/${org}/sections`, null, admin)).json.sections;
    const tops = all.filter((s) => !s.parentId);
    console.log(`\n=== ${org}`);

    for (const s of all) {
      let next = null;
      if (mode === '--show' && names.some((n) => s.title.toLowerCase().includes(n))) next = true;
      else if (mode === '--hide' && names.some((n) => s.title.toLowerCase().includes(n))) next = false;
      if (next === null) continue;

      const want = { status: next ? 'published' : 'draft', hidden: false };
      if (s.status === want.status && !s.hidden === !want.hidden) continue;
      await request('PATCH', `/api/sections/${s.id}`, want, admin);
    }

    // Report what a presenter would actually be shown, asking as a presenter.
    const presenter = await login('presenter@org.local', 'Present@123');
    const seen = (await request('GET', `/api/orgs/${org}/sections`, null, presenter)).json.sections;
    const seenTop = seen.filter((s) => !s.parentId);
    console.log(`  presenter sees ${seenTop.length} of ${tops.length} top-level sections:`);
    for (const s of seenTop) {
      const kids = seen.filter((c) => c.parentId === s.id);
      console.log(`     ${s.title}${kids.length ? '  (' + kids.map((k) => k.title).join(', ') + ')' : ''}`);
    }
    const blank = seen.filter((s) => !(s.blocks || []).length && !seen.some((c) => c.parentId === s.id));
    if (blank.length) console.log(`  !! ${blank.length} of those are blank: ${blank.map((b) => b.title).join(', ')}`);
  }

  if (!mode) console.log('\n(read-only — pass --show or --hide to change anything)');
})().catch((e) => { console.error('FAILED:', e.message); process.exit(1); });
