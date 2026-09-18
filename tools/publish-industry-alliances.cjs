/**
 * Builds the Industry Alliances section: the six MOUs, as an accordion.
 *
 *   node tools/publish-industry-alliances.cjs [--dry]
 *
 * Needs the app server on 4173.
 *
 * Safe to run twice. The section is found by key and created only if missing,
 * and a photograph already in the library is reused rather than uploaded again —
 * matched on the asset name, which is why every card names its own.
 *
 * THE PHOTOGRAPHS ARE NOT IN YET
 * ------------------------------
 * Every card is currently a plate in the partner's own colour. To give one its
 * photograph: put the file under `backend/uploads/` (or drop it in
 * `incoming/Industry Alliances/MOUs/` and move it), add
 * `photo: '<path under uploads>'` to that card below, and run this again. The
 * layout does not move — the plate is replaced by the picture in the same box.
 *
 * The 206x206 thumbnails in `uploads/coepics/` are not usable here. A card is
 * close to the full height of the screen and they are a fifth of that.
 *
 * WHAT IS NOT WRITTEN
 * -------------------
 * What any MOU covers, when it was signed, how long it runs, or how many
 * students it reaches. None of that has been supplied, and the deck has a
 * standing rule against inventing a figure. `note` is empty on the three
 * partners with no record behind them; fill them in as the details arrive.
 */
const fs = require('fs');
const path = require('path');
const http = require('http');

const ROOT = path.resolve(__dirname, '..');
const UPLOADS = path.join(ROOT, 'backend/uploads');
const HOST = { host: '127.0.0.1', port: Number(process.env.PORT) || 4173 };
const ORG = 'technical-hub';
const KEY = 'industry-alliances';
const DRY = process.argv.includes('--dry');

/* The six agreements, in the order they were given.

   Only two things are written per card: the institute's own name, and a line
   saying what it works on. The second line is taken from the centres data for
   the four that already run a centre here (Automation Anywhere, Snowflake,
   Mile2, o9); Kyoto's IAE and AlgoBharath have no such record, so they carry
   their standing and nothing more. Nothing here says what an MOU covers, how
   long it runs or how many students it reaches — none of that has been given,
   and the deck does not invent it. Fill `note` in as the details arrive.

   `photo` is deliberately absent on all six. The user is supplying the
   photographs next; until then each card wears a plate in the partner's own
   colour. Add `photo: '<path under uploads>'` to a card and it takes over with
   no other change. */
const PANELS = [
  {
    name: 'mou-kyoto-iae',
    /* 484x362 as supplied — a card is close to twice that on screen, so this one
       is upscaled and soft. `mono` is kept for the same reason the others keep
       theirs: it is what shows if the file ever goes missing. */
    photo: 'mou/kyoto-iae.png',
    slat: 'Kyoto IAE',
    mono: 'IAE',
    kicker: 'Kyoto University · Japan',
    label: 'Institute of Advanced Energy (IAE)',
    note: '',
    alt: 'The signed agreement held between the two parties at the institute in Japan.',
    tint: '#1F3A5F',
  },
  {
    name: 'mou-automation-anywhere',
    photo: 'mou/automation-anywhere.jpg',
    slat: 'Automation Anywhere',
    kicker: 'Centre of Excellence',
    label: 'Automation Anywhere',
    note: 'Intelligent automation & RPA.',
    alt: 'The signed agreement exchanged in the NCET Principal office.',
    tint: '#FB4E0B',
  },
  {
    name: 'mou-snowflake',
    /* Cropped, not the file as supplied. The original is a 1080 square social
       card with a branded header band — both logos and a vignette burned into
       it — and the deck's rule is that the page's own typography carries the
       message. `snowflake-original.jpg` is kept beside it untouched.
         node tools/crop-image.cjs --port <p> --in .../snowflake-original.jpg               --out .../snowflake.jpg --top 360                              */
    photo: 'mou/snowflake.jpg',
    slat: 'Snowflake',
    kicker: 'Centre of Excellence',
    label: 'Snowflake',
    note: 'Data cloud & analytics.',
    alt: 'The signed agreement exchanged at Nagarjuna Education Society.',
    tint: '#29B5E8',
  },
  {
    name: 'mou-mile2',
    photo: 'mou/mile2.jpg',
    slat: 'Mile2',
    kicker: 'Academic Alliance',
    label: 'Mile2 Cybersecurity Institute',
    note: 'Cybersecurity certifications.',
    alt: 'The academic alliance document held open between the two parties.',
    tint: '#C8102E',
  },
  {
    name: 'mou-o9',
    photo: 'mou/o9-solutions.jpg',
    slat: 'o9 Solutions',
    // Straight off the document in the photograph, which is headed
    // "ACADEMIC ALLIANCE". Not inferred.
    kicker: 'Academic Alliance',
    label: 'o9 Solutions, Inc.',
    note: '',
    alt: 'The academic alliance document held open at the NCET Principal office.',
    tint: '#161821',
  },
  {
    name: 'mou-algobharath',
    // 428x297 as supplied, and upscaled on the card like Kyoto's.
    photo: 'mou/algobharath.png',
    mono: 'AB',
    slat: 'AlgoBharath',
    label: 'AlgoBharath',
    note: '',
    alt: 'The agreement handed over at a session in the seminar hall.',
    tint: '#0B7A5A',
  },
];

