/**
 * Torii's Trainings, as the curriculum deck.
 *
 *   node tools/publish-curriculum.cjs [--dry]
 *
 * Needs the app server, restarted after the `curriculum-deck` block type was
 * added to the schema. Backs the store up first.
 *
 * EVERY WORD BELOW IS THE USER'S, AND THERE IS NOTHING ELSE.
 * ---------------------------------------------------------
 * The brief was explicit twice over: the main heading, "WHAT WE TEACH", and the
 * numbered sub-headings — no descriptions, no learning outcomes, no extra
 * topics, no extra programmes, nothing invented. So this file holds exactly the
 * eight programmes and their sub-headings as supplied, in the order supplied,
 * spelt as supplied.
 *
 * The block type has no field for a description either. That is deliberate: a
 * field nobody fills is a field somebody fills later by accident, and the whole
 * point of this pass was taking those descriptions off.
 *
 * WHAT THIS REPLACES. The row held a `training-shelf` — the bookshelf built to
 * a reference image, with seven programmes, each carrying a description, a
 * syllabus and a photographs slot. It is not deleted: the component, its
 * stylesheet and its schema all stand, the renderer still knows the type, and
 * the whole block is in the backup this writes. Point the row back at it and it
 * works exactly as it did.
 */
const fs = require('fs');
const path = require('path');
const http = require('http');

const ROOT = path.resolve(__dirname, '..');
const DB = path.join(ROOT, 'backend/data/db.json');
const BACKUPS = path.join(ROOT, 'backend/data/backups');
const HOST = { host: '127.0.0.1', port: Number(process.env.PORT) || 4173 };
const DRY = process.argv.includes('--dry');

const PROGRAMS = [
  {
    name: 'Programming Foundations',
    topics: [
      'C Programming',
      'Python Programming',
      'Problem Solving — Level 1',
      'Coding Platform Onboarding',
      'Prompt Engineering & GPT Models',
    ],
  },
  {
    name: 'Data Structures, Java & Databases',
    topics: [
      'Data Structures & Algorithms',
      'Java Programming',
      'SQL & NoSQL',
      'Problem Solving — Level 2',
      'GitHub Copilot, GPT & Basic LLM',
    ],
  },
  {
    name: 'AI Ready',
    topics: [
      'AI Ready Engineer Roadmap',
      'Advanced Data Structures (ADS)',
      'Advanced Problem Solving',
      'AI Projects',
      "The 3 C's — Claude, Codex, Copilot",
    ],
  },
  {
    name: 'FDE Role',
    topics: [
      'Forward Deployed Engineering',
      'Deployment',
      'AI Testing',
      'AI Security',
      'Placement Training',
    ],
  },
  {
    name: 'ServiceNow',
    topics: [
      'ServiceNow Platform Overview',
      'ServiceNow Instance & Navigation',
      'Lists, Filters & Forms',
      'Form Configuration',
      'Incident Management',
      'Change & Problem Management',
      'Reporting & Dashboards',
      'Service Catalog',
      'Tables & Data Schema',
      'Access Control',
      'CMDB',
      'UI Policies & Business Rules',
      'Flow Designer',
      'Application Development',
      'Scripting Basics',
    ],
  },
  {
    name: 'FSD',
    topics: [
      'HTML & CSS',
      'JavaScript',
      'React',
      'Backend Development',
      'Databases',
      'REST APIs',
      'Git & GitHub',
      'Full Stack Projects',
    ],
  },
  {
    name: 'Flutter',
    topics: [
      'Dart Programming',
      'Flutter Fundamentals',
      'UI Development',
      'State Management',
      'API Integration',
      'Firebase',
      'App Development Projects',
    ],
  },
  {
    name: 'AWS',
    topics: [
      'Cloud Fundamentals',
      'IAM',
      'EC2',
      'S3',
      'RDS',
      'VPC',
      'AWS Deployment',
    ],
  },
];

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
        if (res.statusCode >= 400) return reject(new Error(`${method} ${p} -> ${res.statusCode} ${b.slice(0, 250)}`));
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
  const db = JSON.parse(fs.readFileSync(DB, 'utf8'));
  const section = db.sections.find((s) => s.orgId === 'torii' && s.key === 'programs' && !s.parentId);
  if (!section) throw new Error('no Trainings row on torii');

  const block = {
    id: section.blocks[0]?.id || undefined,
    type: 'curriculum-deck',
    layout: { x: 0, y: 0, w: 12, h: 15 },
    eyebrow: 'Torii Minds',
    title: 'Trainings',
    teachLabel: 'What we teach',
    backLabel: 'All programmes',
    programs: PROGRAMS,
  };

  console.log(`  Trainings: ${section.blocks.map((b) => b.type).join(', ')} -> curriculum-deck`);
  PROGRAMS.forEach((p, i) => console.log(`    ${String(i + 1).padStart(2)}  ${p.name.padEnd(34)} ${String(p.topics.length).padStart(2)} topics`));
  console.log(`    ${PROGRAMS.length} programmes, ${PROGRAMS.reduce((n, p) => n + p.topics.length, 0)} topics, 0 descriptions`);
  if (DRY) { console.log('\n  dry run — nothing written'); return; }

  fs.mkdirSync(BACKUPS, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const saved = path.join(BACKUPS, `db-before-curriculum-${stamp}.json`);
  fs.copyFileSync(DB, saved);
  JSON.parse(fs.readFileSync(saved, 'utf8'));
  console.log(`\n  backup  backend/data/backups/${path.basename(saved)}   (the bookshelf, whole)`);

  const admin = (await request('POST', '/api/auth/login', {
    email: process.env.ADMIN_EMAIL || 'Torii@123.com',
    password: process.env.ADMIN_PASSWORD || 'Admin@123',
  })).setCookie.match(/op_session=([^;]+)/)[1];
  await request('PATCH', `/api/sections/${section.id}`, { blocks: [block] }, admin);

  /* Read back through the API — the normaliser is the authority on what stuck. */
  const back = (await request('GET', '/api/orgs/torii/sections', null, admin)).json.sections;
  const got = back.find((x) => x.id === section.id).blocks[0];
  console.log('');
  console.log(`  read back  type      ${got.type}`);
  console.log(`             title     ${JSON.stringify(got.title)} · label ${JSON.stringify(got.teachLabel)}`);
  console.log(`             programmes ${got.programs.map((p) => `${p.name} (${p.topics.length})`).join(' · ')}`);
  const stray = got.programs.filter((p) => Object.keys(p).some((k) => !['name', 'topics'].includes(k)));
  console.log(`             stray fields on a programme: ${stray.length} (expect 0)`);
})().catch((e) => { console.error('  ERROR ' + e.message); process.exitCode = 1; });
