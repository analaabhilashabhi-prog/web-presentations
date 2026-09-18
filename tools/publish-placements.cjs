/**
 * Rebuilds the Placements section's chapters.
 *
 *   node tools/publish-placements.cjs [--org technical-hub] [--dry]
 *
 * Needs the app server on 4173.
 *
 * WHAT THIS DOES
 * --------------
 * Drops  : Campus Placements — removed on request; the files stay on disk.
 * Rebuilds: Placement Journeys — whatever sits in
 *          `backend/uploads/Placements/Journeys/`, replacing what was there.
 * Drops  : Open Drives, Inside the Companies.
 * Adds   : Company Wise Placements — the announcement cards from
 *          `Downloads/NCET/NCET/PLACEMENTS FOLDER`, one group per company, which
 *          is what turns the filter chips on: `drawChips` shows a chip per named
 *          group and needs no other wiring.
 *
 * The photographs are copied into `backend/uploads/Placements/Company Wise/`
 * under slugged folder names, because a `src` is URL-encoded segment by segment
 * and a literal `[24]7.ai` on disk is a bracket fight nobody needs. The pretty
 * name lives in the group, which is what the chip and the tile tag show.
 *
 * ASPECT RATIOS ARE NEVER TOUCHED. Every image's real pixel dimensions are read
 * off the file and stored, and `justifyRows` solves a shared row height from
 * them — so a card is only ever scaled, never cropped. That matters here more
 * than anywhere else in the deck: these are designed cards with a student's name,
 * their branch and their package set into them, and a crop cuts a name in half.
 *
 * Run it again after dropping new company folders in; it is idempotent.
 */
const fs = require('fs');
const path = require('path');
const http = require('http');

const ROOT = path.resolve(__dirname, '..');
const SRC = 'C:/Users/HP/Downloads/NCET/NCET/PLACEMENTS FOLDER';
const DEST_REL = 'Placements/Company Wise';
const DEST = path.join(ROOT, 'backend/uploads', DEST_REL);
/* The placement-journey banners. Unlike the company cards, these are read from
   the uploads folder rather than copied out of Downloads, because they arrive at
   9600x4800 — forty-six megapixels to paint a card 1560px wide, 33MB for three —
   and have to be downscaled on the way in, which needs the canvas:

     node tools/crop-image.cjs --port <p> --max-width 3000 --quality 0.9           --in "<the user's file>" --out backend/uploads/Placements/Journeys/banner-1.jpg

   So this folder is the source of truth: whatever is in it is what the chapter
   shows, in filename order. */
const DEST_JOURNEY = path.join(ROOT, 'backend/uploads/Placements/Journeys');
const DB = path.join(ROOT, 'backend/data/db.json');
const BACKUPS = path.join(ROOT, 'backend/data/backups');
const HOST = { host: '127.0.0.1', port: Number(process.env.PORT) || 4173 };

const arg = (n, d = null) => {
  const i = process.argv.indexOf(`--${n}`);
  return i > -1 && process.argv[i + 1] && !process.argv[i + 1].startsWith('--') ? process.argv[i + 1] : d;
};
const ORG = arg('org', 'technical-hub');
const DRY = process.argv.includes('--dry');

/* Folder on disk -> the company's name as it should read on screen.
 *
 * Written out rather than derived. Most of these folders are shouted
 * ("DELOITTE"), some carry the words "PLACEMENT IN", two spell the same company
 * two different ways, and one is a brand that is deliberately lower case. A
 * title-casing heuristic gets "Dhl", "O9" and "[24]7.Ai" wrong, and a name a
 * recruiter reads wrong is worse than no chip at all.
 *
 * Two folders map onto one name on purpose — o9 and Idea Infinity were each
 * filed twice — and the groups are merged under it.
 */
