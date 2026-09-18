/**
 * Publishes Torii's Certifications: the register and the skills, from the two
 * tables the user supplied, with no gallery.
 *
 *   node tools/publish-torii-certifications.cjs [--port 9371] [--org torii] [--dry]
 *
 * Needs the app server on 4173 and a headless Chrome for four crops.
 *
 * THE NUMBERS ARE THE USER'S, TO THE UNIT
 * ---------------------------------------
 * Two screenshots (2026-09-16): a total of 3,120 certifications split by year
 * — B.E 1st 1,277 · 2nd 1,070 · 3rd 595 · 4th (ServiceNow) 178 — and fifteen
 * credentials with a count and a year each, summing to the same 3,120. Both are
 * transcribed here as given. The register's total is not typed in anywhere: the
 * component sums the credentials, and the sum is 3,120 because the table's is.
 * The "16,000+ Trainees Certified" figure Torii inherited from NGI's block is
 * gone from this deck (`trainees` is left unset); NGI and NCET keep it, written
 * onto their blocks by this same script so nothing they showed changes.
 *
 * NO GALLERY
 * ----------
 * `vendors` is emptied. The component draws the third act only where there is
 * cohort artwork, so the tab goes with it — nothing in the component is
 * hard-coded to Torii.
 *
 * THE BADGES
 * ----------
 * Preference order, as asked: the credential's own badge where the library has
 * one; a badge of the same vendor where it has not; a badge cropped from the
 * cohort card where the card carries the real one; and the vendor set in type
 * as the last resort. Four are cropped through the canvas from cards in the
 * user's own library and in `Certification Images Sorted` — the Red Hat Python
 * badge, Oracle's Database Foundations badge, the Postman Student Expert badge
 * and the CodeChef lockup — and written to `uploads/certifications/torii/`.
 * Nothing is hand-drawn. Infosys Springboard and IBM SkillsBuild have no
 * artwork anywhere in the library and stand in type.
 *
 * THE SKILLS
 * ----------
 * Four lines per credential, describing what the named certification covers
 * as its awarding body publishes it. They are descriptions of syllabi, not
 * claims about anyone's results.
 */
const fs = require('fs');
const path = require('path');
const http = require('http');
const { connect, evaluate } = require('./lib/cdp.cjs');

const ROOT = path.resolve(__dirname, '..');
const UPLOADS = path.join(ROOT, 'backend/uploads');
const OUT_DIR = path.join(UPLOADS, 'certifications/torii');
const LIB = 'C:/Users/HP/Downloads/TORII/Torii/Torii/certifications';
const DB = path.join(ROOT, 'backend/data/db.json');
const BACKUPS = path.join(ROOT, 'backend/data/backups');
const HOST = { host: '127.0.0.1', port: Number(process.env.PORT) || 4173 };

const arg = (n, d = null) => {
  const i = process.argv.indexOf(`--${n}`);
  return i > -1 && process.argv[i + 1] && !process.argv[i + 1].startsWith('--') ? process.argv[i + 1] : d;
};
const ORG = arg('org', 'torii');
const KEY = 'certifications';
const DRY = process.argv.includes('--dry');
const PORT = Number(arg('port', 9371));

/* The four crops: source, the region (source pixels), the output name. Regions
   read off the cards by eye and then checked on screen. */
const CROPS = [
  { name: 'redhat-python-programming-course-attendance.png', src: path.join(LIB, 'RedHat Badge', '1766485139993.jpg'), box: { left: 1046, top: 686, right: 1500 - 1228, bottom: 1500 - 868 } },
  { name: 'oracle-certified-foundations-associate-database.png', src: path.join(LIB, 'Oracle', '1766141830246.jpg'), box: { left: 1236, top: 678, right: 1500 - 1416, bottom: 1500 - 850 } },
  { name: 'postman-api-fundamentals-student-expert.png', src: path.join(UPLOADS, 'certifications/Certification Images  Sorted/postman/Postman API Fundmentals Student Exper_150+.jpg'), box: { left: 838, top: 732, right: 1080 - 1052, bottom: 1080 - 948 } },
  { name: 'codechef.png', src: path.join(LIB, 'CodeChef', '1782134006804.jpg'), box: { left: 712, top: 36, right: 1080 - 1048, bottom: 1080 - 150 } },
];
const T = 'certifications/torii';

