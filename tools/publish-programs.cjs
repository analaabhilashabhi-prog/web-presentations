#!/usr/bin/env node
/*
 * Programs — the section's name, and the photographs that stand in for a film
 * where a programme has none.
 *
 * Ignite Coder had an empty card: no reel exists for it, so the deck showed the
 * programme with a dash where every other card had a count. The five stills in
 * `uploads/Programs Videos/` are its evidence, and they now open from its card
 * the same way a film does.
 *
 * Through the API, not by hand into db.json: a running server holds the store in
 * memory and writes it back on its next change, throwing away anything edited
 * underneath it.
 *
 *   node tools/publish-programs.cjs
 */
const fs = require('fs');
const http = require('http');
const path = require('path');

const HOST = '127.0.0.1';
const PORT = Number(process.env.PORT || 4173);
const UPLOADS = path.join(__dirname, '..', 'backend', 'uploads');

const SECTION_TITLE = 'Programs';
/* Where the user dropped them. The folder is served, so the stored src is the
   path under uploads and nothing needs copying. */
const PHOTO_DIR = 'Programs Videos';

/* No captions. The gallery's heading already reads Ignite Coder, so repeating it
 * under each of five tiles prints the heading six times; and there is nothing
 * else that can honestly be said about a photograph of a session without
 * inventing it. An empty caption draws no label — the tile is the picture.
 * Listed rather than globbed so a new file in the folder is a deliberate act. */
const IGNITE_CAPTIONS = {
  'Ignite_1.jpg': '',
  'Ignite_2.jpg': '',
  'Ignite_3.jpg': '',
  'Ignite_4.jpg': '',
  'Ignite_5.jpg': '',
};

/** A dimension check does not prove an image is whole — check the tail too. */
function whole(file) {
  const b = fs.readFileSync(file);
  if (b.length < 4) return false;
  if (/\.jpe?g$/i.test(file)) return b[b.length - 2] === 0xFF && b[b.length - 1] === 0xD9;
  if (/\.png$/i.test(file)) return b.subarray(b.length - 8, b.length - 4).toString('latin1') === 'IEND';
  if (/\.gif$/i.test(file)) return b[b.length - 1] === 0x3B;
  return true;
}

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
  /* the pictures, checked before anything is published */
  const photos = Object.keys(IGNITE_CAPTIONS).sort().map((name) => {
    const abs = path.join(UPLOADS, PHOTO_DIR, name);
    if (!fs.existsSync(abs)) throw new Error(`missing: ${PHOTO_DIR}/${name}`);
    if (!whole(abs)) throw new Error(`truncated: ${PHOTO_DIR}/${name}`);
    return { src: `${PHOTO_DIR}/${name}`, caption: IGNITE_CAPTIONS[name] };
  });
  console.log(`${photos.length} photographs, all whole`);

  const login = await call('POST', '/api/auth/login', { email: 'admin@org.local', password: 'Admin@123' });
  const jar = login.setCookie.map((c) => c.split(';')[0]).join('; ');
  if (!/op_session=/.test(jar)) throw new Error('no session cookie');

  const orgs = await call('GET', '/api/orgs', undefined, jar);
  for (const org of orgs.body.organizations || []) {
    const list = await call('GET', `/api/orgs/${org.id}/sections`, undefined, jar);
    for (const row of list.body.sections || []) {
      if (!/^programs\b/i.test(row.title || '') && !/programs/i.test(row.title || '')) continue;

      const got = await call('GET', `/api/sections/${row.id}`, undefined, jar);
      const section = got.body.section || got.body;
      const blocks = (section.blocks || []).map((b) => {
        if (b.type !== 'program-deck') return b;
        return {
          ...b,
          programs: (b.programs || []).map((p) => (
            p.key === 'ignite' ? { ...p, photos } : p
          )),
        };
      });

      await call('PATCH', `/api/sections/${row.id}`, { title: SECTION_TITLE, blocks }, jar);

      const back = await call('GET', `/api/sections/${row.id}`, undefined, jar);
      const saved = back.body.section || back.body;
      const deck = (saved.blocks || []).find((b) => b.type === 'program-deck');
      const ignite = (deck?.programs || []).find((p) => p.key === 'ignite');
      console.log(
        `- ${org.id}: title ${JSON.stringify(saved.title)}`
        + `, ignite photos ${(ignite?.photos || []).length}`
        + `, films ${(ignite?.videos || []).length}`,
      );
    }
  }
})().catch((err) => { console.error(String(err.message || err)); process.exit(1); });
