/**
 * Torii's AI Partners row — the stack of pinned cards.
 *
 *   node tools/publish-ai-partners.cjs [--dry]
 *
 * Needs the app server, restarted after the schema change this depends on
 * (`scroll-stack` in BLOCK_TYPES and its case in `normalizeBlock`) — without
 * the restart the store holds the old normaliser, every field below is dropped
 * and the row publishes as an empty paragraph. Backs `db.json` up first.
 *
 * WHAT IT DOES
 * ------------
 *   Creates the row if it is not there, rewrites its block, and puts it
 *   immediately before AI Ready Engineer. Run it twice and nothing is
 *   duplicated: the row is found by its key and PATCHed.
 *
 * THE CARD IS THE REFERENCE'S LAYOUT (2026-09-21, on request)
 * -----------------------------------------------------------
 *   The user supplied a reference image — a cream card with a pill at one
 *   corner and a starburst at the other, a two-colour headline, a lead, a row
 *   of six numbered white cards each with a tinted icon chip, and a row of
 *   chips under them. Each partner card is now that layout:
 *
 *     the credential, top left    the partnership lockup the partner ISSUED,
 *                                 on a white plate, 68px tall. "The photos we
 *                                 have... placed in the card to be shown
 *                                 clearly" is what that slot is for. With no
 *                                 lockup in the library the card sets what the
 *                                 badge would have said in type instead.
 *     the brand mark, top right   the vendor's own symbol, in the corner the
 *                                 reference puts its starburst in. Supplied by
 *                                 the user from their Downloads and filed
 *                                 under uploads/partners/.
 *     the headline                two colours on one line, both halves stored.
 *     the points                  numbered cards, not bullets.
 *
 * WHERE THE WORDS AND THE COLOURS COME FROM, because both are rules here
 * ---------------------------------------------------------------------
 *   - **Every mark is the user's own.** claude-mark.svg, openai-mark.webp and
 *     github-mark.png are the files they supplied; the two partnership lockups
 *     and the sarvam wordmark were already in uploads/Claude/ for the AI Ready
 *     Engineer slide. Sarvam's mandala mark arrived on 2026-09-22 and is the
 *     user's file too, so all four corners now carry the vendor's own symbol.
 *     NOTHING IS HAND-DRAWN, which is this deck's standing rule about vendor
 *     logos — a partner with no artwork still gets an empty corner rather
 *     than a traced one.
 *
 *   - **The headline is what the badge says, and nothing more.** "Partner
 *     Network Member", "Select Partner", "Campus Program" are each printed on
 *     the lockup or, for GitHub, on the pavilion signage in the NT Square
 *     photographs. The reviewer asked for "how difficult it is to be
 *     partnered" and chose to have those lines written from the badges only,
 *     so the card states the STANDING and stops there. No claim about how a
 *     tier is earned or how few hold it appears anywhere on this slide,
 *     because no such thing is written down in this deck.
 *
 *   - **`tagline` is the deck's own**, copied verbatim off the Centres of
 *     Excellence block for Claude, OpenAI and GitHub. Sarvam has no entry
 *     anywhere in the deck; its line describes the vendor as the vendor
 *     publishes itself, and it is the one line on this slide to replace first.
 *
 *   - **Every point is written down somewhere else in this deck**: the ten
 *     Claude Certified Architect trainers, the Claude Certified Associate card
 *     on AI Ready Engineer, the Centres of Excellence list, that curriculum's
 *     own "3 C's — Claude · Codex · Copilot" and "GitHub & Version Control"
 *     modules, the GitHub Experience Center at NT Square. Sarvam's WERE
 *     deliberately empty for the same reason — nothing about that partnership
 *     is in the deck — until the user asked for the card to be filled
 *     (2026-09-22); its six points now describe Sarvam as Sarvam publishes
 *     itself, with no figures, and are the first thing to replace with the
 *     user's own words. The component still draws no grid when there are none.
 *
 *   - **`color` is measured, not chosen** — the hex already stored against
 *     each of the three on the Centres of Excellence block; sarvam's was
 *     measured off its wordmark, 60,684 ink pixels, mean #3F3F3F. It is on the
 *     band at the card's top and in the tint behind each icon, and NOT on any
 *     type: a vendor's brand hue is chosen to work on that vendor's ground,
 *     and GitHub's #8B7ED8 on this card's warm paper is under 3:1 at any size.
 *     Type takes the deck's own `--accent-ink`.
 */