/* The fifteen, as the user's table has them: name, count, where. */
const CREDENTIALS = [
  { name: 'Cisco — Python Essentials 1', vendor: 'Cisco', held: 312, where: '1st year',
    badge: 'certifications/badges/cisco-certified-ccna.png',
    skills: ['Python syntax, data types and operators', 'Control flow, loops and functions', 'Lists, tuples, dictionaries and strings', 'Reading errors and debugging simple programs'] },
  { name: 'Cisco — C Essentials 1', vendor: 'Cisco', held: 442, where: '250 (1st year) + 192 (2nd year)',
    badge: 'certifications/logos/cla-c-certified-associate-programmer.png',
    skills: ['C syntax, types and expressions', 'Control statements and functions', 'Arrays, pointers and strings', 'Structures, files and the preprocessor'] },
  { name: 'Cisco — 3rd-year course certifications', vendor: 'Cisco', held: 263, where: '3rd year',
    badge: 'coe/cisco.webp',
    skills: ['Networking fundamentals and the OSI model', 'IP addressing and subnetting', 'Switching, routing and VLANs', 'Network security basics'] },
  { name: 'Red Hat — Python Programming (Course Attendance)', vendor: 'Red Hat', held: 554, where: '354 (1st year) + 200 (2nd year)',
    badge: `${T}/redhat-python-programming-course-attendance.png`,
    skills: ['Python on Red Hat Enterprise Linux', 'Data structures and modules', 'Files, exceptions and the standard library', 'Object-oriented Python'] },
  { name: 'Red Hat — Application Development I: Java EE', vendor: 'Red Hat', held: 190, where: '2nd year',
    badge: 'certifications/badges/redhat-certified-system-administrator.png',
    skills: ['Enterprise Java on JBoss EAP', 'CDI, JPA and transactions', 'REST services with JAX-RS', 'Packaging and deploying an application'] },
  { name: 'CodeChef', vendor: 'CodeChef', held: 541, where: '361 (1st year) + 180 (2nd year)',
    badge: `${T}/codechef.png`,
    skills: ['Problem solving under time limits', 'Algorithms and data structures', 'Rated contests and practice tracks', 'Reading constraints and writing tests'] },
  { name: 'Oracle — Certified Foundations Associate, Java', vendor: 'Oracle', held: 183, where: '2nd year',
    badge: 'certifications/badges/oracle-foundation-associate-java.png',
    skills: ['Java basics, types and operators', 'Classes, objects and methods', 'Loops, arrays and strings', 'Exceptions and the Java runtime'] },
  { name: 'Oracle — Certified Professional, Database PL/SQL Developer', vendor: 'Oracle', held: 125, where: '2nd year',
    badge: `${T}/oracle-certified-foundations-associate-database.png`,
    skills: ['PL/SQL blocks, variables and control', 'Cursors and exception handling', 'Procedures, functions and packages', 'Triggers and dependencies'] },
  { name: 'ServiceNow — Certified System Administrator (CSA)', vendor: 'ServiceNow', held: 95, where: '4th year',
    badge: 'certifications/badges/servicenow-certified-system-administrator.png',
    skills: ['Platform navigation and the user interface', 'Tables, forms, lists and data', 'Users, groups, roles and access', 'Workflows, notifications and reporting'] },
  { name: 'ServiceNow — Certified Application Developer (CAD)', vendor: 'ServiceNow', held: 83, where: '4th year',
    badge: 'certifications/badges/servicenow-certified-application-developer.webp',
    skills: ['Application design and the App Engine', 'Server and client scripting', 'Security and access control', 'Flow Designer and integrations'] },
  { name: 'ServiceNow — Micro-Certification, Welcome to ServiceNow', vendor: 'ServiceNow', held: 37, where: '3rd year',
    badge: 'coe/servicenow.png',
    skills: ['What the Now Platform is', 'Navigating the instance', 'Lists, forms and records', 'Where ITSM fits'] },
  { name: 'Infosys Springboard', vendor: 'Infosys', held: 116, where: '3rd year',
    badge: '',
    skills: ['Self-paced courses across technology and business', 'Programming and problem-solving tracks', 'Assessments with completion certificates', 'Industry-aligned learning paths'] },
  { name: 'IBM SkillsBuild', vendor: 'IBM', held: 82, where: '3rd year',
    badge: '',
    skills: ['Cloud, data and AI fundamentals', 'Digital badges on completion', 'Professional and workplace skills', 'Hands-on labs on IBM tooling'] },
  { name: 'Snowflake', vendor: 'Snowflake', held: 72, where: '3rd year',
    badge: 'coe/snowflake.png',
    skills: ['The Snowflake Data Cloud and its architecture', 'Warehouses, databases and stages', 'Loading and querying data with SQL', 'Roles, sharing and governance basics'] },
  { name: 'Postman — API Fundamentals Student Expert', vendor: 'Postman', held: 25, where: '3rd year',
    badge: `${T}/postman-api-fundamentals-student-expert.png`,
    skills: ['What an API is and how HTTP requests work', 'Sending requests and reading responses', 'Variables, collections and environments', 'Writing tests and documenting an API'] },
];
const YEARS = [
  { label: 'B.E 1st year', count: 1277 },
  { label: 'B.E 2nd year', count: 1070 },
  { label: 'B.E 3rd year', count: 595 },
  { label: 'B.E 4th year · ServiceNow', count: 178 },
];
const TOTAL = 3120;

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
  const sum = CREDENTIALS.reduce((n, c) => n + c.held, 0);
  const ySum = YEARS.reduce((n, y) => n + y.count, 0);
  console.log(`  ${CREDENTIALS.length} credentials sum to ${sum}; the years sum to ${ySum}; the table says ${TOTAL}`);
  if (sum !== TOTAL || ySum !== TOTAL) throw new Error('the transcription does not add up — fix the table before publishing');

  /* The crops. */
  const cdp = await connect(PORT);
  await cdp.send('Runtime.enable');
  fs.mkdirSync(OUT_DIR, { recursive: true });
  for (const c of CROPS) {
    if (!fs.existsSync(c.src)) { console.log(`  !! crop source missing: ${c.src}`); continue; }
    const buf = fs.readFileSync(c.src);
    const res = await evaluate(cdp, `(async () => {
      const im = new Image(); im.src = ${JSON.stringify(`data:image/jpeg;base64,${buf.toString('base64')}`)}; await im.decode();
      const b = ${JSON.stringify(c.box)};
      const sw = im.naturalWidth - b.left - b.right, sh = im.naturalHeight - b.top - b.bottom;
      const out = 320, scale = Math.min(1, out / Math.max(sw, sh));
      const w = Math.round(sw * scale), h = Math.round(sh * scale);
      const cv = document.createElement('canvas'); cv.width = w; cv.height = h;
      const x = cv.getContext('2d'); x.imageSmoothingQuality = 'high';
      x.drawImage(im, b.left, b.top, sw, sh, 0, 0, w, h);
      return { w, h, from: sw + 'x' + sh, url: cv.toDataURL('image/png') };
    })()`);
    const bytes = Buffer.from(res.url.split(',')[1], 'base64');
    if (!bytes.slice(-8).toString('hex').includes('49454e44')) throw new Error(`${c.name}: output is not a complete PNG`);
    if (!DRY) fs.writeFileSync(path.join(OUT_DIR, c.name), bytes);
    console.log(`  crop  ${c.name.padEnd(56)} ${res.from} -> ${res.w}x${res.h}  ${Math.round(bytes.length / 1024)}kB`);
  }
  cdp.close();

  /* Every badge named must be a file. */
  const credentials = CREDENTIALS.map((c) => {
    const badge = c.badge && fs.existsSync(path.join(UPLOADS, c.badge)) ? c.badge : '';
    if (c.badge && !badge) console.log(`  !! badge missing on disk, falling back to type: ${c.badge}`);
    return { name: c.name, vendor: c.vendor, domain: c.where, held: c.held, badge, skills: c.skills };
  });
  const typed = credentials.filter((c) => !c.badge).map((c) => c.vendor);
  console.log(`  badges: ${credentials.length - typed.length} with artwork, ${typed.length} set in type (${typed.join(', ')})`);

  const db = JSON.parse(fs.readFileSync(DB, 'utf8'));
  const section = db.sections.find((s) => s.orgId === ORG && s.key === KEY);
  if (!section) throw new Error(`no "${KEY}" section in "${ORG}"`);
  const was = section.blocks[0];
  if (was.type !== 'certification-wall') throw new Error(`expected a certification-wall, found ${was.type}`);

  const block = {
    ...was,
    credentials,
    vendors: [],          // no cohort artwork here, so no gallery act
    years: YEARS,
    trainees: '',         // the total stands alone in the middle
    quoteBy: was.quoteBy && /Technical Hub/i.test(was.quoteBy) ? 'Torii Minds' : was.quoteBy,
  };
  delete block.id;

  console.log(`\n  ${ORG} / ${section.title}: ${was.credentials.length} credentials, ${was.vendors.length} vendors -> ${credentials.length} credentials, no gallery, total ${sum}`);
  if (DRY) { console.log('  dry run — nothing written'); return; }

  fs.mkdirSync(BACKUPS, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const saved = path.join(BACKUPS, `db-before-certifications-${ORG}-${stamp}.json`);
  fs.copyFileSync(DB, saved);
  JSON.parse(fs.readFileSync(saved, 'utf8'));
  console.log(`  backup  backend/data/backups/${path.basename(saved)}`);

  const admin = (await request('POST', '/api/auth/login', { email: (process.env.ADMIN_EMAIL || 'Torii@123.com'), password: (process.env.ADMIN_PASSWORD || 'Admin@123') }))
    .setCookie.match(/op_session=([^;]+)/)[1];
  await request('PATCH', `/api/sections/${section.id}`, { blocks: [block] }, admin);

  /* The other decks showed "16,000+ Trainees Certified" as a literal in the
     component; it is a field now, so it is written onto their blocks. */
  for (const org of ['technical-hub', 'ncet']) {
    const o = db.sections.find((s) => s.orgId === org && s.key === KEY);
    if (!o || !o.blocks[0] || o.blocks[0].type !== 'certification-wall') continue;
    if (o.blocks[0].trainees) continue;
    const b = { ...o.blocks[0], trainees: '16,000+' }; delete b.id;
    await request('PATCH', `/api/sections/${o.id}`, { blocks: [b] }, admin);
    console.log(`  ${org}: trainees figure kept as "16,000+"`);
  }

  const stored = (await request('GET', `/api/sections/${section.id}`, null, admin)).json.section.blocks[0];
  const storedSum = stored.credentials.reduce((n, c) => n + c.held, 0);
  console.log(`\n  stored: ${stored.credentials.length} credentials totalling ${storedSum} · ${stored.vendors.length} vendors · years ${stored.years.map((y) => y.count).join('+')} · trainees "${stored.trainees}"`);
  const gone = stored.credentials.filter((c) => c.badge && !fs.existsSync(path.join(UPLOADS, c.badge)));
  console.log(gone.length ? `  !! ${gone.length} badge(s) missing` : '  every badge named resolves to a file on disk');
})().catch((e) => { console.error('  ERROR ' + e.message); process.exitCode = 1; });
