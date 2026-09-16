#!/usr/bin/env node
/*
 * Programmes — NCET's three sheets as a shelf of books.
 *
 * UG, PG and the research centres, each one a volume that opens onto its own
 * table and nothing else. The three covers and the three cover loops are the
 * media embedded in the ThreeUI source, decoded from it byte for byte and
 * uploaded here; mp4 is web-safe so the server stores it without re-encoding.
 *
 * Figures are exactly as printed on the supplied sheets. Where a sheet's own
 * total does not agree with its column (PG prints 252 over 120 + 60 + 12) the
 * printed total is what goes in, because the deck's job is to show the
 * institution's own document, not to correct it on the wall behind the speaker.
 *
 * Through the API, not by hand into db.json: a running server holds the store
 * in memory and writes it back on its next change, throwing away anything
 * edited underneath it.
 *
 *   node tools/publish-programmes-shelf.cjs
 */
const fs = require('fs');
const http = require('http');
const path = require('path');

const HOST = '127.0.0.1';
const PORT = Number(process.env.PORT || 4173);
const ORG = 'technical-hub';
const SECTION_TITLE = 'Programmes';
const MEDIA = process.env.BOOKSHELF_MEDIA;

/* The cover tints are the authored ones, kept with their covers. */
const BOOKS = [
  {
    kicker: 'Volume I',
    title: 'UG Programmes',
    subtitle: 'Undergraduate',
    footer: 'Since 2001 · Intake 900',
    coverColor: '#363126',
    cover: 'bbs-cover-1.jpg',
    motion: 'bbs-motion-1.mp4',
    columns: ['Programme', 'Year of Starting', 'Intake 2025-26'],
    rows: [
      { cells: ['BE-CSE', '2001-2002', '240'] },
      { cells: ['BE-ECE', '2001-2002', '120'] },
      { cells: ['BE-ISE', '2001-2002', '60'] },
      { cells: ['BE-CV', '2004-2005', '60'] },
      { cells: ['BE-CSE (AI & ML)', '2020-2021', '180'] },
      { cells: ['BE-CSE (DS)', '2020-2021', '60'] },
      { cells: ['BE-CSE (IoT & Cyber Security, incl. Blockchain)', '2025-2026', '60'] },
      { cells: ['BCA', '2025-2026', '120'] },
      { cells: ['Total', '', '900'], total: true },
    ],
  },
  {
    kicker: 'Volume II',
    title: 'PG Programmes',
    subtitle: 'Postgraduate',
    footer: 'Since 2006 · Intake 252',
    coverColor: '#945a3e',
    cover: 'bbs-cover-2.jpg',
    motion: 'bbs-motion-2.mp4',
    columns: ['Programme', 'Year of Starting', 'Intake 2026-27'],
    rows: [
      { cells: ['MBA', '2006-2007', '120'] },
      { cells: ['MCA', '2025-2026', '60'] },
      { cells: ['Structural Engineering', '2011-2012', '12'] },
      { cells: ['Total', '', '252'], total: true },
    ],
  },
  {
    kicker: 'Volume III',
    title: 'Research Centers',
    subtitle: 'Doctoral Research',
    footer: 'Seven Departments',
    coverColor: '#566044',
    cover: 'bbs-cover-3.jpg',
    motion: 'bbs-motion-3.mp4',
    /* The sheet merges 2010-11 down three departments. A merged cell would
       have to be faked with a rowspan the schema does not carry, so the year
       is simply repeated — same data, and every row stays readable on its own. */
    columns: ['Department', 'Guides', 'Scholars Registered', 'Ph.D Awarded', 'Since'],
    rows: [
      { cells: ['Civil Engineering', '01', '—', '01', '2008-09'] },
      { cells: ['MBA', '03', '13', '02', '2009-10'] },
      { cells: ['Electronics & Communication Engineering', '06', '10', '02', '2010-11'] },
      { cells: ['Mechanical Engineering', '01', '—', '—', '2010-11'] },
      { cells: ['Physics', '02', '—', '—', '2010-11'] },
      { cells: ['Computer Science & Engineering', '14', '29', '—', '2012-13'] },
      { cells: ['Chemistry', '02', '05', '—', '2014-15'] },
    ],
  },
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

/** A jpeg or mp4 that arrived short would render as a dead frame — check the tail. */
function whole(file) {
  const b = fs.readFileSync(file);
  if (b.length < 16) return false;
  if (/\.jpe?g$/i.test(file)) return b[b.length - 2] === 0xFF && b[b.length - 1] === 0xD9;
  if (/\.mp4$/i.test(file)) return b.subarray(4, 8).toString('latin1') === 'ftyp';
  return true;
}

(async () => {
  if (!MEDIA) throw new Error('set BOOKSHELF_MEDIA to the folder holding the decoded covers and loops');

  for (const book of BOOKS) {
    for (const name of [book.cover, book.motion]) {
      const abs = path.join(MEDIA, name);
      if (!fs.existsSync(abs)) throw new Error(`missing: ${name}`);
      if (!whole(abs)) throw new Error(`truncated: ${name}`);
    }
  }
  console.log(`${BOOKS.length * 2} media files, all whole`);

  const login = await call('POST', '/api/auth/login', { email: 'admin@org.local', password: 'Admin@123' });
  const jar = login.setCookie.map((c) => c.split(';')[0]).join('; ');
  if (!/op_session=/.test(jar)) throw new Error('no session cookie');

  /* Upload once, keyed by filename, so re-running does not pile up copies. */
  const existing = await call('GET', '/api/assets', undefined, jar);
  const byName = new Map((existing.body.assets || []).map((a) => [a.name, a]));
  const idOf = {};

  for (const book of BOOKS) {
    for (const name of [book.cover, book.motion]) {
      if (byName.has(name)) {
        idOf[name] = byName.get(name).id;
        console.log(`  reused ${name}`);
        continue;
      }
      const abs = path.join(MEDIA, name);
      const mime = /\.mp4$/i.test(name) ? 'video/mp4' : 'image/jpeg';
      const dataUrl = `data:${mime};base64,${fs.readFileSync(abs).toString('base64')}`;
      const up = await call('POST', '/api/assets', { files: [{ name, dataUrl }] }, jar);
      const asset = (up.body.assets || up.body.uploaded || [])[0];
      if (!asset?.id) throw new Error(`upload failed for ${name}: ${JSON.stringify(up.body)}`);
      idOf[name] = asset.id;
      console.log(`  uploaded ${name} → ${asset.url}`);
    }
  }

  const list = await call('GET', `/api/orgs/${ORG}/sections`, undefined, jar);
  const row = (list.body.sections || []).find((s) => /^programs?$|^programmes?$/i.test(s.title || ''));
  if (!row) throw new Error('no Programs section on this organization');

  const block = {
    type: 'book-shelf',
    layout: { x: 0, y: 0, w: 12, h: 15 },
    books: BOOKS.map((book) => ({
      title: book.title,
      kicker: book.kicker,
      subtitle: book.subtitle,
      footer: book.footer,
      coverColor: book.coverColor,
      coverAssetId: idOf[book.cover],
      motionAssetId: idOf[book.motion],
      columns: book.columns,
      rows: book.rows,
    })),
  };

  await call('PATCH', `/api/sections/${row.id}`, {
    title: SECTION_TITLE,
    intro: SECTION_TITLE,
    blocks: [block],
  }, jar);

  const back = await call('GET', `/api/sections/${row.id}`, undefined, jar);
  const saved = back.body.section || back.body;
  const shelf = (saved.blocks || []).find((b) => b.type === 'book-shelf');
  if (!shelf) throw new Error('block did not survive the schema — is the server running the edited section.service.js?');
  console.log(`\n${saved.title} (${row.id}) — intro "${saved.intro}"`);
  shelf.books.forEach((b) => {
    console.log(`  ${b.title}: ${b.rows.length} rows × ${b.columns.length} cols, cover=${b.cover?.url || 'MISSING'}, motion=${b.motion?.url || 'MISSING'}`);
  });
})().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
