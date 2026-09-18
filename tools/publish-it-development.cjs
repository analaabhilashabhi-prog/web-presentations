/**
 * Publishes Torii's IT Development as the Project Showcase.
 *
 *   node tools/publish-it-development.cjs [--org torii] [--mocks] [--dry]
 *
 * Needs the app server on 4173. No Chrome and no media conversion: everything
 * it places is already in the library.
 *
 * THE SLIDE
 * ---------
 * The page the user supplied, ported as the `project-showcase` block: paper
 * files on the left, a desk rig on the right, the project's name set huge
 * behind the monitor. Opening a file plays that product's screen recording on
 * the monitor; "Open website" swaps the recording for the product itself, live,
 * inside the same screen and under the same perspective.
 *
 * WHERE THE CONTENT COMES FROM
 * ----------------------------
 * The entries are the ones the Platforms block already carries — the "Built to
 * Deliver" panel — read out of that block rather than retyped, so the names,
 * the live URLs and the demo logins cannot drift from what the rest of the deck
 * shows. A platform with `views` (AI Engineer LMS and TAG, each a portal and an
 * admin console) becomes one entry per view, which is how that panel lists
 * them: seven files on the shelf from five products.
 *
 * Torii's own copy of that block is the one this slide replaced, so the block
 * is read from NGI, which still has it untouched.
 *
 * THE RECORDINGS
 * --------------
 * `uploads/platforms/<shot>.mp4`, the same files the Platforms wall plays:
 * myna, owlcoder, torii-minds, ai-engineer-lms, ai-engineer-lms-admin, tag,
 * tag-admin.
 *
 * THE BADGE IS A LETTER, NOT A LOGO
 * ---------------------------------
 * The supplied design puts a 40px round badge on each file with the product's
 * initial in it. On 2026-09-17 the user supplied five logos in
 * `Downloads/TORII/It Development logos` and asked for them on the cards, by
 * name. They are filed under `uploads/Showcase/logos/` with plain names, and
 * `LOGOS` below maps each product to its file; the two views of one product
 * share one logo. The component draws a logo on a white plate the same 40px
 * tall as the disc and as wide as the wordmark needs — see `.logo.has-art` in
 * the stylesheet — and a product not in `LOGOS` keeps the initial.
 *
 * One of the five needed a crop: `AI ready engineer logo.png` is a 4500x4500
 * canvas with the mark in a 3,586x996 band across its middle and transparent
 * everywhere else, which contained into a 40px plate would have been a 9px
 * sliver. `crop-image.cjs` cut it to the ink plus 40px of air (measured, not
 * eyeballed: the ink runs x 455–4041, y 1794–2790) at 0.125% ratio drift and
 * scaled it to 900 wide. PNG out, so the transparency survives — a JPEG would
 * have painted a white box, which on a white plate is invisible but on any
 * other ground would not be. The other four are copied as they are.
 *
 * The older `platform-logos/` wordmarks are not used here — three of those are
 * unreachable under the names the Platforms data uses anyway (`owlcoder.png`
 * against `Owl Coder.png` on disk).
 *
 * STILL DUMMY, ON REQUEST
 * -----------------------
 * The descriptions, feature lists and stacks are placeholders, written from the
 * one-line blurbs the Platforms block carries and from nothing else. Nothing in
 * them is a claim about what is built. Replace `COPY` when the real text
 * arrives.
 *
 * CREDENTIALS ARE NEVER PRINTED
 * -----------------------------
 * The logins travel with each project so a presenter can put one on the
 * clipboard from the slide, and the component never draws the values. That rule
 * is `Platforms.js`'s and it holds here: a password on a three-metre screen is
 * a password given away.
 *
 * ABOUT `site` AND THE REAL WEB
 * -----------------------------
 * The monitor opens each product's real URL in an iframe. Checked 2026-09-16:
 * all five hosts answer 200 and none sends `X-Frame-Options` or a
 * `frame-ancestors` policy, so they can be framed. Two things will still stop
 * it — there is no internet in the room at presentation time, and a site that
 * adds that header later goes blank. `--mocks` writes an offline stand-in per
 * entry into `uploads/Showcase/` and points the slide at those instead.
 */
