import { h, svg } from '../utils/dom.js';
import { icon } from '../utils/icons.js';
import { upload } from '../utils/media.js';

/**
 * Certifications, in three acts.
 *
 *   01 The Register    — the badges travelling two arcs, the totals, the claim.
 *   02 Skills Unlocked — one credential at a time: badge, caption, what it tests.
 *   03 The Gallery     — the cohort artwork, three columns running continuously.
 *
 * The three exist because there are two different bodies of evidence here and they
 * answer different questions. The register is the catalogue: forty-two named
 * credentials, twenty-two awarding bodies, and how many trainees hold each one. The
 * gallery is the proof: the published cards, each a batch with its count and its
 * photograph already set into the artwork.
 *
 * Every badge is a local file. The catalogue pointed at eight different CDNs and
 * this deck is presented with no network, so the artwork is downloaded at publish
 * time and served by the app. A badge the CDN refuses to release carries none, and
 * falls back to the vendor set in type.
 *
 * Nothing here is rounded up. The register totals what the credentials total.
 */

const REDUCED = window.matchMedia?.('(prefers-reduced-motion: reduce)');
const still = () => !!REDUCED?.matches;

const GAP = 12;

const ACTS = [
  { key: 'register', num: '01', name: 'The Register' },
  { key: 'skills', num: '02', name: 'Skills Unlocked' },
  { key: 'gallery', num: '03', name: 'The Gallery' },
];

/* One glyph per vendor, by keyword from the deck's own icon family. Deliberately
   not the vendors' marks: hand-drawing someone else's trademark is worse than not
   showing it, and the real badge artwork is doing that job on this page anyway. */
const GLYPH = {
  aws: 'server', microsoft: 'grid-4', 'google-cloud': 'globe', oracle: 'layers',
  redhat: 'terminal', cisco: 'route', juniper: 'swap', 'pearson-it-specialist': 'code',
  servicenow: 'checklist', pega: 'workflow', salesforce: 'users',
  'automation-anywhere': 'gear', postman: 'link', unity: 'cube', 'arduino-iot': 'chip',
  adobe: 'image', comptia: 'shield', mile2: 'target', others: 'medal',
};

const nf = (n) => Number(n || 0).toLocaleString('en-US');
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

/* Two arcs sharing a centre below the stage. The outer one runs corner to corner:
   given a half-width `a` and an apex rise `k`, a centre `d` below the baseline puts
   both ends exactly on the stage edges. The apex sits 15% down so the act nav above
   it stays clear of the badges. */
const RINGS = [
  { f: 1, dur: 5.6, dir: 1 },
  { f: 0.78, dur: 6.8, dir: -1 },
];

