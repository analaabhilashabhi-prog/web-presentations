/* Pulls the 42 badge images down to backend/uploads/certifications/badges.
 *
 * They have to be local. The catalogue points at eight different CDNs and the
 * deck is presented with no network at all, so a page that loads badges from
 * credly.com is a page that shows forty-two broken images in the room it matters
 * in. Downloaded once, served by the app from then on. */
const fs = require('fs');
const path = require('path');
const https = require('https');
const http = require('http');
const CERTS = require('./data/certifications.json');

const OUT = path.join(__dirname, '..', 'backend/uploads/certifications/badges');
fs.mkdirSync(OUT, { recursive: true });

/** A stable, filesystem-safe name derived from the credential, not the URL. */
function slug(name) {
  return name.toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 70);
}

const EXT = { 'image/png': '.png', 'image/jpeg': '.jpg', 'image/webp': '.webp', 'image/svg+xml': '.svg', 'image/gif': '.gif' };

function get(url, depth = 0) {
  return new Promise((resolve, reject) => {
    if (depth > 5) return reject(new Error('too many redirects'));
    let u;
    try { u = new URL(url); } catch { return reject(new Error('bad url')); }
    const lib = u.protocol === 'http:' ? http : https;
    const req = lib.get(u, {
      /* A plain request gets a 403 from several of these hosts; they want a
         browser-shaped user agent and a referer. */
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
      if (res.statusCode !== 200) {
        res.resume();
        return reject(new Error(`HTTP ${res.statusCode}`));
      }
      const chunks = [];
      res.on('data', (c) => chunks.push(c));
      res.on('end', () => resolve({ body: Buffer.concat(chunks), type: String(res.headers['content-type'] || '').split(';')[0] }));
    });
    req.on('timeout', () => { req.destroy(new Error('timeout')); });
    req.on('error', reject);
  });
}

/* A real image, not an error page dressed as one. PNG/JPEG/GIF/WEBP/SVG all have
   recognisable openings, and an HTML body that arrived with an image mime type is
   exactly the failure this catches. */
function sniff(buf) {
  if (buf.length < 16) return null;
  if (buf[0] === 0x89 && buf.toString('ascii', 1, 4) === 'PNG') return '.png';
  if (buf[0] === 0xff && buf[1] === 0xd8) return '.jpg';
  if (buf.toString('ascii', 0, 3) === 'GIF') return '.gif';
  if (buf.toString('ascii', 0, 4) === 'RIFF' && buf.toString('ascii', 8, 12) === 'WEBP') return '.webp';
  const head = buf.toString('utf8', 0, 400).trim().toLowerCase();
  if (head.startsWith('<?xml') || head.startsWith('<svg')) return '.svg';
  return null;
}

(async () => {
  const map = {};
  const failed = [];
  for (const cert of CERTS) {
    const name = slug(cert.name);
    try {
      const { body, type } = await get(cert.sourceImg);
      const ext = sniff(body) || EXT[type] || '';
      if (!ext) throw new Error(`not an image (${type}, ${body.length}b)`);
      const file = name + ext;
      fs.writeFileSync(path.join(OUT, file), body);
      map[cert.name] = `certifications/badges/${file}`;
      console.log(`  ok    ${String(Math.round(body.length / 1024)).padStart(4)}kB  ${ext.padEnd(5)} ${cert.name.slice(0, 58)}`);
    } catch (e) {
      failed.push({ name: cert.name, url: cert.sourceImg, why: e.message });
      console.log(`  FAIL            ${cert.name.slice(0, 58)}  — ${e.message}`);
    }
  }
  fs.writeFileSync(path.join(__dirname, 'data', 'badge-map.json'), JSON.stringify(map, null, 1));
  console.log(`\n  ${Object.keys(map).length} of ${CERTS.length} badges local`);
  if (failed.length) {
    console.log('  still remote:');
    failed.forEach((f) => console.log(`    ${f.name}  (${f.why})`));
  }
})();
