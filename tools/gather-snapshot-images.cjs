/**
 * Gathers the Organization Snapshot artwork into backend/uploads/snapshot/.
 *
 *   node tools/gather-snapshot-images.cjs --dry
 *   node tools/gather-snapshot-images.cjs
 *
 * The uploader drops everything into the root of backend/uploads/ under a hashed
 * name, so the 79 pictures behind this section were mixed in with every other
 * upload. This moves them into a folder of their own and renames them to the names
 * they were uploaded with.
 *
 * They are *moved*, not copied, and the asset record's `url` is rewritten to match.
 * A copy would leave two files that drift apart, and because blocks reference assets
 * by id rather than by path, rewriting the one url per asset fixes every reference —
 * including the pictures this section shares with others, like the certification post
 * that is also the Certifications backdrop.
 *
 * The server must be stopped: it holds db.json in memory and writes it back, so an
 * edit made underneath a running process is lost the next time it saves.
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const DB = path.join(ROOT, 'backend/data/db.json');
const UPLOADS = path.join(ROOT, 'backend/uploads');
const OUT_NAME = 'snapshot';
const OUT = path.join(UPLOADS, OUT_NAME);
const SECTION_KEY = 'organization-snapshot';
const DRY = process.argv.includes('--dry');

/* Refuse to run against a live server rather than have the edit silently undone. */
function serverUp() {
  const http = require('http');
  return new Promise((resolve) => {
    const req = http.get({ host: '127.0.0.1', port: 4173, path: '/', timeout: 1200 },
      (res) => { res.resume(); resolve(true); });
    req.on('error', () => resolve(false));
    req.on('timeout', () => { req.destroy(); resolve(false); });
  });
}

const slug = (name) => {
  const ext = path.extname(name).toLowerCase();
  const base = path.basename(name, path.extname(name))
    .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'image';
  return { base, ext };
};

(async () => {
  if (await serverUp()) {
    console.error('  The server is running. Stop it first — it keeps db.json in memory and');
    console.error('  writes it back, so this edit would be thrown away.');
    process.exitCode = 1;
    return;
  }

  const db = JSON.parse(fs.readFileSync(DB, 'utf8'));
  const section = db.sections.find((s) => s.key === SECTION_KEY);
  if (!section) throw new Error(`no section keyed ${SECTION_KEY}`);

  const ids = [...new Set(JSON.stringify(section.blocks).match(/ast_[0-9a-f]+/g) || [])];
  console.log(`  ${ids.length} assets referenced by ${section.title}${DRY ? '   (dry run)' : ''}\n`);

  if (!DRY) fs.mkdirSync(OUT, { recursive: true });

  const taken = new Set();
  let moved = 0;
  let already = 0;
  const missing = [];

  for (const id of ids) {
    const asset = db.assets.find((a) => a.id === id);
    if (!asset) { missing.push(`${id} (no asset record)`); continue; }

    if (asset.url.startsWith(`/uploads/${OUT_NAME}/`)) { already += 1; continue; }

    const from = path.join(UPLOADS, asset.url.replace(/^\/uploads\//, ''));
    if (!fs.existsSync(from)) { missing.push(`${asset.name} (file not on disk: ${asset.url})`); continue; }

    /* The uploaded name, not the hashed one — but keep the id short-suffix when two
       pictures were uploaded under the same name, or the second would overwrite the
       first and one panel of the wall would silently show the wrong photograph. */
    const { base, ext } = slug(asset.name);
    let file = `${base}${ext}`;
    if (taken.has(file.toLowerCase())) file = `${base}-${id.slice(-6)}${ext}`;
    taken.add(file.toLowerCase());

    const to = path.join(OUT, file);
    console.log(`  ${asset.name.slice(0, 42).padEnd(44)} -> ${OUT_NAME}/${file}`);
    if (!DRY) {
      fs.renameSync(from, to);
      asset.url = `/uploads/${OUT_NAME}/${file}`;
    }
    moved += 1;
  }

  if (!DRY) {
    fs.writeFileSync(DB, JSON.stringify(db, null, 2));
    console.log('\n  db.json rewritten with the new urls');
  }
  console.log(`\n  moved ${moved}   already there ${already}   problems ${missing.length}`);
  for (const m of missing) console.log(`    ${m}`);
  if (!DRY) {
    const onDisk = fs.readdirSync(OUT).length;
    console.log(`  backend/uploads/${OUT_NAME}/ now holds ${onDisk} files`);
  }
})().catch((e) => { console.error('  ERROR ' + e.message); process.exitCode = 1; });
