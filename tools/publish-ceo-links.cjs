/**
 * The five links on the CEO Profile.
 *
 *   node tools/publish-ceo-links.cjs
 *
 * Each carries a short note, because the panel that opens in place shows the
 * destination described rather than the destination itself: all five of these sites
 * refuse to be framed (Instagram and Facebook send X-Frame-Options: DENY, YouTube
 * SAMEORIGIN, LinkedIn answers a bot with 999 and blocks framing regardless, and
 * academy.oracle.com 403s), and the deck presents with no network at all. The note is
 * what a presenter can actually talk to in a room with no internet.
 */
const http = require('http');

const HOST = { host: '127.0.0.1', port: Number(process.env.PORT) || 4173 };
const ORG = 'technical-hub';
const SECTION_KEY = 'ceo-profile';

const LINKS = [
  {
    label: 'LinkedIn',
    href: 'https://www.linkedin.com/in/babjineelam/',
    icon: 'linkedin',
    logo: 'CEO Profile Logos/LinkedIN.png',
    note: 'Babji Neelam’s professional profile — the founder and CEO of Technical Hub.',
  },
  {
    label: 'Oracle Success Story',
    href: 'https://academy.oracle.com/en/about-success-spotlight-babji-neelam.html',
    icon: 'oracle-word',
    logo: 'CEO Profile Logos/oracle.png',
    wide: true,
    note: 'Oracle Academy’s Success Spotlight, featuring Babji Neelam and the work at '
      + 'Technical Hub.',
  },
  {
    label: 'YouTube',
    href: 'https://www.youtube.com/@technicalhubio',
    icon: 'youtube',
    logo: 'CEO Profile Logos/Youtube.png',
    note: 'The Technical Hub channel — programme films, events and student stories.',
  },
  {
    label: 'Facebook',
    href: 'https://www.facebook.com/babji.neelam/',
    icon: 'facebook',
    logo: 'CEO Profile Logos/facebook.png',
    note: 'Babji Neelam on Facebook.',
  },
  {
    label: 'Instagram',
    href: 'https://www.instagram.com/babjineelam/',
    icon: 'instagram',
    logo: 'CEO Profile Logos/instagram.png',
    note: 'Babji Neelam on Instagram.',
  },
];

function request(method, path, body, cookie) {
  return new Promise((resolve, reject) => {
    const payload = body ? JSON.stringify(body) : null;
    const headers = {};
    if (payload) {
      headers['content-type'] = 'application/json';
      headers['content-length'] = Buffer.byteLength(payload);
    }
    if (cookie) headers.cookie = `op_session=${cookie}`;
    const req = http.request({ ...HOST, path, method, headers }, (res) => {
      let b = '';
      res.on('data', (d) => { b += d; });
      res.on('end', () => {
        if (res.statusCode >= 400) {
          return reject(new Error(`${method} ${path} -> ${res.statusCode} ${b.slice(0, 240)}`));
        }
        let json = null;
        try { json = JSON.parse(b); } catch { /* no body */ }
        resolve({ json, setCookie: (res.headers['set-cookie'] || []).join(';') });
      });
    });
    req.on('error', reject);
    if (payload) req.write(payload);
    req.end();
  });
}

(async () => {
  const login = await request('POST', '/api/auth/login', { email: 'admin@org.local', password: 'Admin@123' });
  const token = /op_session=([^;]+)/.exec(login.setCookie)?.[1];
  if (!token) throw new Error('login returned no session cookie');

  const all = (await request('GET', `/api/orgs/${ORG}/sections`, null, token)).json.sections;
  const section = all.find((s) => s.key === SECTION_KEY);
  if (!section) throw new Error(`no section keyed ${SECTION_KEY}`);

  const blocks = section.blocks.map((b) => (b.type === 'leader-hero' ? { ...b, links: LINKS } : b));
  if (!blocks.some((b) => b.type === 'leader-hero')) throw new Error('no leader-hero block to attach links to');

  await request('PATCH', `/api/sections/${section.id}`, { blocks }, token);

  const after = (await request('GET', `/api/orgs/${ORG}/sections`, null, token))
    .json.sections.find((s) => s.key === SECTION_KEY);
  const saved = after.blocks.find((b) => b.type === 'leader-hero').links || [];
  console.log(`  ${saved.length} links on ${after.title}:`);
  for (const l of saved) {
    console.log(`    ${String(l.label).padEnd(22)} ${String(l.logo || '(library glyph)').padEnd(38)} ${l.href}`);
    if (!l.note) console.log('      (note did not survive the block normaliser)');
    if (!l.logo) console.log('      (no artwork - falling back to the library glyph)');
  }
})().catch((e) => { console.error('  ERROR ' + e.message); process.exitCode = 1; });
