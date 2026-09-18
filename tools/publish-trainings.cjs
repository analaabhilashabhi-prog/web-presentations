/**
 * Publishes Torii's Trainings as the bookshelf.
 *
 *   node tools/publish-trainings.cjs [--org torii] [--dry]
 *
 * Needs the app server on 4173.
 *
 * WHAT IT MAKES
 * -------------
 * One `training-shelf` block, built to a reference image the user supplied:
 * two zones split by a shelf, the trainings standing on it as books with the
 * selected one large and square on, and under the shelf — where the reference
 * puts a row of bestsellers — that training's own information.
 *
 * WHAT IT REPLACES
 * ----------------
 * A `book-shelf` block holding UG Programmes, PG Programmes and Research
 * Centers — Nagarjuna's, not Torii's, and there because Torii's deck began as a
 * mirror of NGI's. NGI and NCET keep theirs; this is a different block type so
 * nothing they use is touched.
 *
 * EVERYTHING IN `TRAININGS` BELOW IS PLACEHOLDER
 * ----------------------------------------------
 * The names, the lengths, the levels, the prose and the outcomes are all
 * invented to give the shelf something to stand on while the layout is being
 * agreed. The *subjects* are not invented — they are the ones Torii's own
 * Executive Summary names: coding, aptitude, communication, AI interviews and
 * placement, ending in certifications from AWS, Google Cloud, ServiceNow and
 * Snowflake. Replace the whole list when the real one arrives; nothing here
 * should reach a room.
 */
const fs = require('fs');
const path = require('path');
const http = require('http');

const ROOT = path.resolve(__dirname, '..');
const DB = path.join(ROOT, 'backend/data/db.json');
const BACKUPS = path.join(ROOT, 'backend/data/backups');
const HOST = { host: '127.0.0.1', port: Number(process.env.PORT) || 4173 };

const arg = (n, d = null) => {
  const i = process.argv.indexOf(`--${n}`);
  return i > -1 && process.argv[i + 1] && !process.argv[i + 1].startsWith('--') ? process.argv[i + 1] : d;
};
const ORG = arg('org', 'torii');
const KEY = 'programs';
const DRY = process.argv.includes('--dry');

/* Photographs of a programme are dropped in `incoming/Trainings/<programme
   name>/` — the folder named exactly as the programme is — and are copied to
   `uploads/Trainings/<slug>/`. A programme with no folder, or an empty one, has
   no photographs and its open page does not scroll. */
const PHOTO_SRC = path.join(ROOT, 'incoming/Trainings');
const BASE = 'Trainings';
const PHOTO_DEST = path.join(ROOT, 'backend/uploads', BASE);
const slug = (x) => String(x).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');

const pngSize = (b) => (b.length > 24 && b.toString('ascii', 12, 16) === 'IHDR'
  ? { w: b.readUInt32BE(16), h: b.readUInt32BE(20) } : null);
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
/** Size plus a real completeness check — a truncated file still reports a size. */
function readImage(abs) {
  const ext = path.extname(abs).toLowerCase();
  if (!['.jpg', '.jpeg', '.png', '.webp'].includes(ext)) return { skip: `${ext || 'no extension'} — not an image` };
  const buf = fs.readFileSync(abs);
  const size = ext === '.png' ? pngSize(buf) : jpegSize(buf);
  const tail = buf.slice(-8).toString('hex');
  const whole = ext === '.png' ? tail.includes('49454e44') : tail.endsWith('ffd9');
  if (!size) return { skip: 'unreadable' };
  if (!whole) return { skip: 'truncated' };
  return { buf, ext, size };
}
function photosFor(name) {
  const dir = path.join(PHOTO_SRC, name);
  if (!fs.existsSync(dir) || !fs.statSync(dir).isDirectory()) return [];
  const out = [];
  const dest = path.join(PHOTO_DEST, slug(name));
  for (const file of fs.readdirSync(dir).sort()) {
    const img = readImage(path.join(dir, file));
    if (img.skip) { if (!/^readme/i.test(file)) console.log(`     skipped ${name}/${file}  (${img.skip})`); continue; }
    const rel = `${slug(name)}/${String(out.length + 1).padStart(2, '0')}${img.ext}`;
    if (!DRY) { fs.mkdirSync(dest, { recursive: true }); fs.writeFileSync(path.join(PHOTO_DEST, rel), img.buf); }
    out.push({ src: rel, alt: name, w: img.size.w, h: img.size.h });
  }
  return out;
}

/* The seven programmes Torii runs, as the user gave them: a name, what kind of
   programme it is, and its syllabus. The descriptions are written from those
   syllabuses and from nothing else — no duration, no cohort size and no outcome
   is stated anywhere, because none was supplied.

   The covers are white into red, and these are which red: a walk either side of
   Torii's own #D91823, measured off the polo in the team photographs, so the
   shelf reads as a set of related books rather than one book printed seven
   times. The foot of each cover carries the size of its syllabus, which is
   counted from the list rather than written down twice. */
