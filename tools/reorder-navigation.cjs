#!/usr/bin/env node
/*
 * Navigation order.
 *
 * The five that were asked for, in the order they were asked for:
 *
 *   Executive Summary → Governance Council → Programmes
 *   → Centers of Excellence → Certifications
 *
 * Governance Council carries four pages of its own (Profile of the Society,
 * Governing Body, Academic Council, Faculty Strength). Those are children, so
 * the deck walks them between the council and Programmes without anything
 * here having to say so — `deckSections()` expands every parent into
 * [parent, ...its pages].
 *
 * Everything not named keeps the order it already had, moved down as a block.
 * Only the five were specified, so only the five are placed; guessing at the
 * rest would be inventing a running order nobody asked for.
 *
 * The nav pane and Prev/Next both read this same order — NAVIGATION_GROUPS in
 * SideNav.js only supplies labels and icons, not sequence — so there is one
 * place to change and nothing to keep in step.
 *
 *   node tools/reorder-navigation.cjs
 */
const http = require('http');

const HOST = '127.0.0.1';
const PORT = Number(process.env.PORT || 4173);
const ORG = 'technical-hub';

/** The keys that were named, in order. */
const LEAD = [
  'company-profile',      // Executive Summary
  'leadership-journey',   // Governance Council (+ its four pages)
  'programs',             // Programmes
  'team',                 // Centers of Excellence
  'certifications',       // Certifications
];

function call(method, urlPath, body, cookie) {
  return new Promise((resolve, reject) => {
    const payload = body === undefined ? null : Buffer.from(JSON.stringify(body));
    const headers = {};
    if (payload) {
      headers['content-type'] = 'application/json';
      headers['content-length'] = payload.length;
    }
    if (cookie) headers.cookie = cookie;
    const req = http.request({ host: HOST, port: PORT, path: urlPath, method, headers }, (res) => {
      let raw = '';
      res.on('data', (c) => { raw += c; });
      res.on('end', () => {
        if (res.statusCode >= 400) return reject(new Error(`${method} ${urlPath} → ${res.statusCode} ${raw}`));
        let parsed = null;
        try { parsed = raw ? JSON.parse(raw) : null; } catch { /* not json */ }
        resolve({ body: parsed, setCookie: [].concat(res.headers['set-cookie'] || []) });
      });
    });
    req.on('error', reject);
    if (payload) req.write(payload);
    req.end();
  });
}

(async () => {
  const login = await call('POST', '/api/auth/login', { email: (process.env.ADMIN_EMAIL || 'Torii@123.com'), password: (process.env.ADMIN_PASSWORD || 'Admin@123') });
  const jar = login.setCookie.map((c) => c.split(';')[0]).join('; ');
  if (!/op_session=/.test(jar)) throw new Error('no session cookie');

  const list = await call('GET', `/api/orgs/${ORG}/sections`, undefined, jar);
  const tops = (list.body.sections || [])
    .filter((s) => !s.parentId)
    .sort((a, b) => a.order - b.order);

  const byKey = new Map(tops.map((s) => [s.key, s]));
  for (const key of LEAD) {
    if (!byKey.has(key)) throw new Error(`no top-level section keyed "${key}" — refusing to guess`);
  }

  const lead = LEAD.map((key) => byKey.get(key));
  const rest = tops.filter((s) => !LEAD.includes(s.key));
  const ordered = [...lead, ...rest];

  console.log('before →  after');
  ordered.forEach((s, i) => {
    const was = tops.findIndex((t) => t.id === s.id);
    const moved = was !== i ? `   (was ${was})` : '';
    console.log(`  ${String(i).padStart(2)}. ${s.title}${moved}`);
  });

  await call('POST', `/api/orgs/${ORG}/sections/reorder`, { order: ordered.map((s) => s.id) }, jar);

  const back = await call('GET', `/api/orgs/${ORG}/sections`, undefined, jar);
  const saved = (back.body.sections || [])
    .filter((s) => !s.parentId)
    .sort((a, b) => a.order - b.order)
    .map((s) => s.title);
  console.log('\nsaved order:');
  saved.forEach((t, i) => console.log(`  ${String(i).padStart(2)}. ${t}`));

  const want = ordered.map((s) => s.title);
  const same = saved.length === want.length && saved.every((t, i) => t === want[i]);
  console.log(same ? '\nmatches what was asked for' : '\nMISMATCH — the server did not take the order');
  if (!same) process.exit(1);
})().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