const fs = require('fs');
const path = require('path');
const http = require('http');

const ROOT = path.resolve(__dirname, '..');
const DB = path.join(ROOT, 'backend/data/db.json');
const BACKUPS = path.join(ROOT, 'backend/data/backups');
const HOST = { host: '127.0.0.1', port: Number(process.env.PORT) || 4173 };
const DRY = process.argv.includes('--dry');
const ORG = 'torii';
const KEY = 'ai-partners';
const BEFORE = 'ai-ready-engineer';

const BLOCK = {
  type: 'scroll-stack',
  layout: { x: 0, y: 0, w: 12, h: 15 },
  /* Carried, not drawn. The block still holds these two and the slide is the
     cards alone; putting a head back is a line in the component. */
  eyebrow: 'PARTNERSHIPS',
  title: 'AI Partners',
  lead: 'The platforms Torii builds and teaches on, and the standing each one is held at.',
  partners: [
    {
      name: 'Claude',
      /* The line the lockup itself prints, used as the badge's own type
         fallback if the file ever goes missing. */
      note: 'Claude Partner Network · Member',
      /* Verbatim off the Centres of Excellence block, not rewritten. */
      tagline: 'Applied AI, agents & assistants',
      /* THE CREDENTIAL — the partnership lockup the partner issued. */
      logo: 'Claude/claude-partner-network.jpeg',
      logoAlt: 'Claude Partner Network — Member',
      /* THE BRAND MARK — the vendor's own symbol, supplied by the user. */
      mark: 'partners/claude-mark.svg',
      markAlt: 'Claude',
      headline: 'Claude.',
      headlineAccent: 'Partner Network Member.',
      color: '#D97757',
      points: [
        { icon: 'handshake-check', title: 'Partner Network', body: 'Member tier of the Claude Partner Network.' },
        { icon: 'users', title: 'Certified Architects', body: 'Ten Claude Certified Architect trainers on the team.' },
        { icon: 'certificate', title: 'Student Certification', body: 'Claude Certified Associate, earned by students.' },
        { icon: 'building', title: 'Centre of Excellence', body: 'A Centre of Excellence partner on campus.' },
        { icon: 'book', title: 'In the Curriculum', body: 'Carried through the AI Ready Engineer programme.' },
        { icon: 'code', title: "The 3 C's", body: 'Claude taught beside Codex and Copilot.' },
      ],
    },
    {
      name: 'OpenAI',
      note: 'OpenAI Select Partner',
      tagline: 'Generative AI & LLMs',
      logo: 'Claude/openai-select-partner.jpeg',
      logoAlt: 'OpenAI Select Partner',
      mark: 'partners/openai-mark.webp',
      markAlt: 'OpenAI',
      headline: 'OpenAI.',
      headlineAccent: 'Select Partner.',
      color: '#10A37F',
      points: [
        { icon: 'handshake-check', title: 'Select Partner', body: 'Select Partner — the tier printed on the lockup.' },
        { icon: 'building', title: 'Centre of Excellence', body: 'A Centre of Excellence partner on campus.' },
        { icon: 'book', title: 'In the Curriculum', body: 'Generative AI runs through the AI Ready Engineer programme.' },
        { icon: 'code', title: "The 3 C's", body: 'Codex taught beside Claude and Copilot.' },
      ],
    },
    {
      name: 'Sarvam AI',
      note: 'Partnership',
      /* The one line on this slide with no source in the deck. Replace it. */
      tagline: 'Indian-language foundation models',
      logo: 'Claude/sarvam-ai.jpeg',
      logoAlt: 'sarvam',
      /* THE MARK ARRIVED (2026-09-22): the user's own `sarvam ai logo.png`,
         the mandala symbol — 1254px, a true cut-out (75.7% clear, all four
         corners at alpha 0), pure black ink filling its canvas to within 2-4%,
         so nothing is cropped. Scaled to 420px, four times the 104px it is
         drawn at, through `crop-image.cjs` so the transparency survives; a
         JPEG here would put a white box on the cream card. That corner was
         deliberately EMPTY until now ("I don't have the sarvam AI logo for
         now, we are going to do it later") — the empty state is still what a
         partner with no artwork gets, and nothing is ever traced by hand. */
      mark: 'partners/sarvam-mark.png',
      markAlt: 'Sarvam AI',
      headline: 'Sarvam AI.',
      headlineAccent: 'Partnership.',
      color: '#3F3F3F',
      /* FILLED ON REQUEST (2026-09-22: "info in the sarvam ai also it was
         empty"). Nothing about this partnership is written anywhere in the
         deck, so these describe SARVAM as Sarvam describes itself publicly —
         Indic-language foundation models, voice AI, the IndiaAI Mission
         selection, open-weight releases, a developer platform — and the one
         line about the partnership says only what this slide already says:
         that it is one. No figure appears: no language count, no parameter
         count, no customer. Replace any of these with the user's own words
         the moment they arrive. */
      points: [
        { icon: 'globe', title: 'Indian Languages', body: 'Foundation models built for India’s languages, made in India.' },
        { icon: 'volume', title: 'Voice AI', body: 'Speech recognition and speech synthesis for Indian languages.' },
        { icon: 'flag', title: 'Sovereign AI', body: 'Selected under the IndiaAI Mission to build India’s own foundation model.' },
        { icon: 'code', title: 'Open Weights', body: 'Models published for developers to run and fine-tune themselves.' },
        { icon: 'tap-network', title: 'Developer Platform', body: 'APIs and agent tooling to build Indic-language applications on.' },
        { icon: 'handshake-check', title: 'AI Partner', body: 'An AI partner of Torii Minds, beside Claude, OpenAI and GitHub.' },
      ],
    },
    {
      name: 'GitHub',
      note: 'GitHub Campus Program',
      tagline: 'DevOps, source & collaboration',
      /* NO BADGE, DELIBERATELY EMPTY. There is no GitHub partnership lockup
         anywhere in the library — the file that used to sit here was the plain
         GitHub wordmark off the Centres of Excellence wall, which is a brand
         mark rather than a credential and now has its own field. With the slot
         empty the card sets `note` in type there, which is what the pavilion
         signage at NT Square actually says. */
      logo: '',
      logoAlt: '',
      mark: 'partners/github-mark.png',
      markAlt: 'GitHub',
      headline: 'GitHub.',
      headlineAccent: 'Campus Program.',
      color: '#8B7ED8',
      points: [
        { icon: 'handshake-check', title: 'Campus Program', body: 'GitHub Campus Program, named on the NT Square signage.' },
        { icon: 'map-pin', title: 'Experience Center', body: 'A GitHub Experience Center at NT Square.' },
        { icon: 'building', title: 'Centre of Excellence', body: 'A Centre of Excellence partner on campus.' },
        { icon: 'cube', title: 'Student Developer Pack', body: 'Student Developer Pack on campus.' },
        { icon: 'code', title: 'In the Curriculum', body: 'GitHub & Version Control, a module of its own.' },
      ],
    },
  ],
};