function arcLayout(w, height, count) {
  if (!w || !height || !count) return null;
  const a = w / 2;
  const cx = a;
  const size = clamp(w / 44, 26, 42);
  const k = height - 0.15 * height;
  const u = (a * a - k * k) / (2 * k);
  const r0 = u + k;
  const cy = height + u;

  const base = RINGS.map((cfg) => {
    const r = r0 * cfg.f;
    const byY = Math.acos(clamp((cy - height - size * 0.1) / r, -1, 1));
    const byX = Math.asin(clamp((a - size * 0.1) / r, -1, 1));
    return { r, tMax: Math.min(byY, byX) };
  });

  /* Share the badges out by how much of each arc is actually on stage, so the
     spacing along one arc matches the spacing along the other. */
  const weight = base.reduce((sum, g) => sum + g.tMax * g.r, 0);
  const ideal = base.map((g) => (g.tMax * g.r * count) / weight);
  const counts = ideal.map((v) => Math.max(4, Math.round(v)));
  let total = counts.reduce((sum, v) => sum + v, 0);
  let guard = 0;
  while (total !== count && guard < 200) {
    const dir = total < count ? 1 : -1;
    let best = 0;
    for (let i = 1; i < counts.length; i += 1) {
      if (dir * (ideal[i] - counts[i]) > dir * (ideal[best] - counts[best])) best = i;
    }
    counts[best] += dir;
    total += dir;
    guard += 1;
  }

  let from = 0;
  const rings = base.map((g, i) => {
    const m = Math.max(4, counts[i]);
    const full = Math.acos(clamp((cy - height) / g.r, -1, 1));
    const ex = cx + g.r * Math.sin(full);
    const ey = cy - g.r * Math.cos(full);
    /* pitch = arc-span / (m-1): first icon sits at -tMax, last at +tMax,
       every slot equally spaced with no dead gap at either end. */
    const pitch = (2 * g.tMax) / Math.max(1, m - 1);
    const ring = {
      r: g.r,
      tMax: g.tMax,
      pitch,
      count: m,
      from,
      dur: RINGS[i].dur,
      dir: RINGS[i].dir,
      d: `M${(cx - g.r * Math.sin(full)).toFixed(1)} ${ey.toFixed(1)}`
        + `A${g.r.toFixed(1)} ${g.r.toFixed(1)} 0 0 1 ${ex.toFixed(1)} ${ey.toFixed(1)}`,
    };
    from += m;
    return ring;
  });

  const halfBox = Math.min(380, a - 90);
  return {
    cx, cy, size, rings,
    keepOut: { x0: cx - halfBox, x1: cx + halfBox, y0: height - 200 },
  };
}

/* Every logo already fits its box on the long side; a wide wordmark still reads
   larger than a square badge at equal width, so ease the extremes down a little. */
function evenOut(img) {
  const w = img.naturalWidth;
  const px = img.naturalHeight;
  if (!w || !px) return;
  const fill = Math.min(w / px, px / w);
  img.style.transform = `scale(${Math.max(0.86, fill ** 0.18).toFixed(3)})`;
}

function badgeArt(item, cls, srcOf) {
  if (!item.badge) return h('em', { class: cls }, (item.vendor || '?').slice(0, 2).toUpperCase());
  return h('img', {
    class: cls, src: srcOf(item.badge), alt: '', loading: 'lazy', decoding: 'async',
    onload: (e) => evenOut(e.currentTarget),
    onerror: (e) => { e.currentTarget.style.visibility = 'hidden'; },
  });
}

/* ------------------------------------------------------------ the cohort wall */
const TILE_SPEED = [46, 58, 52];

