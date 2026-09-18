/**
 * Torii's Executive Summary: the brand film, and nothing else.
 *
 *   node tools/publish-torii-summary.cjs [--dry] [--start 0]
 *
 * Needs the app server on 4173.
 *
 * WHAT CHANGES
 * ------------
 * The section held a `paper-tabs` block of three tabs — Brand Film, Profile of
 * NCET, Vision & Mission — every word of it about Nagarjuna College, because
 * Torii's deck began as a mirror of NGI's. Two of those tabs were not wanted and
 * none of that copy is Torii's. It becomes one full-bleed `hero`: the film
 * behind, the name over it.
 *
 * THE FILM PLAYS FROM THE START
 * -----------------------------
 * The second film (2026-09-15, "learning · technical · communication ·
 * leadership") is played whole, from its first frame, on the user's
 * instruction — nothing is cut. `hero.start` is therefore 0, and with no offset
 * the browser's own `loop` does the repeat. The first film (`012. torii video
 * NEW.mp4`, 4m 17s) opened on a logo sting and was started at 18s; `--start`
 * is still honoured if a film ever needs that again.
 *
 * THE UPLOAD
 * ----------
 * It goes through `/api/assets/binary` as a stream rather than `/api/assets`
 * as a base64 data URL — the first film was 298MB, which would have been about
 * 400MB of JSON for the server to parse; this one is 9MB and takes the same
 * road for the same reason. The file is already fast-start (its `moov` atom is at
 * byte 24, ahead of the media), and the static server answers byte ranges, so
 * the browser can seek to 0:13 without fetching what comes before it.
 *
 * Re-running does not re-upload: an asset is stored under the name it was
 * uploaded with, extension included, and that is what this looks it up by.
 */
const fs = require('fs');
const path = require('path');
const http = require('http');

const ROOT = path.resolve(__dirname, '..');
const SRC = 'C:/Users/HP/Downloads/TORII/learning__technical__communication__leadership__r.mp4';
const DB = path.join(ROOT, 'backend/data/db.json');
const BACKUPS = path.join(ROOT, 'backend/data/backups');
const HOST = { host: '127.0.0.1', port: Number(process.env.PORT) || 4173 };
const ORG = 'torii';
const KEY = 'company-profile';

const arg = (n, d = null) => {
  const i = process.argv.indexOf(`--${n}`);
  return i > -1 && process.argv[i + 1] && !process.argv[i + 1].startsWith('--') ? process.argv[i + 1] : d;
};
const DRY = process.argv.includes('--dry');
const START = Number(arg('start', 0));
/* Named for what it is, and distinct from the first film's asset so the two
   never collide in the library — an asset is looked up by this exact name. */
const ASSET_NAME = 'torii-brand-film-2.mp4';

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

/** Streams the file up rather than reading it into a string first. */
function uploadStream(file, name, cookie) {
  return new Promise((resolve, reject) => {
    const size = fs.statSync(file).size;
    const req = http.request({
      ...HOST,
      path: `/api/assets/binary?name=${encodeURIComponent(name)}`,
      method: 'POST',
      headers: {
        'content-type': 'video/mp4',
        'x-file-type': 'video/mp4',
        'content-length': size,
        cookie: `op_session=${cookie}`,
      },
    }, (res) => {
      let b = '';
      res.on('data', (d) => { b += d; });
      res.on('end', () => {
        if (res.statusCode >= 400) return reject(new Error(`upload -> ${res.statusCode} ${b.slice(0, 300)}`));
        resolve(JSON.parse(b).assets[0]);
      });
    });
    req.on('error', reject);
    let sent = 0;
    let lastPct = -10;
    const stream = fs.createReadStream(file);
    stream.on('data', (chunk) => {
      sent += chunk.length;
      const pct = Math.floor((sent / size) * 100);
      if (pct >= lastPct + 10) { lastPct = pct; process.stdout.write(`  uploading ${pct}%\r`); }
    });
    stream.on('error', reject);
    stream.pipe(req);
  });
}