function request(method, p, body, cookie) {
  return new Promise((resolve, reject) => {
    const payload = body ? JSON.stringify(body) : null;
    const headers = {};
    if (payload) { headers['content-type'] = 'application/json'; headers['content-length'] = Buffer.byteLength(payload); }
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
  /* Every mark has to be on disk before the row goes up. A reference that
     resolves nowhere draws nothing at all rather than complaining, so the only
     symptom of a wrong path is a blank plate — and on Linux a wrong CASE is a
     wrong path, which this deck has been caught by once already. */
  for (const p of BLOCK.partners) {
    for (const rel of [p.logo, p.mark]) {
      if (!rel) continue;
      const abs = path.join(ROOT, 'backend/uploads', rel);
      if (!fs.existsSync(abs)) throw new Error(`no such file on disk: uploads/${rel}`);
      const dir = path.dirname(abs);
      const base = path.basename(abs);
      if (!fs.readdirSync(dir).includes(base)) throw new Error(`case mismatch: uploads/${rel}`);
    }
  }
  console.log(`  badges    ${BLOCK.partners.filter((p) => p.logo).length}/${BLOCK.partners.length} on disk, case checked`);
  console.log(`  marks     ${BLOCK.partners.filter((p) => p.mark).length}/${BLOCK.partners.length} on disk, case checked`);

  console.log('');
  BLOCK.partners.forEach((p, i) => {
    console.log(`  ${String(i + 1).padStart(2, '0')}  ${p.name.padEnd(10)} ${p.color}  ${p.note}`);
    console.log(`      ${p.headline} ${p.headlineAccent}   ·   ${p.tagline}`);
    console.log(`      badge ${p.logo || '(type: ' + p.note + ')'}`);
    console.log(`      mark  ${p.mark || '(type: ' + p.name + ')'}`);
    p.points.forEach((pt, j) => console.log(`      ${String(j + 1).padStart(2, '0')} ${pt.title.padEnd(24)} ${pt.body}`));
    if (!p.points.length) console.log('      (no points — nothing about this partner is written down yet)');
  });

  if (DRY) { console.log('\n  dry run — nothing written'); return; }

  fs.mkdirSync(BACKUPS, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const saved = path.join(BACKUPS, `db-before-ai-partners-${stamp}.json`);
  fs.copyFileSync(DB, saved);
  JSON.parse(fs.readFileSync(saved, 'utf8'));
  console.log(`\n  backup    backend/data/backups/${path.basename(saved)}`);

  const admin = (await request('POST', '/api/auth/login', {
    email: process.env.ADMIN_EMAIL || 'Torii@123.com',
    password: process.env.ADMIN_PASSWORD || 'Admin@123',
  })).setCookie.match(/op_session=([^;]+)/)[1];

  const rowsNow = (await request('GET', `/api/orgs/${ORG}/sections`, null, admin)).json.sections
    .filter((s) => !s.parentId);
  let row = rowsNow.find((s) => s.key === KEY);

  if (!row) {
    row = (await request('POST', `/api/orgs/${ORG}/sections`, {
      key: KEY,
      title: 'AI Partners',
      /* No `intro`: the title cards are off on both decks and a new row must
         not be the one that brings them back. */
      intro: '',
      /* The pane has no artwork for this key, so it falls through to the drawn
         line library — where `partners` is a real glyph. */
      iconKey: 'partners',
      status: 'published',
      hidden: false,
      blocks: [BLOCK],
    }, admin)).json.section;
    console.log(`  created   ${row.id}`);
  } else {
    await request('PATCH', `/api/sections/${row.id}`, {
      title: 'AI Partners', status: 'published', hidden: false, blocks: [BLOCK],
    }, admin);
    console.log(`  updated   ${row.id} (already existed — not duplicated)`);
  }

  /* --------------------------------------------------------- the tab order */
  /* Rebuilt from the order as it stands rather than from a list written here:
     a hard-coded order in a tool is a tool that silently undoes whatever the
     last reorder did. The whole id list goes to an endpoint that refuses a list
     holding another organization's section, so this cannot reach NGI. */
  const all = (await request('GET', `/api/orgs/${ORG}/sections`, null, admin)).json.sections
    .filter((s) => !s.parentId)
    .sort((a, b) => a.order - b.order);
  const target = all.find((s) => s.key === BEFORE);
  if (!target) throw new Error(`no ${BEFORE} row to sit before`);
  const rest = all.filter((s) => s.key !== KEY);
  const at = rest.findIndex((s) => s.key === BEFORE);
  const ordered = [...rest.slice(0, at), all.find((s) => s.key === KEY), ...rest.slice(at)];
  await request('POST', `/api/orgs/${ORG}/sections/reorder`, { order: ordered.map((s) => s.id) }, admin);

  /* Read back through the API — the normaliser is the authority on what stuck. */
  const back = (await request('GET', `/api/orgs/${ORG}/sections`, null, admin)).json.sections
    .filter((s) => !s.parentId)
    .sort((a, b) => a.order - b.order);
  const got = back.find((s) => s.key === KEY).blocks[0];
  console.log('');
  console.log(`  read back  type      ${got.type}${got.type === 'scroll-stack' ? '' : '  !! NORMALISED AWAY — server not restarted?'}`);
  console.log(`             partners  ${(got.partners || []).map((p) => p.name).join(' · ') || '!! DROPPED'}`);
  console.log(`             badges    ${(got.partners || []).filter((p) => p.logo).length} with a lockup, ${(got.partners || []).filter((p) => p.mark).length} with a brand mark`);
  console.log(`             points    ${(got.partners || []).map((p) => `${p.name} ${(p.points || []).length}`).join(' · ')}`);
  console.log(`             headlines ${(got.partners || []).every((p) => p.headline) ? 'all four stuck' : '!! DROPPED — server not restarted?'}`);
  console.log(`  tab order  ${back.map((s) => s.title).join(' > ')}`);
})().catch((e) => { console.error('  ERROR ' + e.message); process.exitCode = 1; });