const COMPANIES = {
  '09 SOLUTIONS PLACEMENT': 'o9 Solutions',
  'PLACEMENT IN O9': 'o9 Solutions',
  'PLACEMENT IN IDEA INFINITY': 'Idea Infinity',
  'PLACEMENT IN Idea Infinity IT Solution': 'Idea Infinity',
  'PLACEMENT IN  CrimsonLogic': 'CrimsonLogic',
  'PLACEMENT IN  Mphasis': 'Mphasis',
  'PLACEMENT IN  PURSUIT FUTURE TECHNOLOGIES': 'Pursuit Future Technologies',
  'PLACEMENT IN  Sagility': 'Sagility',
  'PLACEMENT IN  [24]7.ai': '[24]7.ai',
  'PLACEMENT IN ARSHITH': 'Arshith',
  'PLACEMENT IN Assisto Technologies': 'Assisto Technologies',
  'PLACEMENT IN BLUESTOCK': 'Bluestock',
  'PLACEMENT IN COGNIZANT': 'Cognizant',
  'PLACEMENT IN DELOITTE': 'Deloitte',
  'PLACEMENT IN DHL': 'DHL',
  'PLACEMENT IN FUJITSU': 'Fujitsu',
  'PLACEMENT IN Foxconn': 'Foxconn',
  'PLACEMENT IN MUTHOOT FINANCE': 'Muthoot Finance',
  'PLACEMENT IN More Retail Private Limited': 'More Retail',
  'PLACEMENT IN Sai Farmiculture': 'Sai Farmiculture',
  'PLACEMENT IN Sasken Technologies': 'Sasken Technologies',
  'PLACEMENT IN Soft Suave Technologies': 'Soft Suave',
  'PLACEMENT IN Unisys': 'Unisys',
  'PLACEMENT IN WAKEFIT': 'Wakefit',
};

const CHAPTER = {
  key: 'companywise',
  name: 'Company Wise Placements',
  blurb: 'Every offer, filed under the company that made it.',
  kind: 'poster',
  icon: 'briefcase',
};

const slug = (s) => String(s).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');

/** Intrinsic size, straight off the file — the row solver has no other source. */
function jpegSize(b) {
  let o = 2;
  while (o < b.length) {
    if (b[o] !== 0xFF) { o++; continue; }
    const m = b[o + 1];
    if (m >= 0xC0 && m <= 0xCF && m !== 0xC4 && m !== 0xC8 && m !== 0xCC) {
      return { h: b.readUInt16BE(o + 5), w: b.readUInt16BE(o + 7) };
    }
    o += 2 + b.readUInt16BE(o + 2);
  }
  return null;
}
function pngSize(b) {
  return b.length > 24 && b.toString('ascii', 12, 16) === 'IHDR'
    ? { w: b.readUInt32BE(16), h: b.readUInt32BE(20) } : null;
}

/**
 * Reads one image: its intrinsic size, and whether the file is actually whole.
 * A dimension check alone does not prove that — a truncated JPEG keeps a header
 * intact enough to report a size — so the end marker is checked too.
 */
function readImage(abs) {
  const ext = path.extname(abs).toLowerCase();
  if (!['.jpg', '.jpeg', '.png', '.webp'].includes(ext)) return { skip: `${ext || 'no extension'} — not an image the page can show` };
  const buf = fs.readFileSync(abs);
  const size = ext === '.png' ? pngSize(buf) : jpegSize(buf);
  const tail = buf.slice(-8).toString('hex');
  const whole = ext === '.png' ? tail.includes('49454e44') : tail.endsWith('ffd9');
  if (!size) return { skip: 'unreadable' };
  if (!whole) return { skip: 'truncated' };
  return { buf, ext, size };
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
        if (res.statusCode >= 400) return reject(new Error(`${method} ${p} -> ${res.statusCode} ${b.slice(0, 300)}`));
        let json = null; try { json = JSON.parse(b); } catch { /* 204 */ }
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
  const t = /op_session=([^;]+)/.exec(r.setCookie)?.[1];
  if (!t) throw new Error('login returned no session cookie');
  return t;
};

