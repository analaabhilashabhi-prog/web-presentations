/**
 * Publishes Torii's NT Square as the card fan, with the GitHub deck behind it.
 *
 *   node tools/publish-nt-square.cjs [--org torii] [--dry]
 *
 * Needs the app server on 4173. No Chrome: everything in the folder is JPEG at
 * 2048 wide or under, so the files are copied as they are.
 *
 * THE LAYOUT
 * ----------
 * Built to a reference image the user supplied: eyebrow, a two-line headline,
 * two pills, and under them a hand of rounded cards arching up out of the
 * bottom edge, each cut off by the floor so only its top half shows. The
 * headline arrives on the deck's own letter reveal, the cards rise from below
 * in a stagger that runs outward from the middle, hovering one lifts it clear
 * of its neighbours, and pressing one opens it in the shared viewer.
 *
 * THE DECK
 * --------
 * The folder has one subfolder — GitHub Experience Center — and its photographs
 * go behind a third pill rather than into the hand: pressed, a panel comes up
 * over the fan and those cards are dealt from one pile into a hand of their
 * own, every one in view, any one a press away from the viewer.
 *
 * THE ORDER
 * ---------
 * The hand is read from its middle outward, so the middle card is the one the
 * section is about — the pavilion itself, with the Torii team and the students
 * in front of it — and the rest stand either side of it in the order they were
 * taken (the filenames are timestamps). Which photograph belongs in the middle
 * is a judgement, not a filename, so it is named here. No caption is written on
 * any card: nothing in the folder names a day or a session, and a caption
 * guessed off a picture is worse than none.
 */
const fs = require('fs');
const path = require('path');
const http = require('http');

const ROOT = path.resolve(__dirname, '..');
const SRC = 'C:/Users/HP/Downloads/TORII/Torii/Torii/NT SQUARE';
const DECK_DIR = 'GitHub Experience Center';
const MIDDLE = '1768541719372.jpg';   // the pavilion, the team and the students in front of it
const BASE = 'NTSquare';
const DEST = path.join(ROOT, 'backend/uploads', BASE);
const DB = path.join(ROOT, 'backend/data/db.json');
const BACKUPS = path.join(ROOT, 'backend/data/backups');
const HOST = { host: '127.0.0.1', port: Number(process.env.PORT) || 4173 };

const arg = (n, d = null) => {
  const i = process.argv.indexOf(`--${n}`);
  return i > -1 && process.argv[i + 1] && !process.argv[i + 1].startsWith('--') ? process.argv[i + 1] : d;
};
const ORG = arg('org', 'torii');
const KEY = 'nt-square';
const DRY = process.argv.includes('--dry');

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

/** Copies a folder's JPEGs into uploads under a prefix, in the given order. */
function copySet(dir, files, prefix) {
  const out = [];
  let bytes = 0;
  for (const file of files) {
    const img = readJpeg(path.join(dir, file));
    if (img.skip) { console.log(`     skipped ${file}  (${img.skip})`); continue; }
    const name = `${prefix}${String(out.length + 1).padStart(2, '0')}.jpg`;
    if (!DRY) fs.writeFileSync(path.join(DEST, name), img.buf);
    out.push({ src: name, name: '', w: img.size.w, h: img.size.h });
    bytes += img.buf.length;
  }
  return { out, bytes };
}