/** Duration and fast-start check, straight off the atoms — there is no ffmpeg. */
function probeMp4(file) {
  const fd = fs.openSync(file, 'r');
  const size = fs.statSync(file).size;
  const walk = (off, end) => {
    const out = [];
    while (off < end - 8) {
      const b = Buffer.alloc(8);
      fs.readSync(fd, b, 0, 8, off);
      let len = b.readUInt32BE(0);
      const type = b.toString('ascii', 4, 8);
      if (len === 0) len = end - off;
      if (len === 1) {
        const e = Buffer.alloc(8); fs.readSync(fd, e, 0, 8, off + 8);
        len = Number(e.readBigUInt64BE(0));
      }
      if (len < 8) break;
      out.push({ type, off, len });
      off += len;
    }
    return out;
  };
  const top = walk(0, size);
  const moov = top.find((a) => a.type === 'moov');
  const mdat = top.find((a) => a.type === 'mdat');
  let seconds = null;
  if (moov) {
    const mvhd = walk(moov.off + 8, moov.off + moov.len).find((a) => a.type === 'mvhd');
    if (mvhd) {
      const b = Buffer.alloc(mvhd.len);
      fs.readSync(fd, b, 0, mvhd.len, mvhd.off);
      const v = b[8];
      const scale = v === 1 ? Number(b.readBigUInt64BE(28)) : b.readUInt32BE(20);
      const dur = v === 1 ? Number(b.readBigUInt64BE(36)) : b.readUInt32BE(24);
      if (scale) seconds = dur / scale;
    }
  }
  fs.closeSync(fd);
  return { size, seconds, fastStart: Boolean(moov && mdat && moov.off < mdat.off) };
}

