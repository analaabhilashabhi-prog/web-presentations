#!/usr/bin/env node
/*
 * Success Stories — the headline the user asked for: "The Legacy of Babji Neelam".
 *
 * Through the API rather than by hand into db.json, because a running server
 * holds the store in memory and writes it back on its next change, which throws
 * away anything edited underneath it.
 *
 *   node tools/retitle-success-stories.cjs
 */
const http = require('http');

const HOST = '127.0.0.1';
const PORT = Number(process.env.PORT || 4173);
const TITLE = 'The Legacy of Babji Neelam';

function call(method, path, body, cookie) {
  return new Promise((resolve, reject) => {
    const payload = body === undefined ? null : Buffer.from(JSON.stringify(body));
    const headers = {};
    if (payload) {
      headers['content-type'] = 'application/json';
      headers['content-length'] = payload.length;
    }
    if (cookie) headers.cookie = cookie;
    const req = http.request({ host: HOST, port: PORT, path, method, headers }, (res) => {
      let raw = '';
      res.on('data', (c) => { raw += c; });
      res.on('end', () => {
        let parsed = null;
        try { parsed = raw ? JSON.parse(raw) : null; } catch { /* not json */ }
        if (res.statusCode >= 400) return reject(new Error(`${method} ${path} → ${res.statusCode} ${raw}`));
        resolve({ status: res.statusCode, body: parsed, setCookie: [].concat(res.headers['set-cookie'] || []) });
      });
    });
    req.on('error', reject);
    if (payload) req.write(payload);
    req.end();
  });
}

(async () => {
  const login = await call('POST', '/api/auth/login', {
    email: 'admin@org.local', password: 'Admin@123',
  });
  const jar = login.setCookie.map((c) => c.split(';')[0]).join('; ');
  if (!/op_session=/.test(jar)) throw new Error('no session cookie');

  const orgs = await call('GET', '/api/orgs', undefined, jar);
  const ids = [];
  for (const org of orgs.body.organizations || []) {
    const list = await call('GET', `/api/orgs/${org.id}/sections`, undefined, jar);
    for (const section of list.body.sections || []) {
      if (/success stories/i.test(section.title || '')) ids.push([org.id, section.id]);
    }
  }
  if (!ids.length) throw new Error('no Success Stories section found');

  for (const [orgId, id] of ids) {
    const got = await call('GET', `/api/sections/${id}`, undefined, jar);
    const section = got.body.section || got.body;
    const blocks = (section.blocks || []).map((b) => (
      b.type === 'story-wall' ? { ...b, title: TITLE } : b
    ));
    if (!blocks.some((b) => b.type === 'story-wall')) {
      console.log(`- ${orgId}: no story-wall block, left alone`);
      continue;
    }
    await call('PATCH', `/api/sections/${id}`, { blocks }, jar);
    const back = await call('GET', `/api/sections/${id}`, undefined, jar);
    const saved = ((back.body.section || back.body).blocks || [])
      .find((b) => b.type === 'story-wall');
    console.log(`- ${orgId}: ${JSON.stringify(saved.title)} (${(saved.stories || []).length} stories)`);
  }
})().catch((err) => { console.error(String(err.message || err)); process.exit(1); });
