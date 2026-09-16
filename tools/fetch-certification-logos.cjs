/* Downloads every logo named in Logos.xlsx into
   backend/uploads/certifications/logos, so the wall never reaches a CDN. */
const fs = require('fs');
const path = require('path');
const https = require('https');
const http = require('http');

const path2 = require('path');
const ROOT = path2.resolve(__dirname, '..');
const OUT = path.join(ROOT, 'backend/uploads/certifications/logos');
const CERTS = require('./data/logos.json');
fs.mkdirSync(OUT, { recursive: true });

const slug = (s) => String(s).toLowerCase()
  .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 72);

const MIME = {
  'image/png': '.png', 'image/jpeg': '.jpg', 'image/webp': '.webp',
  'image/svg+xml': '.svg', 'image/gif': '.gif',
};

function get(url, depth = 0) {
  return new Promise((resolve, reject) => {
    if (depth > 6) return reject(new Error('too many redirects'));
    let u;
    try { u = new URL(url); } catch { return reject(new Error('bad url')); }
    const lib = u.protocol === 'http:' ? http : https;
    const req = lib.get(u, {
      /* Several of these hosts answer 403 to a bare request; they want a
         browser-shaped agent and a referer from their own origin. */
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
          + ' (KHTML, like Gecko) Chrome/151.0 Safari/537.36',
        Accept: 'image/avif,image/webp,image/png,image/svg+xml,*/*;q=0.8',
        Referer: `${u.protocol}//${u.host}/`,
      },
      timeout: 25000,
    }, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        res.resume();
        return resolve(get(new URL(res.headers.location, u).href, depth + 1));
      }
      if (res.statusCode !== 200) { res.resume(); return reject(new Error(`HTTP ${res.statusCode}`)); }
      const chunks = [];
      res.on('data', (c) => chunks.push(c));
      res.on('end', () => resolve({
        body: Buffer.concat(chunks),
        type: String(res.headers['content-type'] || '').split(';')[0].trim(),
      }));
    });
    req.on('timeout', () => req.destroy(new Error('timeout')));
    req.on('error', reject);
  });
}

/* A real image, not an error page wearing an image mime type. */
function sniff(buf) {
  if (buf.length < 16) return null;
  if (buf[0] === 0x89 && buf.toString('ascii', 1, 4) === 'PNG') return '.png';
  if (buf[0] === 0xff && buf[1] === 0xd8) return '.jpg';
  if (buf.toString('ascii', 0, 3) === 'GIF') return '.gif';
  if (buf.toString('ascii', 0, 4) === 'RIFF' && buf.toString('ascii', 8, 12) === 'WEBP') return '.webp';
  const head = buf.toString('utf8', 0, 500).trim().toLowerCase();
  if (head.startsWith('<?xml') || head.startsWith('<svg') || head.includes('<svg')) return '.svg';
  return null;
}

(async () => {
  const map = {};
  const failed = [];
  const seen = new Set();
  for (const cert of CERTS) {
    // The workbook lists Azure Administrator Associate twice; one file is enough.
    if (seen.has(cert.name)) continue;
    seen.add(cert.name);
    const name = slug(cert.name);
    try {
      const { body, type } = await get(cert.url);
      const ext = sniff(body) || MIME[type] || '';
      if (!ext) throw new Error(`not an image (${type || 'no type'}, ${body.length}b)`);
      const file = name + ext;
      fs.writeFileSync(path.join(OUT, file), body);
      map[cert.name] = `certifications/logos/${file}`;
      console.log(`  ok   ${String(Math.round(body.length / 1024)).padStart(4)}kB ${ext.padEnd(5)} ${cert.name.slice(0, 56)}`);
    } catch (e) {
      failed.push({ name: cert.name, url: cert.url, why: e.message });
      console.log(`  FAIL           ${cert.name.slice(0, 56)}  — ${e.message}`);
    }
  }
  fs.writeFileSync(path.join(__dirname, 'logo-map.json'), JSON.stringify(map, null, 1));
  console.log(`\n  ${Object.keys(map).length} of ${seen.size} logos local`);
  if (failed.length) {
    console.log('  still remote:');
    failed.forEach((f) => console.log(`    ${f.name}\n      ${f.why}  ${f.url}`));
  }
})();