const fs = require('fs');
const path = require('path');
const http = require('http');

const ROOT = path.resolve(__dirname, '..');
const BASE = 'Showcase';
const DEST = path.join(ROOT, 'backend/uploads', BASE);
const DB = path.join(ROOT, 'backend/data/db.json');
const BACKUPS = path.join(ROOT, 'backend/data/backups');
const HOST = { host: '127.0.0.1', port: Number(process.env.PORT) || 4173 };

const arg = (n, d = null) => {
  const i = process.argv.indexOf(`--${n}`);
  return i > -1 && process.argv[i + 1] && !process.argv[i + 1].startsWith('--') ? process.argv[i + 1] : d;
};
const ORG = arg('org', 'torii');
const KEY = 'it-development';
const DRY = process.argv.includes('--dry');
const MOCKS = process.argv.includes('--mocks');

/* Where the screen recordings live, keyed by each entry's `shot`. */
const SHOT_DIR = 'platforms';
const SHOT_EXT = ['mp4', 'webm'];

/* Placeholder copy, by platform name — see "STILL DUMMY" above. */
const COPY = {
  MYNA: {
    description: 'The learner portal: a trainee’s day-to-day home — what to do next, what has been finished, and how far along the path they are.',
    features: ['Every active course in one place', 'Progress a learner can see', 'Skills and collaboration', 'Credits and rewards'],
    stack: ['Web', 'Mobile', 'REST API'],
  },
  OwlCoder: {
    description: 'Coding practice and assessment: problem sets a trainee works through, run and scored automatically, with the record kept against their profile.',
    features: ['Graded problem sets', 'Automatic evaluation', 'Attempt history per learner', 'Assessment mode for a batch'],
    stack: ['Web', 'Judge service', 'REST API'],
  },
  'Torii Minds & JPath': {
    description: 'The Torii learning platform and the JPath journey — the route a trainee takes from the first module to placement, and the site that carries it.',
    features: ['The learning path end to end', 'Journey tracking', 'Programme catalogue', 'One sign-in across Torii'],
    stack: ['Web', 'REST API'],
  },
  'AI Engineer LMS': {
    description: 'The AI Ready Engineer learning platform — the course itself for learners and trainers, with an admin console behind it for the people running the cohorts.',
    features: ['Course delivery and submissions', 'A trainer’s view of a batch', 'Cohort and content administration', 'Separate portal and admin sign-in'],
    stack: ['Web', 'LMS', 'REST API'],
  },
  TAG: {
    description: 'The NCET task and activity system — work raised, assigned and tracked across coordinators, designers and the social team, with an admin console over it.',
    features: ['Tasks raised and assigned', 'Role-based queues', 'Status through to done', 'Admin oversight of every queue'],
    stack: ['Web', 'REST API'],
  },
};

/* ------------------------------------------------------------------------ */
/* The offline stand-in, written only with --mocks: something for the monitor
   to open when the room has no internet. Small, because the monitor's screen is
   516x350 CSS pixels, and interactive, because the point of "Open website" is
   that the thing can be driven from the slide. */
