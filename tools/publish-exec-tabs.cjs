#!/usr/bin/env node
/*
 * Executive Summary — three tabs behind one nav row.
 *
 *   1. the brand film, exactly as it already was
 *   2. Profile of NCET, printed on the translucent sheet
 *   3. Vision, Mission and Quality Policy, likewise
 *
 * The film is not re-specified here. The existing hero block is read off the
 * live section and carried across field for field, so the placement work done
 * to it — the controls to the top right, the copy to the bottom, the scrim
 * from the right, the [green:]/[gold:] runs in its heading — arrives in the
 * tab identical to how it left. If the hero is ever re-art-directed, this
 * script picks the new version up without being edited.
 *
 * Both sheets read exactly as printed on the supplied slides. `**` marks the
 * phrases those slides set in bold.
 *
 *   node tools/publish-exec-tabs.cjs
 */
const http = require('http');

const HOST = '127.0.0.1';
const PORT = Number(process.env.PORT || 4173);
const SECTION = 'sec_7ebb72b895e94ec8';

const PROFILE = {
  eyebrow: 'Accreditation & Recognition',
  title: 'Profile of NCET',
  layout: 'bullets',
  mark: 'NCET',
  markNote: 'since 2001',
  edgeTag: 'PROFILE',
  entries: [
    { body: '**Autonomous College** under VTU from 2015-16.' },
    { body: 'Renewal of the Autonomous status from 2022-23 to 2031-32 for **10 years**' },
    { body: 'Accredited by **NAAC under Cycle-II with A+ Grade**.' },
    { body: '**NBA Accreditation** for BE - CSE & BE - ECE' },
    { body: '**UGC 2(f)** and **12(B)** Recognition' },
    { body: 'ISO 9001:2015 QMS Certified' },
    { body: 'ISO 14001: 2015 EMS Certified' },
    { body: 'ISO 22000 : 2018 FSMS Certified' },
    { body: '**NIRF Innovation Ranking** (Rank 151-300 during 2022-23)' },
    { body: '**3 Star Rating** for IIC Activities by Ministry of Education during 2023-24' },
    { body: '**CSI** Institutional Membership' },
    { body: '**IEEE** Student Chapter' },
  ],
};

const VISION = {
  eyebrow: 'Quality Framework',
  title: 'Vision, Mission and Quality Policy',
  layout: 'sections',
  mark: 'NCET',
  markNote: 'since 2001',
  edgeTag: 'POLICY',
  entries: [
    {
      label: 'Vision',
      body: 'Leadership and Excellence in Education.',
    },
    {
      label: 'Mission',
      body: 'To fulfill the vision by imparting **total quality education** replete with the philosophy of blending **human values** and **academic professionalism.**',
    },
    {
      label: 'Quality Policy',
      body: 'Nagarjuna College of Engineering and Technology (NCET) shall be maintained, as an “Institution of Excellence”, in the domains of Engineering, Technology and Management studies through **continual improvement of system**, **processes and academic professionalism.**',
    },
  ],
};

function call(method, urlPath, body, cookie) {
  return new Promise((resolve, reject) => {
    const payload = body === undefined ? null : Buffer.from(JSON.stringify(body));
    const headers = {};
    if (payload) {
      headers['content-type'] = 'application/json';
      headers['content-length'] = payload.length;
    }
    if (cookie) headers.cookie = cookie;
    const req = http.request({ host: HOST, port: PORT, path: urlPath, method, headers }, (res) => {
      let raw = '';
      res.on('data', (c) => { raw += c; });
      res.on('end', () => {
        if (res.statusCode >= 400) return reject(new Error(`${method} ${urlPath} → ${res.statusCode} ${raw}`));
        let parsed = null;
        try { parsed = raw ? JSON.parse(raw) : null; } catch { /* not json */ }
        resolve({ body: parsed, setCookie: [].concat(res.headers['set-cookie'] || []) });
      });
    });
    req.on('error', reject);
    if (payload) req.write(payload);
    req.end();
  });
}

(async () => {
  const login = await call('POST', '/api/auth/login', { email: 'admin@org.local', password: 'Admin@123' });
  const jar = login.setCookie.map((c) => c.split(';')[0]).join('; ');
  if (!/op_session=/.test(jar)) throw new Error('no session cookie');

  const got = await call('GET', `/api/sections/${SECTION}`, undefined, jar);
  const section = got.body.section || got.body;

  // The film, lifted whole off whatever is live right now.
  const live = (section.blocks || []).find((b) => b.type === 'hero')
    || (section.blocks || []).find((b) => b.type === 'paper-tabs')?.tabs?.find((t) => t.kind === 'hero')?.hero;
  if (!live) throw new Error('no hero block to carry across — refusing to invent one');

  const hero = {
    kicker: live.kicker,
    heading: live.heading,
    subheading: live.subheading,
    media: live.media,
    source: live.source,
    assetId: live.assetId,
    videoUrl: live.videoUrl,
    alt: live.alt,
    overlay: live.overlay,
    align: live.align,
    height: live.height,
    buttons: live.buttons || [],
  };
  console.log('carrying the film across:');
  console.log('  assetId', hero.assetId, '| overlay', hero.overlay, '| align', hero.align, '| height', hero.height);
  console.log('  heading', JSON.stringify(hero.heading));

  const block = {
    type: 'paper-tabs',
    layout: { x: 0, y: 0, w: 12, h: 22 },
    wordmark: 'NCET',
    tabs: [
      { label: 'Brand Film', kind: 'hero', hero },
      { label: 'Profile of NCET', kind: 'sheet', sheet: PROFILE },
      { label: 'Vision & Mission', kind: 'sheet', sheet: VISION },
    ],
  };

  await call('PATCH', `/api/sections/${SECTION}`, { blocks: [block] }, jar);

  const back = await call('GET', `/api/sections/${SECTION}`, undefined, jar);
  const saved = (back.body.section || back.body);
  const out = (saved.blocks || []).find((b) => b.type === 'paper-tabs');
  if (!out) throw new Error('block did not survive the schema — is the server running the edited section.service.js?');
  console.log(`\n${saved.title} — ${out.tabs.length} tabs, wordmark "${out.wordmark}"`);
  out.tabs.forEach((t, i) => {
    if (t.kind === 'hero') {
      console.log(`  ${i + 1}. ${t.label} [hero] asset=${t.hero.asset?.url || 'MISSING'} overlay=${t.hero.overlay} align=${t.hero.align}`);
    } else {
      console.log(`  ${i + 1}. ${t.label} [sheet] "${t.sheet.title}" layout=${t.sheet.layout} entries=${t.sheet.entries.length} mark=${t.sheet.mark}`);
    }
  });
})().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