(async () => {
  if (!fs.existsSync(SRC)) throw new Error(`source folder not found: ${SRC}`);
  const top = fs.readdirSync(SRC).filter((f) => /\.jpe?g$/i.test(f)).sort();
  if (!top.includes(MIDDLE)) console.log(`  !! the named middle card ${MIDDLE} is not in the folder; the hand's middle falls where it falls`);
  /* The named card to the middle, the rest in order around it. */
  const rest = top.filter((f) => f !== MIDDLE);
  const mid = Math.floor(top.length / 2);
  const ordered = top.includes(MIDDLE) ? [...rest.slice(0, mid), MIDDLE, ...rest.slice(mid)] : top;
  if (!DRY) fs.mkdirSync(DEST, { recursive: true });

  const hand = copySet(SRC, ordered, '');
  console.log(`  hand: ${hand.out.length} cards  ${Math.round(hand.bytes / 1024)}kB, copied as they are  middle = #${mid + 1}`);

  let deck = null;
  const deckDir = path.join(SRC, DECK_DIR);
  if (fs.existsSync(deckDir)) {
    const files = fs.readdirSync(deckDir).filter((f) => /\.jpe?g$/i.test(f)).sort();
    const set = copySet(deckDir, files, 'gh');
    console.log(`  deck: ${set.out.length} cards from ${DECK_DIR}/  ${Math.round(set.bytes / 1024)}kB`);
    if (set.out.length) {
      deck = {
        label: 'GitHub Experience Center',
        eyebrow: 'NT Square',
        title: 'GitHub Experience Center',
        photos: set.out,
      };
    }
  }
  /* Anything from an earlier run that this one did not write is cleared, so
     the folder holds exactly what the block points at. */
  if (!DRY) {
    const keep = new Set([...hand.out, ...(deck ? deck.photos : [])].map((p) => p.src));
    fs.readdirSync(DEST).filter((f) => !keep.has(f)).forEach((f) => fs.unlinkSync(path.join(DEST, f)));
  }

  const block = {
    type: 'card-fan',
    layout: { x: 0, y: 0, w: 12, h: 15 },
    base: BASE,
    eyebrow: 'NT Square',
    /* Two lines, as the reference sets. Both are things the deck can already
       stand behind: the pavilion is on the college's own campus, and the second
       line is Torii's tagline, which is in the lockup on every one of these
       cards. Neither is a description of NT Square — there is not one anywhere
       yet. Replace both the moment the real copy arrives. */
    title: 'Torii, on campus.\nStep IN. Stand OUT.',
    /* The orbs behind the cards, in the orange measured off the mark on the
       brand film's closing card — the same value the Executive Summary hero
       uses. The stylesheet takes them down to about a tenth of its strength. */
    glow: '#F05D29',
    buttons: [
      { label: 'See inside', kind: 'solid', target: mid },
    ],
    cards: hand.out,
    deck,
  };

  const db = JSON.parse(fs.readFileSync(DB, 'utf8'));
  const section = db.sections.find((s) => s.orgId === ORG && s.key === KEY);
  if (!section) throw new Error(`no "${KEY}" section in "${ORG}"`);
  const was = (section.blocks || [])[0];
  console.log(`\n  ${ORG} / ${section.title}: ${was ? `${was.type} (${(was.cards || []).length} cards)` : 'blank'} -> card-fan (${hand.out.length} cards${deck ? ` + a deck of ${deck.photos.length}` : ''})`);
  if (DRY) { console.log('  dry run — nothing copied, nothing written'); return; }

  fs.mkdirSync(BACKUPS, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const saved = path.join(BACKUPS, `db-before-ntsquare-${ORG}-${stamp}.json`);
  fs.copyFileSync(DB, saved);
  JSON.parse(fs.readFileSync(saved, 'utf8'));
  console.log(`  backup  backend/data/backups/${path.basename(saved)}`);

  const admin = (await request('POST', '/api/auth/login', { email: (process.env.ADMIN_EMAIL || 'Torii@123.com'), password: (process.env.ADMIN_PASSWORD || 'Admin@123') }))
    .setCookie.match(/op_session=([^;]+)/)[1];
  await request('PATCH', `/api/sections/${section.id}`, { blocks: [block] }, admin);

  const stored = (await request('GET', `/api/sections/${section.id}`, null, admin)).json.section.blocks[0];
  console.log(`\n  stored: ${stored.type}  base=${stored.base}  ${stored.cards.length} card(s)  deck: ${stored.deck ? stored.deck.photos.length + ' — ' + stored.deck.label : 'none'}  `
    + `button(s): ${stored.buttons.map((b) => b.label).join(', ')}`);
  const gone = [...stored.cards, ...(stored.deck ? stored.deck.photos : [])].filter((c) => !fs.existsSync(path.join(DEST, c.src)));
  console.log(gone.length ? `  !! ${gone.length} card(s) have no file` : '  every card resolves to a file on disk');
})().catch((e) => { console.error('  ERROR ' + e.message); process.exitCode = 1; });