(async () => {
  if (!fs.existsSync(SRC)) throw new Error(`film not found: ${SRC}`);
  const film = probeMp4(SRC);
  const mmss = film.seconds ? `${Math.floor(film.seconds / 60)}m ${(film.seconds % 60).toFixed(0)}s` : 'unknown';
  console.log(`  ${path.basename(SRC)}  ${(film.size / 1048576).toFixed(1)}MB  ${mmss}`
    + `  ${film.fastStart ? 'fast-start (streams and seeks immediately)' : '!! moov is behind the media — seeking will stall'}`);
  if (film.seconds && START >= film.seconds) throw new Error(`--start ${START} is past the end of a ${mmss} film`);
  console.log(START
    ? `  opens at ${START}s, and loops back to ${START}s rather than to zero`
    : '  plays from the first frame and loops from the first frame — nothing cut');

  const db = JSON.parse(fs.readFileSync(DB, 'utf8'));
  const section = db.sections.find((s) => s.orgId === ORG && s.key === KEY);
  if (!section) throw new Error(`no "${KEY}" section in ${ORG}`);
  const was = (section.blocks || [])[0];
  console.log(`\n  ${ORG} / ${section.title}: ${was ? was.type : 'empty'} -> hero`);
  if (was?.type === 'paper-tabs') {
    console.log(`  dropping ${was.tabs.length} tab(s): ${was.tabs.map((t) => t.label).join(', ')}`);
  }
  if (DRY) { console.log('\n  dry run — nothing uploaded, nothing written'); return; }

  const admin = (await request('POST', '/api/auth/login', { email: (process.env.ADMIN_EMAIL || 'Torii@123.com'), password: (process.env.ADMIN_PASSWORD || 'Admin@123') }))
    .setCookie.match(/op_session=([^;]+)/)[1];

  /* An asset is stored under the filename it was uploaded with, extension and
     all, so that is what it has to be looked up by — matching on the bare stem
     finds nothing and re-uploads 298MB on every run. */
  const existing = (await request('GET', '/api/assets', null, admin)).json.assets
    .find((a) => a.name === ASSET_NAME && a.kind === 'video');
  let asset = existing;
  if (asset) {
    console.log(`\n  already uploaded: ${asset.id}  ${asset.url}`);
  } else {
    console.log('');
    asset = await uploadStream(SRC, ASSET_NAME, admin);
    console.log(`  uploaded ${asset.id}  ${asset.url}  ${(film.size / 1048576).toFixed(1)}MB`);
  }

  const block = {
    type: 'hero',
    layout: { x: 0, y: 0, w: 12, h: 15 },
    media: 'video',
    source: 'upload',
    assetId: asset.id,
    start: START,
    alt: 'Torii Minds brand film',
    /* The kicker is this hero's display line — 38 to 64px against the heading's
       28 to 44 — so the name goes there and the sentence underneath it. Written
       the other way round, "BRAND FILM" was set half again as large as Torii's
       own name. */
    kicker: 'TORII MINDS',
    /* The user's own words, whole. The opening sentence is lifted to the
       heading because it is the strongest line in the paragraph and the slot is
       52px; everything after it runs on underneath, in the order it was
       written, down to the sign-off. The only editorial change is the em dash
       after "placement", which arrived as a doubled space. */
    heading: 'The gateway between classroom and career.',
    subheading: 'Named for the Japanese Torii gate, it takes engineering trainees through '
      + 'coding, aptitude, communication, AI interviews and placement — one connected platform, '
      + '[gold:100+ courses], [gold:200+ hours each], ending in global certifications from AWS, '
      + 'Google Cloud, ServiceNow and Snowflake. Partnered with Claude and OpenAI, and running a '
      + '[gold:24/7 AI-powered lab] where students build with AI, not just about it. Technical '
      + 'partner to NCET. Teams in Bangalore, Mysore and Andhra Pradesh. '
      /* A hard space before the last word: right-aligned, the sign-off broke
         after "Stand" and left "OUT." alone on a line of its own. */
      + 'Step [gold:IN], Stand [gold:OUT].',
    /* The orange of the mark, measured off the film's own closing card at three
       frames — 5,296 pixels of it on the logo and 60,517 on the gate, all
       reading #F05D29. The card is that orange on black with the wordmark in
       white, and "IN" and "OUT" picked out of the tagline in the orange, which
       is what the copy here does too. Not the #E95A22 in the palette table:
       that predates any brand file and is close but is not this. */
    accent: '#F05D29',
    /* 90, which is what NGI's Executive Summary hero uses. This slide is that
       slide's structure with Torii's film and Torii's words in it, and the
       scrim is the only thing that darkens the copy's side — no panel, no
       plate, nothing drawn on top of the picture. */
    overlay: 90,
    /* Copy on the right, where this film leaves the most room: its subject
       walks through the frame from the left. */
    align: 'right',
    /* 1, not the stylesheet's 1.325. That default hides the baked-in bars of a
       letterboxed export; this film is a true 1920x1080 and the scale was
       cropping a third of it off. */
    zoom: 1,
    height: 'full',
    buttons: [],
  };

  fs.mkdirSync(BACKUPS, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const saved = path.join(BACKUPS, `db-before-summary-${ORG}-${stamp}.json`);
  fs.copyFileSync(DB, saved);
  JSON.parse(fs.readFileSync(saved, 'utf8'));
  console.log(`  backup  backend/data/backups/${path.basename(saved)}`);

  await request('PATCH', `/api/sections/${section.id}`, { blocks: [block] }, admin);
  const stored = (await request('GET', `/api/sections/${section.id}`, null, admin)).json.section.blocks[0];
  console.log(`\n  stored: ${stored.type}  start=${stored.start}s  overlay=${stored.overlay}`
    + `  media=${stored.media}  asset=${stored.asset ? stored.asset.url : '(unresolved)'}`);
  if (stored.start !== START) console.log('  !! start did not survive the schema — is the server running the current code?');

  const onDisk = path.join(ROOT, 'backend', stored.asset?.url?.replace(/^\//, '') || '');
  console.log(fs.existsSync(onDisk) ? '  the film resolves to a file on disk' : `  !! no file at ${onDisk}`);

  for (const other of ['technical-hub', 'ncet']) {
    const s = db.sections.find((x) => x.orgId === other && x.key === KEY);
    console.log(`  ${other.padEnd(14)} unchanged: ${(s?.blocks || [])[0]?.type} `
      + `(${((s?.blocks || [])[0]?.tabs || []).length} tabs)`);
  }
})().catch((e) => { console.error('  ERROR ' + e.message); process.exitCode = 1; });