const BLOCK = {
  type: 'alliance-accordion',
  /* 15 rows, the figure every other full-bleed wall uses. A span includes its
     gaps — 15x28 + 14x16 = 644px — which is the canvas budget once the head and
     gutters are out. At 22 it reserved 952, the slide measured 1185 nominal rows
     instead of 900, and presenting fell back to fitting with a margin down each
     side rather than filling the display. */
  layout: { x: 0, y: 0, w: 12, h: 15 },
  /* The heading lives here, above the row, rather than on a card of its own.
     On a card it was only on screen while nothing was being shown: the moment a
     presenter pointed at an agreement it was gone and the slide had no name.

     One line, and no eyebrow above it: the eyebrow said "Memoranda of
     Understanding" and the title then said it again in different words. No
     count in it either — "Six agreements" is a number that goes stale the day a
     seventh is signed, and the row already shows how many there are. */
  title: 'Memoranda of Understanding, signed and running',
  expandRatio: 0.52,
  trigger: 'hover',
  grayscale: true,
  // defaultIndex is worked out below, not fixed here — see RESTS_ON.
};

/* RESTS_ON — which card is open on arrival, and the one the row returns to when
   the pointer leaves it.

   The first agreement that actually has a photograph, rather than a fixed 0.
   Two of the six are still waiting for theirs, and opening the slide on an empty
   plate makes the section's first impression the one card with nothing on it.
   Worked out rather than hard-coded so it needs no undoing: the moment Kyoto's
   photograph lands, the row rests on Kyoto again. */
const restsOn = (panels) => Math.max(0, panels.findIndex((p) => p.assetId));

const MIME = { '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp' };

/* A dimension check does not prove a file is whole — a truncated JPEG keeps a
   header complete enough to report its size. The end marker is what proves it. */
const ENDS_WITH = { '.jpg': 'ffd9', '.jpeg': 'ffd9', '.png': '426082', '.webp': '' };