function mockSite(name, url) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${name}</title>
<style>
  *{box-sizing:border-box;}
  body{margin:0;font:13px/1.45 system-ui,-apple-system,"Segoe UI",Arial,sans-serif;color:#1B1B1B;background:#F7F6F5;}
  header{display:flex;align-items:center;gap:10px;padding:10px 14px;background:#fff;border-bottom:1px solid rgba(27,27,27,.08);}
  .mark{width:18px;height:18px;border-radius:5px;background:#FF6F32;color:#fff;display:grid;place-items:center;font-size:11px;font-weight:700;}
  .brand{font-weight:600;letter-spacing:-.01em;}
  nav{margin-left:auto;display:flex;gap:4px;}
  nav button{border:0;background:none;font:inherit;font-size:11px;color:#6E6862;padding:4px 8px;border-radius:999px;cursor:pointer;}
  nav button[aria-current="true"]{background:#FF6F32;color:#fff;}
  main{padding:14px;}
  h1{margin:0 0 3px;font-size:16px;letter-spacing:-.02em;}
  .sub{margin:0 0 12px;font-size:11.5px;color:#6E6862;}
  .out{margin-top:10px;font-size:11.5px;color:#2A2723;background:#fff;border:1px dashed #FF6F32;border-radius:8px;padding:8px 10px;}
  code{font-family:ui-monospace,Menlo,monospace;font-size:11px;}
</style>
</head>
<body>
<header>
  <span class="mark">${name.trim()[0]}</span>
  <span class="brand">${name}</span>
  <nav>
    <button type="button" aria-current="true">Overview</button>
    <button type="button">Access</button>
  </nav>
</header>
<main>
  <h1>Offline stand-in</h1>
  <p class="sub">The live product opens here when the room is online.</p>
  <div class="out" id="out">${name} runs at <code>${url || 'its own address'}</code>.</div>
</main>
<script>
  const out = document.getElementById('out');
  const text = { Overview: ${JSON.stringify(`${name} runs at ${url || 'its own address'}.`)},
                 Access: 'Demo logins are on the left of the slide \\u2014 press "user" or "pass" to copy one.' };
  document.querySelectorAll('nav button').forEach((b) => b.addEventListener('click', () => {
    document.querySelectorAll('nav button').forEach((x) => x.setAttribute('aria-current', String(x === b)));
    out.textContent = text[b.textContent];
  }));
</script>
</body>
</html>
`;
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

const slug = (v) => String(v || '').toLowerCase().trim()
  .replace(/&/g, ' ').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

(async () => {
  const uploads = path.join(ROOT, 'backend/uploads');
  const db = JSON.parse(fs.readFileSync(DB, 'utf8'));

  const from = db.sections.find((x) => x.orgId === 'technical-hub' && x.key === 'platforms')
    || db.sections.find((x) => (x.blocks || []).some((b) => b.type === 'platforms'));
  const source = from && (from.blocks || []).find((b) => b.type === 'platforms');
  if (!source) throw new Error('no platforms block anywhere to read the products from');
  console.log(`  products read from ${from.orgId}/${from.key} — "${source.title}"`);

  const shotFor = (name) => {
    for (const ext of SHOT_EXT) {
      const rel = `${SHOT_DIR}/${name}.${ext}`;
      if (fs.existsSync(path.join(uploads, rel))) return rel;
    }
    return null;
  };
  /* One entry per view, so a platform with a portal and an admin console is two
     files on the shelf — which is how the Platforms panel lists them. */
  const entries = [];
  for (const item of source.items || []) {
    const views = (item.views || []).length
      ? item.views
      : [{ label: '', shot: item.shot, url: item.url, logins: item.logins }];
    for (const v of views) {
      entries.push({
        platform: item.name,
        label: v.label || '',
        blurb: item.blurb || '',
        shot: v.shot || item.shot,
        url: v.url || item.url || '',
        logins: (v.logins && v.logins.length ? v.logins : item.logins) || [],
      });
    }
  }

  if (MOCKS && !DRY) fs.mkdirSync(DEST, { recursive: true });
  /* Keyed on the product name as the Platforms block spells it. Paths are
     relative to `/uploads` because the block's `base` is empty. */
  const LOGOS = {
    'MYNA': 'Showcase/logos/myna.png',
    'OwlCoder': 'Showcase/logos/owlcoder.png',
    'Torii Minds & JPath': 'Showcase/logos/jpath.png',
    'AI Engineer LMS': 'Showcase/logos/ai-ready-engineer.png',
    'TAG': 'Showcase/logos/tag.png',
  };
  const projects = entries.map((e) => {
    const film = shotFor(slug(e.shot));
    const copy = COPY[e.platform] || {};
    let site = e.url;
    if (MOCKS) {
      const dir = slug(`${e.platform} ${e.label}`);
      if (!DRY) {
        fs.mkdirSync(path.join(DEST, dir), { recursive: true });
        fs.writeFileSync(path.join(DEST, dir, 'index.html'), mockSite(e.platform, e.url));
      }
      site = `${BASE}/${dir}/index.html`;
    }
    const label = e.platform + (e.label ? ` · ${e.label}` : '');
    console.log(`  ${label.padEnd(30)} ${e.logins.length} login(s)  recording: ${(film ? path.basename(film) : '!! none').padEnd(26)} ${e.url || '!! no url'}`);
    return {
      name: e.platform,
      /* The tag is the small line under the name on the file. With two views of
         one product, the view has to be in it or the shelf shows the same name
         twice with no way to tell them apart. */
      tag: e.label ? `${e.label} · ${e.blurb}`.replace(/ · $/, '') : e.blurb,
      /* The product's own logo where one was supplied, else the initial. */
      logo: LOGOS[e.platform] || '',
      description: copy.description || '',
      features: copy.features || [],
      stack: copy.stack || [],
      links: { live: e.url, code: '' },
      media: film ? { type: 'video', src: film } : null,
      site,
      logins: e.logins.map((l) => ({ role: l.role, user: l.user, pass: l.pass })),
    };
  });

  const block = {
    type: 'project-showcase',
    layout: { x: 0, y: 0, w: 12, h: 15 },
    /* Recordings are `platforms/<shot>.mp4` and sites are absolute URLs, so
       every path is written whole and `base` stays empty. */
    base: '',
    brand: 'Torii Minds',
    defaultTitle: 'Torii Minds',
    projects,
  };

  const section = db.sections.find((s) => s.orgId === ORG && s.key === KEY);
  if (!section) throw new Error(`no "${KEY}" section in "${ORG}"`);
  const was = (section.blocks || [])[0];
  console.log(`\n  ${ORG} / ${section.title}: ${was ? was.type : 'blank'} -> project-showcase (${projects.length} entries from ${(source.items || []).length} products)`);
  if (DRY) { console.log('  dry run — nothing written'); return; }

  fs.mkdirSync(BACKUPS, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const saved = path.join(BACKUPS, `db-before-itdev-${ORG}-${stamp}.json`);
  fs.copyFileSync(DB, saved);
  JSON.parse(fs.readFileSync(saved, 'utf8'));
  console.log(`  backup  backend/data/backups/${path.basename(saved)}`);

  const admin = (await request('POST', '/api/auth/login', { email: 'admin@org.local', password: 'Admin@123' }))
    .setCookie.match(/op_session=([^;]+)/)[1];
  await request('PATCH', `/api/sections/${section.id}`, { blocks: [block] }, admin);

  const stored = (await request('GET', `/api/sections/${section.id}`, null, admin)).json.section.blocks[0];
  console.log(`\n  stored: ${stored.type}  ${stored.projects.length} project(s)`);
  const isLocal = (f) => f && !/^https?:\/\//i.test(f);
  const gone = stored.projects.flatMap((p) => [p.media && p.media.src, p.site])
    .filter(isLocal).filter((f) => !fs.existsSync(path.join(uploads, f)));
  console.log(gone.length ? `  !! missing on disk: ${gone.join(', ')}` : '  every recording and every local file resolves on disk');
  stored.projects.forEach((p) => {
    if (!p.site) console.log(`  !! ${p.name} lost its site in the schema`);
    if (!p.media) console.log(`     ${p.name} has no recording — shows the "demo is being prepared" card`);
  });
  const withLogins = stored.projects.filter((p) => p.logins.length).length;
  console.log(`  ${withLogins} of ${stored.projects.length} carry demo logins (copied from the slide, never drawn)`);
})().catch((e) => { console.error('  ERROR ' + e.message); process.exitCode = 1; });
