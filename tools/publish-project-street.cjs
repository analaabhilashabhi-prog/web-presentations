/**
 * Publishes Torii's Project Street as the film and the thread board.
 *
 *   node tools/publish-project-street.cjs [--org torii] [--dry]
 *
 * Needs the app server on 4173. No Chrome: everything in the folder is already
 * JPEG at 1920 wide or under, and the film is MP4 — all of it is copied as it
 * is into `uploads/ProjectStreet/`.
 *
 * THE SLIDE
 * ---------
 * Two screens. The film first, full-bleed and muted, with the section's name
 * over it; then, one screen down, the board — built to a reference the user
 * supplied: graph paper, white cards leaning a few degrees each way, a dashed
 * thread running pin to pin. The reference reads down a page and carries copy
 * on its cards; this reads across the slide and carries a photograph on each.
 *
 * THE ORDER
 * ---------
 * `Main project .jpg` first — it is the one with the event's own title set
 * into it, and it makes the cover. The rest follow in filename order, which
 * for these is the order they were taken: the names are millisecond
 * timestamps. No caption is written on any card: nothing in the folder names
 * a team or a project, and a caption guessed off a chart-paper title is worse
 * than none.
 *
 * THE COPY
 * --------
 * Written from the photographs and from nothing else: student teams presenting
 * mini-projects on chart paper set on easels along a campus walkway — a
 * student enrolment dashboard, a course-demand forecast, a complaint-tracking
 * system, a food-ordering app — with Torii mentors in red reviewing them and a
 * crowd gathering round each board. No count is stated and nothing is claimed
 * about outcomes. Replace it the moment the user's own words arrive.
 */
const fs = require('fs');
const path = require('path');
const http = require('http');

const ROOT = path.resolve(__dirname, '..');
const SRC = 'C:/Users/HP/Downloads/TORII/Torii/Torii/Events/Project Street';
const BASE = 'ProjectStreet';
const DEST = path.join(ROOT, 'backend/uploads', BASE);
const DB = path.join(ROOT, 'backend/data/db.json');
const BACKUPS = path.join(ROOT, 'backend/data/backups');
const HOST = { host: '127.0.0.1', port: Number(process.env.PORT) || 4173 };