(async () => {
  if (!fs.existsSync(SRC)) throw new Error(`source folder not found: ${SRC}`);

  // ------------------------------------------------------- gather + copy
  const byCompany = new Map();
  const skipped = [];
  const unknown = [];

  for (const folder of fs.readdirSync(SRC).sort()) {
    const abs = path.join(SRC, folder);
    if (!fs.statSync(abs).isDirectory()) continue;
    // The journey banners were dropped in here too, and are not a company.
    if (folder.toLowerCase() === 'placement journey') continue;
    const company = COMPANIES[folder];
    if (!company) { unknown.push(folder); continue; }

    for (const file of fs.readdirSync(abs).sort()) {
      const ext = path.extname(file).toLowerCase();
      if (!['.jpg', '.jpeg', '.png', '.webp'].includes(ext)) {
        skipped.push(`${folder}/${file}  (${ext || 'no extension'} — not an image the page can show)`);
        continue;
      }
      const buf = fs.readFileSync(path.join(abs, file));
      const size = ext === '.png' ? pngSize(buf) : jpegSize(buf);
      /* A dimension check alone does not prove a file is whole — a truncated
         JPEG keeps a header intact enough to report its size. */
      const tail = buf.slice(-8).toString('hex');
      const whole = ext === '.png' ? tail.includes('49454e44') : tail.endsWith('ffd9');
      if (!size || !whole) {
        skipped.push(`${folder}/${file}  (${!size ? 'unreadable' : 'truncated'})`);
        continue;
      }
      if (!byCompany.has(company)) byCompany.set(company, []);
      byCompany.get(company).push({ buf, ext, size, from: `${folder}/${file}` });
    }
  }

  const companies = [...byCompany.keys()].sort((a, b) => a.localeCompare(b, 'en', { sensitivity: 'base' }));
  const total = [...byCompany.values()].reduce((n, v) => n + v.length, 0);

  console.log(`\n  ${companies.length} companies, ${total} cards${DRY ? '   (dry run — nothing written)' : ''}`);
  if (unknown.length) console.log(`  !! ${unknown.length} folder(s) not in COMPANIES, left out: ${unknown.join(', ')}`);
  if (skipped.length) {
    console.log(`  -- ${skipped.length} file(s) skipped:`);
    skipped.forEach((s) => console.log(`       ${s}`));
  }

  const groups = [];
  for (const company of companies) {
    const dir = path.join(DEST, slug(company));
    if (!DRY) fs.mkdirSync(dir, { recursive: true });
    const images = byCompany.get(company).map((item, i) => {
      const name = `${String(i + 1).padStart(2, '0')}${item.ext}`;
      if (!DRY) fs.writeFileSync(path.join(dir, name), item.buf);
      return {
        src: `Company Wise/${slug(company)}/${name}`,
        label: company,
        w: item.size.w,
        h: item.size.h,
      };
    });
    groups.push({ name: company, images });
    console.log(`  ${company.padEnd(28)} ${String(images.length).padStart(2)} card(s)`);
  }

  // ------------------------------------------------- the journey banners
  /* Whatever is in uploads/Placements/Journeys, in filename order. No label is
     written over any of them: they carry the students' names, the company and the
     package inside the artwork, which is what the banners are for. */
  const journeyBanners = [];
  const journeySkipped = [];
  for (const file of fs.readdirSync(DEST_JOURNEY).sort()) {
    const abs = path.join(DEST_JOURNEY, file);
    if (fs.statSync(abs).isDirectory()) continue;
    const img = readImage(abs);
    if (img.skip) { journeySkipped.push(`${file}  (${img.skip})`); continue; }
    journeyBanners.push({ src: `Journeys/${file}`, label: '', w: img.size.w, h: img.size.h });
  }
  console.log(`
  ${journeyBanners.length} journey banner(s) in uploads/Placements/Journeys`);
  journeyBanners.forEach((b) => console.log(`       ${String(b.w + 'x' + b.h).padEnd(12)} ${b.src}`));
  journeySkipped.forEach((x) => console.log(`       skipped ${x}`));

  // ------------------------------------------------------------- chapters
  const db = JSON.parse(fs.readFileSync(DB, 'utf8'));
  const section = db.sections.find((s) => s.orgId === ORG && s.key === 'placements');
  if (!section) throw new Error(`no placements section in "${ORG}"`);
  const block = (section.blocks || [])[0];
  if (!block || block.type !== 'placement-wall') throw new Error('placements does not hold a placement-wall block');

  /* Campus Placements was removed on request (2026-09-14) and is deliberately not
     in this list, so a re-run does not resurrect it. Its 33 announcement cards are
     still on disk under uploads/Placements/, and Torii and NCET still show them. */
  const KEEP = ['journeys'];
  const kept = block.chapters.filter((c) => KEEP.includes(c.key));
  // Company Wise is rebuilt each run, so it is not a casualty — only a report of one.
  const dropped = block.chapters.filter((c) => !KEEP.includes(c.key) && c.key !== CHAPTER.key);

  /* The journeys chapter is rebuilt rather than appended to, so running this
     twice does not stack the banners up. Its original three `PJ*.jpg`
     infographics are picked back out of whatever is stored and kept at the end;
     the banners lead, being both newer and what was just asked for. */
  const chapters = kept.map((c) => {
    if (c.key !== 'journeys' || !journeyBanners.length) return c;
    /* Replaced outright, not appended to — which is both what was asked for and
       what makes a second run idempotent.

       The kind follows the count. `journey` sizes every row to fill the stage,
       which is right for a handful of hero banners and wrong for a wall: sixteen
       cards under it came to 3735px of stage with about one row visible at a
       time. Past a handful, they are a poster wall. */
    return {
      ...c,
      kind: journeyBanners.length > 6 ? 'poster' : 'journey',
      groups: [{ name: '', images: journeyBanners }],
    };
  });
  chapters.push({ ...CHAPTER, groups });

  console.log('\n  chapters:');
  chapters.filter((c) => KEEP.includes(c.key)).forEach((c) => console.log(
    `    keep  ${c.name}  (${c.groups.reduce((n, g) => n + g.images.length, 0)} images)`));
  dropped.forEach((c) => console.log(`    drop  ${c.name}  (${c.groups.reduce((n, g) => n + g.images.length, 0)} images)`));
  console.log(`    add   ${CHAPTER.name}  (${total} images across ${groups.length} companies)`);

  if (DRY) return;

  fs.mkdirSync(BACKUPS, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const saved = path.join(BACKUPS, `db-before-placements-${ORG}-${stamp}.json`);
  fs.copyFileSync(DB, saved);
  JSON.parse(fs.readFileSync(saved, 'utf8'));
  console.log(`\n  backup  ${path.relative(ROOT, saved)}`);

  const admin = await login((process.env.ADMIN_EMAIL || 'Torii@123.com'), (process.env.ADMIN_PASSWORD || 'Admin@123'));
  await request('PATCH', `/api/sections/${section.id}`, {
    blocks: [{
      ...block,
      lead: 'Campus drives and the offers that followed — every card at its own '
        + 'proportions, filed company by company.',
      chapters,
    }],
  }, admin);

  // Read back through the API, which is what the page actually receives.
  const after = (await request('GET', `/api/sections/${section.id}`, null, admin)).json.section;
  const ch = after.blocks[0].chapters;
  console.log('\n  stored:');
  ch.forEach((c) => console.log(`    ${(c.key || '').padEnd(13)} ${String(c.groups.length).padStart(2)} group(s)  `
    + `${String(c.groups.reduce((n, g) => n + g.images.length, 0)).padStart(3)} image(s)  ${c.name}`));

  // Every src must resolve to a file on disk, or the tile deletes itself on error.
  const missing = [];
  for (const c of ch) for (const g of c.groups) for (const im of g.images) {
    if (!fs.existsSync(path.join(ROOT, 'backend/uploads/Placements', im.src))) missing.push(im.src);
  }
  console.log(missing.length ? `\n  !! ${missing.length} image(s) have no file: ${missing.slice(0, 5).join(', ')}`
    : '\n  every image resolves to a file on disk');
})().catch((e) => { console.error('  ERROR ' + e.message); process.exitCode = 1; });
