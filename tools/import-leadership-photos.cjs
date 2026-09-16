// Uploads whatever is in incoming/Leadership/Leadership Journey/ and points the
// five phases at it, in filename order. Run this the moment the files land.
const fs = require('fs');
const path = require('path');
const http = require('http');

// Defaults to the drop folder, but takes any folder as an argument so the files
// can be imported from wherever they were saved:
//   node tools/import-leadership-photos.js "C:\\Users\\me\\Desktop\\photos"
const DROP = process.argv[2]
  || 'c:/Users/HARSHAVARDHINI/Downloads/Company Profile/incoming/Leadership/Leadership Journey';
const SECTIONS = ['sec_d2646548cb65432d', 'sec_2939db9227084dae'];
const MIME = { '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp' };

function request(method, p, body, cookie) {
  return new Promise((resolve, reject) => {
    const payload = body ? JSON.stringify(body) : null;
    const headers = {};
    if (payload) { headers['content-type'] = 'application/json'; headers['content-length'] = Buffer.byteLength(payload); }
    if (cookie) headers.cookie = `op_session=${cookie}`;
    const req = http.request({ host: '127.0.0.1', port: 4173, path: p, method, headers }, (res) => {
      let b = '';
      res.on('data', (d) => (b += d));
      res.on('end', () => {
        if (res.statusCode >= 400) return reject(new Error(`${method} ${p} -> ${res.statusCode} ${b.slice(0, 300)}`));
        let json = null; try { json = JSON.parse(b); } catch {}
        resolve({ json, setCookie: (res.headers['set-cookie'] || []).join(';') });
      });
    });
    req.on('error', reject);
    if (payload) req.write(payload);
    req.end();
  });
}

/**
 * Which phase a file belongs to, read from its name.
 *
 * Numeric order alone means a file called "Ecosystem Builder.jpg" lands on
 * whatever slot its position happens to be. Matching the phase in the name is
 * what the names are for; a leading 01..05 still wins when present, so both
 * conventions work and neither has to be remembered.
 */
const PHASE = [
  [/technology foundation|technical foundation|\bibm\b/i, 0],
  [/global delivery|wipro/i, 1],
  [/entrepreneur|birth|2015/i, 2],
  [/ecosystem|2016.?2025/i, 3],
  [/\bai\b|innovation|2025.?present|claude|openai/i, 4],
];

function slotFor(filename, fallback) {
  const lead = /^\s*0?([1-5])\b/.exec(filename);
  if (lead) return Number(lead[1]) - 1;
  for (const [re, index] of PHASE) if (re.test(filename)) return index;
  return fallback;
}

(async () => {
  const files = fs.existsSync(DROP)
    ? fs.readdirSync(DROP).filter((f) => MIME[path.extname(f).toLowerCase()]).sort()
    : [];
  if (!files.length) {
    console.log(`Nothing to do — no images in:\n  ${DROP}`);
    process.exit(0);
  }
  console.log(`found ${files.length} image(s):`);
  files.forEach((f, i) => console.log(`  ${i + 1}. ${f}`));
  if (files.length !== 5) console.log(`\n  note: expected 5, got ${files.length} — mapping the first five in order.`);

  const login = await request('POST', '/api/auth/login', { email: 'admin@org.local', password: 'Admin@123' });
  const token = /op_session=([^;]+)/.exec(login.setCookie)?.[1];

  const PHASE_NAMES = ['Technology Foundation', 'Global Delivery Leadership',
    'Entrepreneurial Vision', 'Ecosystem Builder', 'AI & Innovation Leadership'];

  const ids = new Array(5).fill(null);
  for (let i = 0; i < files.length && i < 5; i++) {
    const f = files[i];
    const slot = slotFor(f, i);
    const mime = MIME[path.extname(f).toLowerCase()];
    const dataUrl = `data:${mime};base64,` + fs.readFileSync(path.join(DROP, f)).toString('base64');
    const up = await request('POST', '/api/assets', { files: [{ name: f, dataUrl }] }, token);
    const asset = (up.json.assets || up.json.created || [up.json.asset]).filter(Boolean)[0];
    if (ids[slot]) console.log(`  ! two files claim "${PHASE_NAMES[slot]}" — "${f}" wins`);
    ids[slot] = asset.id;
    console.log(`  uploaded ${f}\n      -> ${PHASE_NAMES[slot]}  ${asset.url}`);
  }

  for (const id of SECTIONS) {
    const cur = await request('GET', `/api/sections/${id}`, null, token);
    const section = cur.json.section || cur.json;
    const block = section.blocks[0];
    if (block.type !== 'leadership-panels') { console.log(`  skip ${id}: block is ${block.type}`); continue; }
    const panels = block.panels.map((p, i) => {
      const { asset, ...rest } = p;
      return { ...rest, assetId: ids[i] ?? rest.assetId };
    });
    const { ...next } = block;
    delete next.panels;
    const saved = await request('PATCH', `/api/sections/${id}`,
      { blocks: [{ ...next, panels }], status: 'published' }, token);
    const b = (saved.json.section || saved.json).blocks[0];
    console.log(`\n${id}:`);
    b.panels.forEach((p, i) => console.log(`   ${i + 1}. ${p.title.padEnd(28)} ${p.asset?.url || 'NO PHOTO'}`));
  }

  // Every photo must actually serve, or the deployed deck shows blanks.
  console.log('\nchecking the new URLs serve…');
  for (const id of ids) {
    const a = (await request('GET', `/api/assets`, null, token)).json.assets.find((x) => x.id === id);
    await new Promise((res) => http.get({ host: '127.0.0.1', port: 4173, path: encodeURI(a.url) }, (r) => {
      console.log(`  ${r.statusCode} ${r.headers['content-type']}  ${a.url}`); r.resume(); r.on('end', res);
    }));
  }
})().catch((e) => { console.error('FAILED:', e.message); process.exit(1); });