const TRAININGS = [
  {
    name: 'Ninja',
    track: 'Foundation',
    tint: '#D91823',
    blurb: 'Where everyone starts. C first, because it makes memory, control flow and the cost of a line impossible to hand-wave — then Python, for the speed of getting an idea running. A trainee leaves able to read code they did not write.',
    subjects: ['C Programming', 'Python'],
  },
  {
    name: 'Ninja Plus',
    track: 'Core computer science',
    tint: '#B00E1B',
    blurb: 'The computer science every technical round assumes you already have. Java as a working language, then the three that sit underneath the questions: how data is structured, how databases are built and queried, and how to tell one algorithm from another.',
    subjects: ['Java', 'Data Structures', 'DBMS', 'DAA'],
  },
  {
    name: 'Ninja Pro',
    track: 'Industry tracks',
    tint: '#8E0A15',
    blurb: 'Seven tracks, each one a job title. Cloud on AWS, analytics, security, full stack and mobile with Flutter — alongside ServiceNow and Salesforce, the two enterprise platforms that hire on the platform itself. Trainees pick a direction and go deep.',
    subjects: ['AWS', 'Data Analytics', 'Cyber Security', 'Full Stack Development', 'Flutter', 'ServiceNow', 'Salesforce'],
  },
  {
    name: 'AI Ready Engineer',
    track: 'Complete AI syllabus',
    tint: '#F05D29',
    blurb: 'The whole of AI, taught as a working practice rather than a topic. How large language models behave and where they fail, how to ground them with RAG, how to prompt precisely, how to build alongside them in Claude Code — and where the security of all of it ends.',
    subjects: ['Claude Code', 'LLMs', 'RAG Systems', 'Generative AI', 'Vibe Coding', 'Prompt Engineering', 'AI Security'],
  },
  {
    name: 'Industry Readiness Program',
    track: 'Aptitude & problem solving',
    tint: '#C41220',
    blurb: 'The round before the technical round. Aptitude and problem solving worked against the clock, because on the day the clock is the difficulty — and a trainee who has only ever solved untimed is meeting it for the first time in the exam hall.',
    subjects: ['Problem Solving'],
  },
  {
    name: 'LaunchPad',
    track: 'Entry level',
    tint: '#E8452C',
    blurb: 'The first rung, for trainees starting from nothing. Basic C for the habit of thinking in ordered steps, and the tools an office actually runs on — so somebody is useful in their first week, whichever way they go afterwards.',
    subjects: ['Basic C Programming', 'Excel', 'PowerPoint', 'Power BI'],
  },
  {
    name: 'Skill Sprint',
    track: 'On demand',
    tint: '#CE1F2E',
    blurb: 'Short workshops, called rather than scheduled. A tool a team needs this month, a company stack before a drive, a gap a cohort has just found in itself — run in days instead of waiting for the next term to come round.',
    subjects: [],
  },
];

/* The foot of each cover. Counted, never written: "7 subjects" and a list of
   six would be the kind of disagreement nobody notices until a room does. */
TRAININGS.forEach((t) => {
  t.duration = t.subjects.length
    ? `${t.subjects.length} subject${t.subjects.length === 1 ? '' : 's'}`
    : 'On demand';
  t.photos = photosFor(t.name);
});


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

(async () => {
  const block = {
    type: 'training-shelf',
    layout: { x: 0, y: 0, w: 12, h: 15 },
    eyebrow: 'Torii Minds',
    title: 'Trainings',
    lead: 'Every programme we run, on one shelf. Take one off it to read what is in it.',
    base: BASE,
    openLabel: 'Open the programme',
    backLabel: 'Back to the shelf',
    teachLabel: 'What we teach',
    photosLabel: 'From the programme',
    trainings: TRAININGS,
  };

    TRAININGS.forEach((t, i) => console.log(`  ${String(i + 1).padStart(2)}  ${t.tint}  ${t.track.padEnd(28)}`
    + `${t.name.padEnd(28)} ${t.duration.padEnd(11)} ${String(t.photos.length).padStart(2)} photo(s)  ${t.subjects.join(' · ') || '—'}`));
  console.log(`
  ${TRAININGS.length} programmes, `+ `${TRAININGS.reduce((n, t) => n + t.subjects.length, 0)} subjects${DRY ? '   (dry run)' : ''}`);

  const db = JSON.parse(fs.readFileSync(DB, 'utf8'));
  const section = db.sections.find((s) => s.orgId === ORG && s.key === KEY);
  if (!section) throw new Error(`no "${KEY}" section in "${ORG}"`);
  const was = (section.blocks || [])[0];
  console.log(`\n  ${ORG} / ${section.title}: ${was ? was.type : 'blank'} -> training-shelf`);
  if (was?.type === 'book-shelf') {
    console.log(`  dropping ${(was.books || []).length} book(s): ${(was.books || []).map((b) => b.title).join(', ')}`);
    console.log('  (Nagarjuna\'s, not Torii\'s — they came across with the mirror.)');
  }
  if (DRY) return;

  fs.mkdirSync(BACKUPS, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const saved = path.join(BACKUPS, `db-before-trainings-${ORG}-${stamp}.json`);
  fs.copyFileSync(DB, saved);
  JSON.parse(fs.readFileSync(saved, 'utf8'));
  console.log(`  backup  backend/data/backups/${path.basename(saved)}`);

  const admin = (await request('POST', '/api/auth/login', { email: (process.env.ADMIN_EMAIL || 'Torii@123.com'), password: (process.env.ADMIN_PASSWORD || 'Admin@123') }))
    .setCookie.match(/op_session=([^;]+)/)[1];
  await request('PATCH', `/api/sections/${section.id}`, { blocks: [block] }, admin);

  const stored = (await request('GET', `/api/sections/${section.id}`, null, admin)).json.section.blocks[0];
  console.log(`\n  stored: ${stored.type}  ${stored.trainings.length} training(s)  `
    + `tints ${[...new Set(stored.trainings.map((t) => t.tint))].length} distinct`);

  for (const other of ['technical-hub', 'ncet']) {
    const s = db.sections.find((x) => x.orgId === other && x.key === KEY);
    console.log(`  ${other.padEnd(14)} unchanged: ${JSON.stringify(s?.title)} — ${(s?.blocks || [])[0]?.type}`);
  }
})().catch((e) => { console.error('  ERROR ' + e.message); process.exitCode = 1; });