export function CertificationWall(block, { editing = false } = {}) {
  const vendors = (block.vendors || []).filter((v) => v.certs?.length);
  const credentials = (block.credentials || []).filter((c) => c.name);
  const root = h('div', { class: 'cs-root ph-root' });

  if (!vendors.length && !credentials.length) {
    root.appendChild(h('div', { class: 'cs-empty' },
      h('h2', { class: 'cs-title' }, block.title || 'Certifications'),
      editing
        ? h('p', { class: 'cs-hint' },
            'Drop the cards into backend/uploads/certifications/ and re-run the publish step.')
        : null,
    ));
    return root;
  }

  const cards = vendors.reduce((n, v) => n + v.certs.length, 0);
  const earned = credentials.reduce((n, c) => n + (c.held || 0), 0);
  const bodies = new Set(credentials.map((c) => c.vendor)).size;

  let act = ACTS[0].key;
  const src = (p) => upload(String(p).split('/').map(encodeURIComponent).join('/'));
  const frames = [];
  const observers = [];

  /* --------------------------------------------------------------- lightbox */
  /* Portalled to the body. FitSlide scales the slide with a transform, and a
     transformed ancestor becomes the containing block for fixed descendants — so
     inside the slide `inset: 0` resolves to the slide box, not the screen. */
  const lightImg = h('img', { class: 'cs-light__img', alt: '' });
  const lightCap = h('p', { class: 'cs-light__cap' });
  const lightMeta = h('span', { class: 'cs-light__meta' });
  const lightCount = h('span', { class: 'cs-light__count' });
  let shown = [];
  let at = 0;

  const prevBtn = h('button', {
    class: 'cs-light__nav cs-light__nav--prev', type: 'button', 'aria-label': 'Previous',
    onclick: (e) => { e.stopPropagation(); step(-1); },
  }, icon('chevron-left', { class: 'ic' }));
  const nextBtn = h('button', {
    class: 'cs-light__nav cs-light__nav--next', type: 'button', 'aria-label': 'Next',
    onclick: (e) => { e.stopPropagation(); step(1); },
  }, icon('chevron-right', { class: 'ic' }));

  const light = h('div', {
    class: 'cs-light', hidden: true,
    onclick: (e) => { if (e.target === light || e.target.closest('.cs-light__close')) shut(); },
  },
    h('button', { class: 'cs-light__close', type: 'button', 'aria-label': 'Close' },
      icon('close', { class: 'ic ic--sm' })),
    prevBtn, nextBtn,
    h('figure', { class: 'cs-light__frame' }, lightImg,
      h('figcaption', { class: 'cs-light__foot' }, lightCap, lightMeta, lightCount)),
  );
  document.body.appendChild(light);

  function shut() {
    light.hidden = true;
    light.classList.remove('is-on');
    document.removeEventListener('keydown', onKey, true);
  }
  function onKey(e) {
    if (e.key === 'Escape') { e.stopPropagation(); shut(); return; }
    if (e.key === 'ArrowRight') { e.stopPropagation(); e.preventDefault(); step(1); }
    if (e.key === 'ArrowLeft') { e.stopPropagation(); e.preventDefault(); step(-1); }
  }
  function step(d) {
    if (shown.length < 2) return;
    at = (at + d + shown.length) % shown.length;
    paintLight();
  }
  function paintLight() {
    const it = shown[at];
    if (!it) return;
    lightImg.src = src(it.src);
    lightImg.alt = it.label || '';
    lightCap.textContent = it.label || '';
    lightMeta.textContent = `${it.vendor} · ${it.w} × ${it.h}`;
    lightCount.textContent = shown.length > 1 ? `${at + 1} / ${shown.length}` : '';
    prevBtn.hidden = shown.length < 2;
    nextBtn.hidden = shown.length < 2;
  }
  function openLight(list, i) {
    shown = list;
    at = Math.max(0, i);
    paintLight();
    light.hidden = false;
    requestAnimationFrame(() => light.classList.add('is-on'));
    document.addEventListener('keydown', onKey, true);
  }

  /* ============================================================== 01 REGISTER */
  const stage1 = h('div', { class: 'cs-reg' });
  const wire = svg('svg', { class: 'cs-arcs', 'aria-hidden': 'true' });
  const drift = h('div', { class: 'cs-drift' }, wire);
  const pins = [];
  let plan = null;
  let lastW = 0;
  let lastH = 0;

  function buildArcs() {
    const w = stage1.clientWidth;
    const ht = stage1.clientHeight;
    if (!w || !ht) return;
    if (Math.abs(w - lastW) < 4 && Math.abs(ht - lastH) < 4) return;
    lastW = w;
    lastH = ht;

    plan = arcLayout(w, ht, credentials.length);
    if (!plan) return;

    wire.setAttribute('viewBox', `0 0 ${w} ${ht}`);
    wire.replaceChildren(
      svg('defs', {},
        svg('linearGradient', { id: 'csArcGrad', x1: '0', y1: '0', x2: '1', y2: '0' },
          svg('stop', { offset: '0%', 'stop-color': '#71BD1F', 'stop-opacity': '0' }),
          svg('stop', { offset: '13%', 'stop-color': '#71BD1F', 'stop-opacity': '0.45' }),
          svg('stop', { offset: '34%', 'stop-color': '#52A310', 'stop-opacity': '0.95' }),
          svg('stop', { offset: '52%', 'stop-color': '#71BD1F', 'stop-opacity': '1' }),
          svg('stop', { offset: '70%', 'stop-color': '#52A310', 'stop-opacity': '0.95' }),
          svg('stop', { offset: '88%', 'stop-color': '#71BD1F', 'stop-opacity': '0.45' }),
          svg('stop', { offset: '100%', 'stop-color': '#71BD1F', 'stop-opacity': '0' }),
        ),
      ),
      /* Four strokes to a line: a grey track that stays legible the whole way
         round, a blurred bloom, the gradient filament, and a pulse running it. */
      ...plan.rings.flatMap((g, i) => [
        svg('path', { class: 'cs-arc__base', d: g.d, pathLength: '1000', style: { '--i': String(i) } }),
        svg('path', { class: 'cs-arc__glow', d: g.d, pathLength: '1000', style: { '--i': String(i) } }),
        svg('path', { class: 'cs-arc__line', d: g.d, pathLength: '1000', style: { '--i': String(i) } }),
        svg('path', { class: 'cs-arc__pulse', d: g.d, pathLength: '1000', style: { '--i': String(i) } }),
      ]),
    );

    pins.length = 0;
    const holders = [];
    plan.rings.forEach((g) => {
      for (let j = 0; j < g.count; j += 1) {
        const cred = credentials[(g.from + j) % credentials.length];
        const el = h('button', {
          class: 'cs-pin', type: 'button',
          style: { width: `${plan.size}px`, '--i': String(g.from + j) },
          onclick: () => { act = 'skills'; pick = credentials.indexOf(cred); viewMode = 'detail'; drawSteps(); showAct(); },
        },
          h('span', { class: 'cs-pin__in' },
            h('span', { class: 'cs-pin__bob' },
              h('span', { class: 'cs-pin__art' }, badgeArt(cred, '', src)))),
        );
        pins.push(el);
        holders.push(el);
      }
    });
    drift.replaceChildren(wire, ...holders);
  }

  /* One loop drives the travel, the fades and the pointer drift. Each badge keeps
     its own logo and wraps round the ends, so nothing is ever re-sourced in flight
     and the run never jumps. */
  let hoverAt = -1;
  const aim = { x: 0, y: 0 };
  stage1.addEventListener('pointermove', (e) => {
    if (still()) return;
    const r = stage1.getBoundingClientRect();
    if (!r.width || !r.height) return;
    aim.x = (e.clientX - r.left) / r.width - 0.5;
    aim.y = (e.clientY - r.top) / r.height - 0.5;
  });
  stage1.addEventListener('pointerleave', () => { aim.x = 0; aim.y = 0; });

  const t0 = performance.now();
  let px = 0;
  let py = 0;
  frames.push(function travel(now) {
    if (act !== 'register' || !plan) return;
    const elapsed = (now - t0) / 1000;
    px += (aim.x - px) * 0.06;
    py += (aim.y - py) * 0.06;
    drift.style.setProperty('--px', px.toFixed(4));
    drift.style.setProperty('--py', py.toFixed(4));

    const { cx, cy, size, keepOut } = plan;
    let slot = 0;
    for (const g of plan.rings) {
      const halfPitch = g.pitch * 0.5;
      const span = 2 * g.tMax + g.pitch;
      const move = still() ? 0 : (elapsed / g.dur) * g.pitch * g.dir;
      for (let j = 0; j < g.count; j += 1) {
        const el = pins[slot + j];
        if (!el) continue;
        const raw = -g.tMax + j * g.pitch + move;
        const t = ((raw + g.tMax + halfPitch) % span + span) % span - (g.tMax + halfPitch);
        const x = cx + g.r * Math.sin(t);
        const y = cy - g.r * Math.cos(t);

        /* Smooth fade at the extreme ends of the arc */
        const ends = clamp((g.tMax + halfPitch - Math.abs(t)) / g.pitch, 0, 1);

        /* Fade if icon enters the central text box near the bottom */
        let clear = 1;
        if (y > keepOut.y0 && x > keepOut.x0 && x < keepOut.x1) {
          const dx = Math.min(x - keepOut.x0, keepOut.x1 - x);
          const dy = y - keepOut.y0;
          clear = clamp(Math.min(dx, dy) / 30, 0, 1);
        }

        let o = ends * clear;
        if (hoverAt >= 0 && hoverAt !== slot + j) o *= 0.28;
        el.style.transform = `translate3d(${(x - size / 2).toFixed(1)}px, ${(y - size / 2).toFixed(1)}px, 0)`;
        el.style.opacity = o.toFixed(3);
        const hit = o > 0.45 ? 'auto' : 'none';
        if (el.dataset.hit !== hit) { el.style.pointerEvents = hit; el.dataset.hit = hit; }
      }
      slot += g.count;
    }
  });

  drift.addEventListener('pointerover', (e) => {
    const el = e.target.closest('.cs-pin');
    hoverAt = el ? pins.indexOf(el) : -1;
  });
  drift.addEventListener('pointerout', (e) => {
    if (!e.relatedTarget || !drift.contains(e.relatedTarget)) hoverAt = -1;
  });

  function drawRegister() {
    stage1.onclick = (e) => {
      if (!e.target.closest('.cs-pin')) {
        act = 'skills';
        viewMode = 'grid';
        drawSteps();
        showAct();
      }
    };

    stage1.replaceChildren(
      /* Their own cohort panorama, held right back. The reference sets this type
         over a crowd, and using a real one of theirs beats any stock ground. */
      block.backdrop
        ? h('div', { class: 'cs-reg__back', 'aria-hidden': 'true' },
            h('img', { src: src(block.backdrop), alt: '', decoding: 'async' }))
        : null,
      drift,
      h('div', { class: 'cs-reg__mid' },
        h('div', { class: 'cs-figs' },
          h('div', { class: 'cs-fig', style: { '--i': '0' } },
            h('strong', {}, nf(earned)), h('span', {}, 'Certifications')),
          h('i', { class: 'cs-figs__rule' }),
          h('div', { class: 'cs-fig', style: { '--i': '1' } },
            h('strong', {}, '16,000+'), h('span', {}, 'Trainees Certified')),
        ),
      ),
    );
    lastW = 0;
    lastH = 0;
    requestAnimationFrame(buildArcs);
  }

  /* ================================================================ 02 SKILLS & CARDS GRID */
  const skillList = h('div', { class: 'cs-grid-view' });
  const skillPane = h('div', { class: 'cs-detail-view' });
  let viewMode = 'grid'; // 'grid' | 'detail'
  let pick = 0;
  let autoPlay = true;
  let swipeCooldown = false;

  function getCountColor(count) {
    if (count >= 5000) return '#F59E0B'; // > 5000: Gold
    if (count >= 1500) return '#71BD1F'; // 1500-5000: Brand Green
    if (count >= 600)  return '#06B6D4'; // 600-1500: Cyan / Electric Teal
    if (count >= 300)  return '#3B82F6'; // 300-600: Royal Blue
    return '#8B5CF6';                    // < 300: Purple
  }

  function drawSkills() {
    const sorted = [...credentials].sort((a, b) => b.held - a.held);
    const chosen = clamp(pick, 0, sorted.length - 1);

    if (viewMode === 'grid') {
      skillList.style.display = 'grid';
      skillPane.style.display = 'none';

      skillList.replaceChildren(...sorted.map((c, i) => {
        const accent = getCountColor(c.held);
        return h('button', {
          class: 'cs-grid-card',
          type: 'button',
          style: { '--i': String(Math.min(i, 35)), '--card-accent': accent },
          onclick: () => { pick = i; viewMode = 'detail'; drawSkills(); },
        },
          /* Top: Certification Name */
          h('div', { class: 'cs-grid-card__head' },
            h('h4', { class: 'cs-grid-card__title' }, c.name),
          ),
          /* Horizontal Grey Line */
          h('i', { class: 'cs-grid-card__hrule' }),
          /* Body: Left Logo | Vertical Grey Line | Right Count */
          h('div', { class: 'cs-grid-card__body' },
            h('div', { class: 'cs-grid-card__art' }, badgeArt(c, '', src)),
            h('i', { class: 'cs-grid-card__vrule' }),
            h('div', { class: 'cs-grid-card__count-meta' },
              h('strong', { class: 'cs-grid-card__count-val', style: { color: accent } }, nf(c.held)),
              h('span', { class: 'cs-grid-card__count-lbl' }, 'Certifications Done'),
            ),
          ),
        );
      }));
    } else {
      skillList.style.display = 'none';
      skillPane.style.display = 'flex';

      const c = sorted[chosen];
      const prevIdx = (chosen - 1 + sorted.length) % sorted.length;
      const nextIdx = (chosen + 1) % sorted.length;
      const prevCred = sorted[prevIdx];
      const nextCred = sorted[nextIdx];

      /* Top Left: Home Button */
      const homeBtn = h('button', {
        class: 'cs-detail__home',
        type: 'button',
        onclick: () => { viewMode = 'grid'; drawSkills(); },
      }, icon('chevron-left', { class: 'ic ic--xs' }), 'HOME');

      /* Top Right: Total Completed Count */
      const totalHeader = h('div', { class: 'cs-detail__total' },
        h('strong', {}, nf(earned)),
        h('span', {}, 'CERTIFICATIONS COMPLETED'),
      );

      /* Left Side: Index, Oswald Title, Count, Accent line */
      const leftCol = h('div', { class: 'cs-detail__left' },
        h('p', { class: 'cs-detail__idx' },
          h('span', { class: 'cs-detail__idx-num' }, String(chosen + 1).padStart(2, '0')),
          ` / ${sorted.length}`
        ),
        h('h2', { class: 'cs-detail__oswald-title' }, c.name),
        h('div', { class: 'cs-detail__held-box' },
          h('div', { class: 'cs-detail__held-num' },
            h('strong', {}, nf(c.held)),
            h('span', {}, 'certifications completed')
          ),
          h('i', { class: 'cs-detail__accent-bar' }),
        ),
      );

      /* Center Stage: Main Active Badge + Falling-from-Sky Background Badge */
      const centerStage = h('div', {
        class: 'cs-detail__center-stage',
        onwheel: (e) => {
          if (swipeCooldown) return;
          if (Math.abs(e.deltaX) > 20) {
            swipeCooldown = true;
            setTimeout(() => { swipeCooldown = false; }, 350);
            pick = e.deltaX > 0 ? nextIdx : prevIdx;
            drawSkills();
          }
        },
      },
        /* Secondary Badge Descending / Falling from the Sky (Top Right Background) */
        h('div', { class: 'cs-detail__bg-float' },
          badgeArt(nextCred, 'cs-sky-fall-img', src),
        ),
        /* Main Active Centered Badge with Blur-to-Focus & Breathing Scale Glow */
        h('div', { class: 'cs-detail__main-badge' },
          h('span', { class: 'cs-detail__halo-ring' }),
          h('span', { class: 'cs-detail__halo-ring cs-detail__halo-ring--outer' }),
          badgeArt(c, 'cs-detail__badge-img cs-morph-img', src),
        ),
      );

      /* Right Side: Skills Unlocked (Pure text list without any cards or box layouts) */
      const rightCol = h('div', { class: 'cs-detail__right' },
        h('h4', { class: 'cs-detail__skills-head' }, 'SKILLS UNLOCKED'),
        h('ol', { class: 'cs-detail__skills-ol' },
          ...(c.skills || []).map((skillText, idx) => h('li', { style: { '--i': String(idx) } },
            h('span', { class: 'cs-detail__skill-num' }, String(idx + 1).padStart(2, '0')),
            h('span', { class: 'cs-detail__skill-txt' }, skillText),
          )),
        ),
      );

      /* Bottom Right Navigation Controls: < || > */
      const navControls = h('div', { class: 'cs-detail__nav-bar' },
        h('button', {
          class: 'cs-detail__nav-btn', type: 'button', title: `Previous: ${prevCred.name}`,
          onclick: () => { pick = prevIdx; drawSkills(); },
        }, icon('chevron-left', { class: 'ic ic--xs' })),
        h('button', {
          class: `cs-detail__nav-btn${autoPlay ? ' is-active' : ''}`, type: 'button',
          title: autoPlay ? 'Pause' : 'Play',
          onclick: () => { autoPlay = !autoPlay; drawSkills(); },
        }, icon(autoPlay ? 'pause' : 'play', { class: 'ic ic--xs' })),
        h('button', {
          class: 'cs-detail__nav-btn', type: 'button', title: `Next: ${nextCred.name}`,
          onclick: () => { pick = nextIdx; drawSkills(); },
        }, icon('chevron-right', { class: 'ic ic--xs' })),
      );

      skillPane.replaceChildren(
        h('div', { class: 'cs-detail__top-bar' }, homeBtn, totalHeader),
        h('div', { class: 'cs-detail__main-grid' }, leftCol, centerStage, rightCol),
        navControls,
      );
    }
  }

  /* =============================================================== 03 GALLERY */
  const rail = h('nav', { class: 'cs-rail', 'aria-label': 'Certification vendors' });
  const galHead = h('div', { class: 'cs-galhead' });
  const columns = h('div', { class: 'cs-cols' });
  let vendor = vendors[0] || null;

  const shownVendors = () => (vendor ? [vendor] : vendors);

  function drawGalHead() {
    const list = shownVendors();
    const n = list.reduce((sum, v) => sum + v.certs.length, 0);
    const label = vendor ? vendor.name : 'Everyone';
    galHead.replaceChildren(
      h('span', { class: 'cs-galhead__pre' }, 'Certified'),
      h('h3', { class: 'cs-galhead__name' },
        ...String(label).split(' ').map((word, i) => h('span', {
          class: 'cs-w', style: still() ? {} : { '--i': String(i) },
        }, h('span', {}, word)))),
      h('p', { class: 'cs-galhead__meta' },
        `${n} card${n === 1 ? '' : 's'} · ${vendor ? vendor.domain || 'one vendor' : `${vendors.length} vendors`}`),
      h('i', { class: 'cs-galhead__rule' }),
    );
  }

  /* Three columns running continuously, the middle one against the other two. The
     set is duplicated and the track travels exactly half its height, so the loop
     closes on itself — the gap rides on each tile's margin rather than on the flex
     gap, or the seam lands short by one gap. */
  function drawColumns() {
    const flat = shownVendors().flatMap((v) => v.certs.map((c) => ({ ...c, vendor: v.name })));
    const lanes = [[], [], []];
    flat.forEach((it, i) => lanes[i % 3].push({ ...it, index: i }));

    columns.replaceChildren(...lanes.map((lane, col) => {
      const tiles = lane.length ? lane : [null];
      const build = (it, k) => (it
        ? h('button', {
            class: 'cs-tile', type: 'button',
            style: { paddingTop: `${clamp((it.h / it.w) * 100, 62, 150)}%` },
            title: `${it.label} — open full size`,
            onclick: () => openLight(flat, it.index),
          },
            h('img', {
              src: src(it.src), alt: it.label || '', width: it.w, height: it.h,
              loading: it.index < 9 ? 'eager' : 'lazy', decoding: 'async',
            }),
            h('span', { class: 'cs-tile__tag' },
              h('em', {}, it.label), vendor ? null : h('span', {}, it.vendor)),
            h('span', { class: 'cs-tile__zoom', 'aria-hidden': 'true' },
              icon('expand', { class: 'ic ic--xs' })),
          )
        : h('span', { class: 'cs-tile cs-tile--empty', style: { paddingTop: '100%' } }));

      return h('div', { class: 'cs-col' },
        h('div', {
          class: 'cs-col__track',
          style: {
            '--dur': `${TILE_SPEED[col]}s`,
            '--dir': col === 1 ? 'reverse' : 'normal',
          },
        }, ...tiles.map(build), ...tiles.map(build)),
      );
    }));
  }

  function drawRail() {
    rail.textContent = '';
    const entry = (label, sub, value, count, glyph, i) => h('button', {
      class: `cs-chip${vendor === value ? ' is-on' : ''}`,
      type: 'button', 'aria-current': vendor === value ? 'true' : 'false',
      style: still() ? {} : { '--i': String(i) },
      onclick: () => {
        if (vendor === value) return;
        vendor = value;
        drawRail(); drawGalHead(); drawColumns();
      },
    },
      h('span', { class: 'cs-chip__glyph' }, icon(glyph, { class: 'ic ic--xs' })),
      h('span', { class: 'cs-chip__name' }, label),
      h('span', { class: 'cs-chip__n' }, String(count)),
    );
    rail.appendChild(entry('Everyone', `${vendors.length} vendors`, null, cards, 'grid-4', 0));
    vendors.forEach((v, i) => rail.appendChild(
      entry(v.name, v.domain, v, v.certs.length, GLYPH[v.key] || 'certificate', i + 1)));
  }

  /* =================================================================== chrome */
  const steps = h('nav', { class: 'cs-steps', role: 'tablist' });
  const acts = h('div', { class: 'cs-acts' });

  function drawSteps() {
    steps.replaceChildren(...ACTS.map((a) => h('button', {
      class: `cs-step${a.key === act ? ' is-on' : ''}`,
      type: 'button', role: 'tab', 'aria-selected': String(a.key === act),
      onclick: () => { if (a.key !== act) { act = a.key; drawSteps(); showAct(); } },
    },
      h('em', {}, a.num),
      h('span', {}, a.name),
    )));
  }

  function showAct() {
    acts.dataset.act = act;
    if (act === 'register') drawRegister();
    if (act === 'skills') drawSkills();
    if (act === 'gallery') { drawRail(); drawGalHead(); drawColumns(); }
  }

  const head = h('div', { class: 'cs-head' },
    h('div', { class: 'cs-head__center' },
      block.eyebrow ? h('p', { class: 'cs-eyebrow' }, block.eyebrow) : h('p', { class: 'cs-eyebrow' }, 'GLOBAL SKILLING & CREDENTIALS'),
      h('h2', { class: 'cs-title' }, block.title || 'Empowering Minds, Certifying Excellence'),
    ),
    steps,
  );

  acts.append(
    h('section', { class: 'cs-act cs-act--register' }, stage1),
    h('section', { class: 'cs-act cs-act--skills' },
      h('div', { class: 'cs-skills' }, skillList, skillPane)),
    h('section', { class: 'cs-act cs-act--gallery' },
      h('div', { class: 'cs-gal' },
        h('div', { class: 'cs-galside' }, galHead, rail),
        columns)),
  );

  root.append(head, acts);
  drawSteps();
  showAct();

  /* One rAF for the whole block. Separate loops per effect meant the register kept
     ticking behind the other two acts. */
  let raf = requestAnimationFrame(function tick(now) {
    for (const fn of frames) fn(now);
    raf = requestAnimationFrame(tick);
  });

  /* The arc geometry is solved in layout pixels: clientWidth is pre-transform, so
     it is safe here, unlike a bounding rect, which FitSlide returns scaled. */
  const watchSize = new ResizeObserver(() => { if (act === 'register') buildArcs(); });
  watchSize.observe(stage1);
  observers.push(watchSize);

  /* The lightbox lives on the body, so it has to be taken down by hand when the
     slide that owns it is replaced. */
  const watch = new MutationObserver(() => {
    if (!root.isConnected) {
      light.remove();
      cancelAnimationFrame(raf);
      watch.disconnect();
      observers.forEach((o) => o.disconnect());
      document.removeEventListener('keydown', onKey, true);
    }
  });
  watch.observe(document.body, { childList: true, subtree: true });

  return root;
}