const arg = (n, d = null) => {
  const i = process.argv.indexOf(`--${n}`);
  return i > -1 && process.argv[i + 1] && !process.argv[i + 1].startsWith('--') ? process.argv[i + 1] : d;
};
const ORG = arg('org', 'torii');
const KEY = 'project-street';
const DRY = process.argv.includes('--dry');
const COVER = 'Main project .jpg';

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
function readJpeg(abs) {
  const buf = fs.readFileSync(abs);
  const size = jpegSize(buf);
  if (!size) return { skip: 'unreadable' };
  if (!buf.slice(-8).toString('hex').endsWith('ffd9')) return { skip: 'truncated' };
  return { buf, size };
}
/** Duration, frame size and whether `moov` precedes `mdat` (streams and seeks at once). */
function probeMp4(buf) {
  const out = { order: [] };
  let o = 0;
  while (o + 8 <= buf.length) {
    let size = buf.readUInt32BE(o);
    const type = buf.toString('ascii', o + 4, o + 8);
    if (size === 1) size = Number(buf.readBigUInt64BE(o + 8));
    if (size < 8) break;
    out.order.push(type);
    if (type === 'moov') {
      let q = o + 8;
      while (q + 8 <= o + size) {
        const s2 = buf.readUInt32BE(q);
        const t2 = buf.toString('ascii', q + 4, q + 8);
        if (t2 === 'mvhd') {
          const v = buf[q + 8];
          const ts = v === 1 ? buf.readUInt32BE(q + 28) : buf.readUInt32BE(q + 20);
          const du = v === 1 ? Number(buf.readBigUInt64BE(q + 32)) : buf.readUInt32BE(q + 24);
          out.seconds = du / ts;
        }
        if (t2 === 'trak') {
          let r = q + 8;
          while (r + 8 <= q + s2) {
            const s3 = buf.readUInt32BE(r);
            if (buf.toString('ascii', r + 4, r + 8) === 'tkhd') {
              const w = buf.readUInt32BE(r + s3 - 8) / 65536;
              const hh = buf.readUInt32BE(r + s3 - 4) / 65536;
              if (w && hh) out.video = `${w}x${hh}`;
            }
            r += s3 || 8;
          }
        }
        q += s2 || 8;
      }
    }
    o += size;
  }
  out.fastStart = out.order.indexOf('moov') > -1 && out.order.indexOf('moov') < out.order.indexOf('mdat');
  return out;
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

(async () => {
  if (!fs.existsSync(SRC)) throw new Error(`source folder not found: ${SRC}`);
  const onDisk = fs.readdirSync(SRC);
  const jpegs = onDisk.filter((f) => /\.jpe?g$/i.test(f) && f !== COVER).sort();
  if (onDisk.includes(COVER)) jpegs.unshift(COVER);
  const films = onDisk.filter((f) => /\.(mp4|m4v)$/i.test(f));
  const other = onDisk.filter((f) => !jpegs.includes(f) && !films.includes(f));
  if (other.length) console.log(`  !! not used: ${other.join(', ')}`);
  if (films.length > 1) console.log(`  !! ${films.length} films in the folder; using the first: ${films[0]}`);
  if (!DRY) fs.mkdirSync(DEST, { recursive: true });

  // ------------------------------------------------------------- the film
  let video = '';
  if (films.length) {
    const buf = fs.readFileSync(path.join(SRC, films[0]));
    const info = probeMp4(buf);
    const mmss = info.seconds ? `${Math.floor(info.seconds / 60)}m ${Math.round(info.seconds % 60)}s` : '?';
    console.log(`  film: ${films[0]}  ${(buf.length / 1048576).toFixed(1)}MB  ${mmss}  ${info.video || '?'}  ${info.fastStart ? 'fast-start' : '!! moov after mdat — will not stream until downloaded'}`);
    video = 'film.mp4';
    if (!DRY) fs.writeFileSync(path.join(DEST, video), buf);
  } else {
    console.log('  film: none in the folder — the slide opens on the board');
  }

  // ------------------------------------------------------------ the cards
  const photos = [];
  let bytes = 0;
  for (const file of jpegs) {
    const img = readJpeg(path.join(SRC, file));
    if (img.skip) { console.log(`     skipped ${file}  (${img.skip})`); continue; }
    const out = `${String(photos.length + 1).padStart(2, '0')}.jpg`;
    if (!DRY) fs.writeFileSync(path.join(DEST, out), img.buf);
    photos.push({ src: out, name: '', w: img.size.w, h: img.size.h });
    bytes += img.buf.length;
  }
  const shapes = photos.reduce((m, p) => { const k = (p.w / p.h).toFixed(2); m[k] = (m[k] || 0) + 1; return m; }, {});
  console.log(`  cards: ${photos.length} photographs  ${Math.round(bytes / 1024)}kB, copied as they are  shapes ${JSON.stringify(shapes)}`);

  const block = {
    type: 'thread-board',
    layout: { x: 0, y: 0, w: 12, h: 15 },
    base: BASE,
    video,
    videoEyebrow: 'Torii Minds',
    videoTitle: 'Project Street',
    videoCta: 'Walk the street',
    eyebrow: 'Torii Minds',
    title: 'Every project,\nout in the open.',
    lead: 'Teams set their work up on easels along the campus walkway — dashboards, apps, systems drawn out on chart paper — and explain it to whoever stops: Torii mentors, faculty, and the crowd that gathers at every board.',
    /* The tagline set into the Torii lockup on every one of these photographs. */
    note: 'Step IN. Stand OUT.',
    photos,
  };

  const db = JSON.parse(fs.readFileSync(DB, 'utf8'));
  const section = db.sections.find((s) => s.orgId === ORG && s.key === KEY);
  if (!section) throw new Error(`no "${KEY}" section in "${ORG}"`);
  const was = (section.blocks || [])[0];
  console.log(`\n  ${ORG} / ${section.title}: ${was ? was.type : 'blank'} -> thread-board`);
  if (DRY) { console.log('  dry run — nothing copied, nothing written'); return; }

  fs.mkdirSync(BACKUPS, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const saved = path.join(BACKUPS, `db-before-projectstreet-${ORG}-${stamp}.json`);
  fs.copyFileSync(DB, saved);
  JSON.parse(fs.readFileSync(saved, 'utf8'));
  console.log(`  backup  backend/data/backups/${path.basename(saved)}`);

  const admin = (await request('POST', '/api/auth/login', { email: (process.env.ADMIN_EMAIL || 'Torii@123.com'), password: (process.env.ADMIN_PASSWORD || 'Admin@123') }))
    .setCookie.match(/op_session=([^;]+)/)[1];
  await request('PATCH', `/api/sections/${section.id}`, { blocks: [block] }, admin);

  const stored = (await request('GET', `/api/sections/${section.id}`, null, admin)).json.section.blocks[0];
  console.log(`\n  stored: ${stored.type}  base=${stored.base}  film=${stored.video || 'none'}  ${stored.photos.length} card(s)`);
  const gone = [...stored.photos.map((p) => p.src), stored.video].filter(Boolean).filter((f) => !fs.existsSync(path.join(DEST, f)));
  console.log(gone.length ? `  !! ${gone.length} file(s) missing: ${gone.join(', ')}` : '  every file resolves on disk');
})().catch((e) => { console.error('  ERROR ' + e.message); process.exitCode = 1; });