function request(method, path_, body, cookie) {
  return new Promise((resolve, reject) => {
    const payload = body ? JSON.stringify(body) : null;
    const headers = {};
    if (payload) {
      headers['content-type'] = 'application/json';
      headers['content-length'] = Buffer.byteLength(payload);
    }
    if (cookie) headers.cookie = `op_session=${cookie}`;
    const req = http.request({ ...HOST, path: path_, method, headers }, (res) => {
      let b = '';
      res.on('data', (d) => { b += d; });
      res.on('end', () => {
        if (res.statusCode >= 400) {
          return reject(new Error(`${method} ${path_} -> ${res.statusCode} ${b.slice(0, 300)}`));
        }
        let json = null;
        try { json = JSON.parse(b); } catch { /* 204s carry no body */ }
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
  const token = /op_session=([^;]+)/.exec(r.setCookie)?.[1];
  if (!token) throw new Error('login returned no session cookie');
  return token;
};

function readImage(rel) {
  const file = path.join(UPLOADS, rel);
  if (!fs.existsSync(file)) throw new Error(`missing image: ${rel}`);
  const buf = fs.readFileSync(file);
  const ext = path.extname(file).toLowerCase();
  const want = ENDS_WITH[ext];
  if (want && !buf.slice(-(want.length / 2)).toString('hex').endsWith(want)) {
    throw new Error(`${rel} is truncated — it does not end in ${want.toUpperCase()}`);
  }
  return { buf, mime: MIME[ext] || 'application/octet-stream', ext };
}

(async () => {
  const admin = await login((process.env.ADMIN_EMAIL || 'Torii@123.com'), (process.env.ADMIN_PASSWORD || 'Admin@123'));

  // ---------------------------------------------------------------- assets
  const existing = (await request('GET', '/api/assets', null, admin)).json.assets || [];
  const byName = new Map(existing.map((a) => [a.name, a]));

  const panels = [];
  for (const p of PANELS) {
    let assetId = null;
    /* A card without a `photo` is not an error — it is the state every one of
       these is in until the photographs are supplied, and it renders as a plate
       in the partner's own colour. */
    if (p.photo) {
      const { buf, mime, ext } = readImage(p.photo);
      /* Keyed on the name *with* its extension, which is what the server stores:
         it keeps the filename it was handed and only the URL gets the id
         appended. Looking it up without the extension matched nothing, so an
         early version re-uploaded the whole set on every run and left the
         previous one orphaned in the library. */
      const stored = p.name + ext;
      let asset = byName.get(stored);
      if (asset) {
        console.log(`  have  ${p.name.padEnd(26)} ${asset.id}`);
      } else if (DRY) {
        console.log(`  up    ${p.name.padEnd(26)} ${Math.round(buf.length / 1024)}kB  (dry run)`);
        asset = { id: `ast_dry_${p.name}` };
      } else {
        const dataUrl = `data:${mime};base64,${buf.toString('base64')}`;
        const r = await request('POST', '/api/assets', { files: [{ name: stored, dataUrl }] }, admin);
        asset = r.json.assets[0];
        byName.set(asset.name, asset);
        console.log(`  up    ${p.name.padEnd(26)} ${asset.id}  ${Math.round(buf.length / 1024)}kB`);
      }
      assetId = asset.id;
    } else {
      console.log(`  plate ${p.name.padEnd(26)} ${p.kind === 'intro' ? 'intro card' : 'awaiting photograph'}`);
    }

    panels.push({
      assetId,
      mono: p.mono,
      kind: p.kind || 'mou',
      slat: p.slat,
      kicker: p.kicker,
      heading: p.heading,
      body: p.body,
      label: p.label,
      note: p.note,
      alt: p.alt,
      tint: p.tint,
    });
  }

  // --------------------------------------------------------------- section
  let all = (await request('GET', `/api/orgs/${ORG}/sections`, null, admin)).json.sections;
  let section = all.find((s) => s.key === KEY)
    || all.find((s) => /industry alliance/i.test(s.title || ''));

  if (!section) {
    console.log(`\n  new   section "Industry Alliances"`);
    if (!DRY) {
      section = (await request('POST', `/api/orgs/${ORG}/sections`, {
        title: 'Industry Alliances',
        key: KEY,
        iconKey: 'partners',
        status: 'published',
      }, admin)).json.section;
    }
  } else {
    console.log(`\n  have  section ${section.id}  "${section.title}"`);
  }
  if (DRY) {
    console.log(`\n  dry run — ${panels.length} panels prepared, nothing written`);
    return;
  }

  await request('PATCH', `/api/sections/${section.id}`, {
    title: 'Industry Alliances',
    iconKey: 'partners',
    status: 'published',
    // Set rather than left undefined: every other section carries it, and the
    // presenter-side filter reads it.
    hidden: false,
    blocks: [{ ...BLOCK, defaultIndex: restsOn(panels), panels }],
  }, admin);
  console.log(`  set   ${panels.length} cards; ${panels.filter((p) => p.assetId).length} with a photograph`);

  /* Placed straight after Centers of Excellence: the centres and the agreements
     behind them are one story, and the room has just been shown the centres. */
  all = (await request('GET', `/api/orgs/${ORG}/sections`, null, admin)).json.sections;
  const top = all.filter((s) => !s.parentId).sort((a, b) => a.order - b.order);
  const mine = top.find((s) => s.id === section.id);
  const rest = top.filter((s) => s.id !== section.id);
  const afterIdx = rest.findIndex((s) => /centers? of excellence/i.test(s.title || ''));
  const at = afterIdx >= 0 ? afterIdx + 1 : rest.length;
  const ordered = [...rest.slice(0, at), mine, ...rest.slice(at)];
  const children = all.filter((s) => s.parentId).map((s) => s.id);
  await request('POST', `/api/orgs/${ORG}/sections/reorder`, {
    order: [...ordered.map((s) => s.id), ...children],
  }, admin);

  const after = (await request('GET', `/api/orgs/${ORG}/sections`, null, admin)).json.sections
    .filter((s) => !s.parentId).sort((a, b) => a.order - b.order);
  console.log('\n  deck order:');
  for (const s of after) {
    const mark = s.id === section.id ? '>' : ' ';
    console.log(`  ${mark} ${String(s.order).padStart(2)}  ${String(s.iconKey || '-').padEnd(15)}${s.title}`);
  }
})().catch((e) => { console.error('  ERROR ' + e.message); process.exitCode = 1; });
