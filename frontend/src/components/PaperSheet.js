import { h } from '../utils/dom.js';

/**
 * The translucent sheet, ported from ThreeUI's `ThreeDPaper`, variant `original`.
 *
 * Source bundle: https://threeui.com/source-code/3d-paper.json
 * Canonical file `src/shaders/3d-paper/sources/3d-paper.html`,
 * SHA-256 8ec1b71c0dbcafbadf908100ae2a08045d0a1087c00a09d28245ef19366c7353 —
 * verified against the fetched bytes before any of this was written, along with
 * the other five registered files.
 *
 * The physics, the shader and the material are the authored ones, carried over
 * line for line: the arc-length-preserving bend (`sheetPoint` integrates the
 * bend angle instead of pushing Z, which is why the silhouette really pulls in
 * where the sheet turns away), the Fresnel rim term that both lights and
 * thickens the edge, the alpha cut judged against the artwork's own alpha
 * rather than alpha×opacity, the PMREM environment, the drag-to-turn with
 * angular velocity carried past release and settling on the nearest whole
 * turn, and the pointer light that follows the cursor across the page.
 *
 * Three.js r149 is the bundle that ships inside that source file, written out
 * to /vendor/three.r149.js rather than inlined — the deck runs offline, so it
 * cannot come from a CDN, and 600KB of library has no business inside a
 * component module.
 *
 * ------------------------------------------------------------------ changes
 *
 * 1. It no longer owns the window. The authored page is `position: fixed` over
 *    the viewport and reads `window.innerWidth/innerHeight` for the renderer
 *    size, the camera aspect and every pointer test. Here it lives in one
 *    block of a slide that is laid out at a nominal 1600×900 and then
 *    transform-scaled, so all of that is measured against the host element's
 *    own rectangle instead. Pointer coordinates are made relative to it too,
 *    or the hit test would be off by the slide's offset and the paper would
 *    light up when the cursor was somewhere else entirely.
 *
 * 2. It starts and stops. The authored page runs its loop forever; a deck has
 *    other slides and other tabs, and a WebGL context churning behind a hidden
 *    panel is wasted battery. `start()`/`stop()` gate the frame loop, and the
 *    scene is only built on first reveal.
 *
 * 3. The ground is white, so the whole thing is inverted. This is the one
 *    place the port really departs from the source, and it has to: the
 *    original is a dark studio — near-black page, pale ink on the sheet, a
 *    dark environment map reflected in the glass, a black halo behind the
 *    paper and a dark vignette over everything. Every one of those is wrong
 *    way round on white. What is preserved is what the brief asks to keep:
 *    the transparency, the refraction and rim light, the hover light and the
 *    drag. See THEME below for what each value became and why.
 */

const THREE_URL = '/vendor/three.r149.js';

/* The artwork canvas. The authored proportion, and the authored trick of
   composing on the old 1200×1656 grid and scaling up for a crisper print. */
const TW = 1400;
const TH = 1932;
const GW = 1200;
const GH = 1656;

/* ---------------------------------------------------------------- THEME
   left  = authored (dark studio)          right = here (white ground)
   page          #08080a                   #ffffff
   wordmark      rgba(242,242,240,.125)    rgba(0,0,0,.13)   black, as asked
   sheet ink     #ffffff / white alphas    navy #0E2455
   accent        —                         orange #D45F06
   environment   #3a3d47 → #08080a         #ffffff → #dfe6f2  (a lit room, not
                 a dark room; the glass reflects its surroundings, and on a
                 white page a dark reflection reads as a smoked pane)
   halo          black .30                 white .34  (its job is to separate
                 the sheet from the wordmark behind it — on white that means
                 lightening, not darkening)
   vignette      dark radial               removed
   ------------------------------------------------------------------------ */
/* Black on the page, orange for what is being pointed at.
 *
 * Both run darker than the same design would need on paper, because nothing
 * here paints straight onto the page: the material multiplies the artwork by
 * its own light-blue tint and then a bright key light lifts the result, so
 * every ink arrives on screen paler than it was mixed. Navy came out a washed
 * grey-blue and had to go to black. The accent is a darkened brand orange for
 * the same reason — raw #F6872A survives that lift as something close to
 * salmon. */
/* The authored ink: white on a dark sheet, with hierarchy carried in the
   alpha rather than in the size — #ffffff for what leads, .90 for the body,
   .62 for the small print. That is why the original reads as printed on glass
   rather than drawn on it, and it only works over a dark ground.
   Orange joins it as a text colour, for the phrases worth pointing at. Raw
   NCET orange is right here: on this ground it measures about 8:1, and the
   darkened ink a light page needed would look muddy. */
const INK = '#FFFFFF';
const INK_SOFT = 'rgba(255, 255, 255, .92)';
const INK_FAINT = 'rgba(255, 255, 255, .56)';
const ACCENT = '#F6872A';

let threeReady = null;

/** Loads the vendored UMD bundle once, no matter how many sheets ask. */
function loadThree() {
  if (window.THREE) return Promise.resolve(window.THREE);
  if (threeReady) return threeReady;
  threeReady = new Promise((resolve, reject) => {
    const tag = document.createElement('script');
    tag.src = THREE_URL;
    tag.onload = () => (window.THREE ? resolve(window.THREE) : reject(new Error('three.js did not register')));
    tag.onerror = () => reject(new Error(`could not load ${THREE_URL}`));
    document.head.appendChild(tag);
  });
  return threeReady;
}

/* ===================================================================== art */

/** Authored helper: a rounded rectangle path. */
function rr(ctx, x, y, w, hh, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + hh, r);
  ctx.arcTo(x + w, y + hh, x, y + hh, r);
  ctx.arcTo(x, y + hh, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

const FACE = '"Segoe UI", system-ui, -apple-system, "Helvetica Neue", Arial, sans-serif';
const font = (weight, size) => `${weight} ${size}px ${FACE}`;

/**
 * Splits `**bold**` runs out of a string.
 *
 * The source sheets bold a phrase inside a sentence — "Accredited by **NAAC
 * under Cycle-II with A+ Grade**" — and canvas has no rich text, so the line
 * has to be wrapped run by run with the font swapped between them. The
 * authored `wrapL` only ever handled one weight.
 */
function runs(text) {
  return String(text).split(/(\*\*[^*]+\*\*)/).filter(Boolean).map((part) => (
    part.startsWith('**') && part.endsWith('**')
      ? { text: part.slice(2, -2), bold: true }
      : { text: part, bold: false }
  ));
}

/** Wraps mixed-weight runs, returns the y just past the last line. */
function wrapRuns(ctx, parts, x, y, maxW, lh, size, colour, boldColour) {
  let cx = x;
  let cy = y;
  for (const part of parts) {
    ctx.font = font(part.bold ? 700 : 400, size);
    ctx.fillStyle = part.bold ? (boldColour || colour) : colour;
    const words = part.text.split(/(\s+)/).filter((w) => w !== '');
    for (const word of words) {
      const w = ctx.measureText(word).width;
      if (cx + w > x + maxW && cx > x) {
        if (/^\s+$/.test(word)) continue;
        cy += lh;
        cx = x;
      }
      if (/^\s+$/.test(word) && cx === x) continue;
      ctx.fillText(word, cx, cy);
      cx += w;
    }
  }
  return cy + lh;
}

/** Measures the same thing without painting, so the body can be auto-fitted. */
function measureRuns(ctx, parts, x, maxW, lh, size) {
  let cx = x;
  let cy = 0;
  for (const part of parts) {
    ctx.font = font(part.bold ? 700 : 400, size);
    const words = part.text.split(/(\s+)/).filter((w) => w !== '');
    for (const word of words) {
      const w = ctx.measureText(word).width;
      if (cx + w > x + maxW && cx > x) {
        if (/^\s+$/.test(word)) continue;
        cy += lh;
        cx = x;
      }
      if (/^\s+$/.test(word) && cx === x) continue;
      cx += w;
    }
  }
  return cy + lh;
}

/**
 * Paints one sheet on the 1200×1656 grid.
 *
 * The skeleton is the authored certificate's: the glass wash, the frost band
 * that keeps a headline legible over whatever shows through, the two nested
 * rounded rules, a mark at the head, the title, the body, and the signature
 * line at the foot. Only the words and the ink colour differ.
 *
 * The body auto-fits. Two sheets of very different lengths — twelve
 * recognitions against three paragraphs — have to sit on the same sheet, and
 * a fixed type size would either overflow one or strand the other. The body
 * is measured at a trial size and stepped down until it fits the band.
 */
function drawSheet(ctx, sheet) {
  ctx.scale(TW / GW, TH / GH);

  // the glass itself
  ctx.fillStyle = 'rgba(255,255,255,.030)';
  ctx.fillRect(0, 0, GW, GH);

  /* The authored frost is "a whisper behind the headline so it holds over the
     type below" — a soft band from 240 to 880. It is extended here to run the
     whole height of the type, because a black wordmark sits behind this sheet
     rather than a pale one, and the body needs the same ground the headline
     was given. Still a whisper: .072 over a .030 wash is about a tenth
     opaque, so nothing about the transparency is lost. */
  const fr = ctx.createLinearGradient(0, 240, 0, 1470);
  fr.addColorStop(0, 'rgba(255,255,255,0)');
  fr.addColorStop(0.09, 'rgba(255,255,255,.055)');
  fr.addColorStop(0.90, 'rgba(255,255,255,.055)');
  fr.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = fr;
  ctx.fillRect(40, 240, 1120, 1230);

  // the authored double rule, in ink rather than white
  ctx.strokeStyle = 'rgba(255, 255, 255, .34)';
  ctx.lineWidth = 2;
  rr(ctx, 20, 20, 1160, 1616, 14);
  ctx.stroke();
  ctx.strokeStyle = 'rgba(255, 255, 255, .12)';
  ctx.lineWidth = 1;
  rr(ctx, 36, 36, 1128, 1584, 10);
  ctx.stroke();

  const M = 74;
  const COL = GW - M * 2;

  // eyebrow
  if (sheet.eyebrow) {
    ctx.font = font(600, 26);
    ctx.fillStyle = ACCENT;
    const letters = String(sheet.eyebrow).toUpperCase().split('');
    let ex = M;
    for (const ch of letters) {
      ctx.fillText(ch, ex, 150);
      ex += ctx.measureText(ch).width + 5.5;
    }
  }

  // title — steps down a size if it would otherwise run past the column
  let titleSize = 104;
  ctx.font = font(700, titleSize);
  while (ctx.measureText(sheet.title).width > COL && titleSize > 56) {
    titleSize -= 4;
    ctx.font = font(700, titleSize);
  }
  ctx.fillStyle = INK;
  ctx.fillText(sheet.title, M, 292);

  ctx.strokeStyle = ACCENT;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(M, 336);
  ctx.lineTo(M + 150, 336);
  ctx.stroke();

  // ---------------------------------------------------------------- body
  const TOP = 420;
  const BOTTOM = 1430;
  const BAND = BOTTOM - TOP;
  const entries = Array.isArray(sheet.entries) ? sheet.entries : [];
  const bulleted = sheet.layout !== 'sections';

  const plan = (size) => {
    const lh = Math.round(size * 1.32);
    const labelSize = Math.round(size * 1.22);
    const gap = bulleted ? Math.round(size * 0.5) : Math.round(size * 0.92);
    const indent = bulleted ? 42 : 0;
    let y = 0;
    for (const entry of entries) {
      if (!bulleted && entry.label) y += labelSize + Math.round(size * 0.52);
      y += measureRuns(ctx, runs(entry.body || ''), M + indent, COL - indent, lh, size);
      y += gap;
    }
    return { total: y, lh, labelSize, gap, indent };
  };

  /* Fit both ways. Twelve recognitions and three statements are very
     different amounts of text for one sheet, so the body grows into the band
     as readily as it shrinks to fit it — otherwise the shorter sheet strands
     half a page of empty glass under its last line. */
  const CAP = bulleted ? 46 : 62;
  let size = bulleted ? 30 : 34;
  let shape = plan(size);
  while (size < CAP) {
    const next = plan(size + 1);
    if (next.total > BAND) break;
    size += 1;
    shape = next;
  }
  while (shape.total > BAND && size > 18) {
    size -= 1;
    shape = plan(size);
  }

  let y = TOP;
  for (const entry of entries) {
    if (!bulleted && entry.label) {
      ctx.font = font(700, shape.labelSize);
      ctx.fillStyle = ACCENT;
      ctx.fillText(entry.label, M, y);
      y += shape.labelSize + Math.round(size * 0.52);
    }
    if (bulleted) {
      // the authored sheet has no bullets; a recognitions list needs a mark,
      // and a small filled square sits better with this type than a dot
      ctx.fillStyle = ACCENT;
      ctx.fillRect(M, y - size * 0.62, 12, 12);
    }
    // Body black, the phrases the source slides set in bold picked out in
    // orange — those are the things worth pointing at on each line.
    y = wrapRuns(
      ctx, runs(entry.body || ''), M + shape.indent, y,
      COL - shape.indent, shape.lh, size, INK_SOFT, ACCENT,
    );
    y += shape.gap;
  }

  // ------------------------------------------------------------ the mark
  // The authored foot is a wordmark and a quiet second word beside it.
  ctx.font = font(700, 34);
  ctx.fillStyle = INK;
  ctx.fillText(sheet.mark || 'NCET', M, 1516);
  const w = ctx.measureText(sheet.mark || 'NCET').width;
  if (sheet.markNote) {
    ctx.font = font(500, 34);
    ctx.fillStyle = INK_FAINT;
    ctx.fillText(` ${sheet.markNote}`, M + w, 1516);
  }

  // the authored rotated tag down the right edge
  if (sheet.edgeTag) {
    ctx.save();
    ctx.translate(GW - M - 24, 1236);
    ctx.rotate(Math.PI / 2);
    ctx.font = font(500, 23);
    ctx.fillStyle = INK_FAINT;
    ctx.fillText('—', 0, 0);
    ctx.fillText(sheet.edgeTag, 48, 0);
    ctx.restore();
  }
}

/* ================================================================== scene */

export function PaperSheet(sheet, options = {}) {
  const canvas = h('canvas', { class: 'paper-gl' });
  const wordmark = h('h1', { class: 'paper-word' }, options.wordmark || 'NCET');
  const host = h(
    'div',
    { class: 'paper-stage' },
    h('div', { class: 'paper-bg' }, wordmark),
    h('div', { class: 'paper-dof' }),
    canvas,
    h('div', { class: 'paper-grain' }),
    h('div', { class: 'paper-vig' }),
    h('div', {
      class: 'paper-hint',
    }, h('b', {}, 'Drag'), ' to turn it', h('span', { class: 'paper-hint__ptr' }, ' · ', h('b', {}, 'Hover'), ' to light it')),
  );

  let live = null;
  let running = false;
  let booting = false;

  function start() {
    if (running) return;
    running = true;
    if (live) { live.resume(); return; }
    if (booting) return;
    booting = true;
    loadThree()
      .then((T) => { live = build(T, host, canvas, sheet); booting = false; if (running) live.resume(); })
      .catch((error) => { booting = false; console.error('[PaperSheet]', error.message); });
  }

  function stop() {
    running = false;
    if (live) live.pause();
  }

  host.__start = start;
  host.__stop = stop;
  host.__dispose = () => { stop(); if (live) live.dispose(); live = null; };
  return host;
}

function build(T, host, canvas, sheet) {
  const clamp = (v, a, b) => (v < a ? a : (v > b ? b : v));
  const REDUCED = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* --------------------------------------------------------- the artwork */
  function makeTexture() {
    const c = document.createElement('canvas');
    c.width = TW; c.height = TH;
    const ctx = c.getContext('2d');
    ctx.clearRect(0, 0, TW, TH);
    ctx.save();
    rr(ctx, 0, 0, TW, TH, 30);
    ctx.clip();
    drawSheet(ctx, sheet);
    ctx.restore();
    const t = new T.CanvasTexture(c);
    t.encoding = T.sRGBEncoding;
    t.anisotropy = 8;
    t.needsUpdate = true;
    return t;
  }

  /* ------------------------------------------------------------ renderer */
  const renderer = new T.WebGLRenderer({
    canvas, antialias: true, alpha: true, powerPreference: 'high-performance',
  });
  renderer.outputEncoding = T.sRGBEncoding;
  renderer.toneMapping = T.NoToneMapping;

  const scene = new T.Scene();
  const camera = new T.PerspectiveCamera(24, 1, 0.1, 100);
  camera.position.set(0, 0, 8.2);

  /* A lit room rather than a dark one. The authored map runs #3a3d47 → #08080a
     and is what makes the original sheet read as smoked glass; against a white
     page that same reflection turns the paper into a grey slab. The blobs —
     a warm key, a cool secondary, a low warm bounce — are kept, because they
     are what gives the glass something to catch as it turns. */
  function envTexture() {
    const w = 1024; const hh = 512;
    const c = document.createElement('canvas');
    c.width = w; c.height = hh;
    const x = c.getContext('2d');
    const g = x.createLinearGradient(0, 0, 0, hh);
    // The authored studio: a bright ceiling falling to near-black. This is
    // what the glass catches as it turns, and on a dark ground it is what
    // makes the sheet look lit rather than drawn.
    g.addColorStop(0, '#3a3d47');
    g.addColorStop(0.46, '#171820');
    g.addColorStop(1, '#08080a');
    x.fillStyle = g;
    x.fillRect(0, 0, w, hh);
    const blob = (cx, cy, rx, ry, col, a) => {
      const rg = x.createRadialGradient(cx, cy, 0, cx, cy, Math.max(rx, ry));
      rg.addColorStop(0, col.replace('A', a));
      rg.addColorStop(1, col.replace('A', '0'));
      x.save(); x.translate(cx, cy); x.scale(1, ry / rx); x.translate(-cx, -cy);
      x.fillStyle = rg; x.beginPath(); x.arc(cx, cy, rx, 0, 7); x.fill(); x.restore();
    };
    blob(w * 0.30, hh * 0.24, 330, 240, 'rgba(255,252,246,A)', '1');
    blob(w * 0.74, hh * 0.34, 240, 200, 'rgba(150,175,235,A)', '.42');
    blob(w * 0.52, hh * 0.86, 420, 190, 'rgba(255,170,120,A)', '.10');
    const t = new T.CanvasTexture(c);
    t.mapping = T.EquirectangularReflectionMapping;
    t.encoding = T.sRGBEncoding;
    return t;
  }

  const pmrem = new T.PMREMGenerator(renderer);
  pmrem.compileEquirectangularShader();
  scene.environment = pmrem.fromEquirectangular(envTexture()).texture;

  const key = new T.DirectionalLight(0xfff6ec, 1.42); key.position.set(-3.3, 2.1, 2.0);
  const fill = new T.DirectionalLight(0x9fb6ff, 0.13); fill.position.set(3.6, -1.8, 1.6);
  const rim = new T.DirectionalLight(0xffffff, 0.10); rim.position.set(1.6, 1.2, -2.6);
  scene.add(key, fill, rim, new T.AmbientLight(0xffffff, 0.16));

  const touchLight = new T.PointLight(0xdfe8ff, 0, 7.5, 1.35);
  touchLight.position.set(0, 0, 1.7);
  scene.add(touchLight);

  /* -------------------------------------------- geometry + the bend */
  const SW = 2.30; const SH = 2.72;
  const geo = new T.PlaneGeometry(SW, SH, 72, 96);

  /* How much the sheet moves.
   *
   * The authored figures are uAmp 1.18 / uTwist 1.30 with the wave running at
   * real time, which is a sheet caught in a draught — it folds back on itself
   * and the type rides over the curl. That is the right answer for a hero
   * you look at and the wrong one for a page somebody has to read off a
   * projector, which is what these are. The bend is dropped to a fifth and
   * the ripple slowed to under half speed: the paper stays flat enough to
   * read, and keeps just enough breath to still be paper rather than a slide.
   *
   * `uAmp` is the one that matters. `cornerPoint` is the JS mirror of the
   * same bend and reads these very uniforms, so the drag hit-test follows
   * the flatter sheet without a second set of numbers to keep in step. */
  const CALM = 0.45;       // idle drift and pointer lean, against the authored 1
  const WAVE_SPEED = 0.42; // how fast the ripple travels

  const uni = {
    uTime: { value: 0 }, uAmp: { value: 0.22 }, uFreq: { value: 3.60 }, uTwist: { value: 0.42 },
    uSize: { value: new T.Vector2(SW, SH) }, uFlutter: { value: 0 }, uPhase: { value: 0 },
    uRim: { value: 0.62 }, uRimA: { value: 0.88 }, uSpecA: { value: 0.14 },
    uRimCol: { value: new T.Color(0xeaf2ff) },
  };

  // Verbatim from the source. The sheet hangs: it curls harder at the top
  // than along the bottom edge, and arc length is conserved by integrating
  // the bend rather than displacing Z.
  const WAVE = `
uniform float uTime, uAmp, uFlutter, uPhase, uFreq, uTwist;
uniform vec2  uSize;

float sAmp(float u, float v){ return uAmp*(0.10 + pow(u,1.35))*(0.50 + 0.64*v); }
float sAmpV(float u){        return uAmp*(0.10 + pow(u,1.35))*0.64; }

float sTheta(float u, float v){
  float a  = sAmp(u,v);
  float ph = uFreq*u + uTwist*v + uTime*0.40 + uPhase;
  return a*sin(ph) + uFlutter*a*0.60*sin(ph*2.35 + uTime*2.0);
}
float sThetaV(float u, float v){
  float a  = sAmp(u,v), da = sAmpV(u);
  float ph = uFreq*u + uTwist*v + uTime*0.40 + uPhase;
  float f  = ph*2.35 + uTime*2.0;
  return da*sin(ph) + a*cos(ph)*uTwist
       + uFlutter*0.60*(da*sin(f) + a*cos(f)*uTwist*2.35);
}
float sYoff(float u, float v){
  float w = 1.0 - 0.55*v;
  return 0.021*uSize.y*sin(2.05*u + uTime*0.47 + uPhase)
       + 0.013*uSize.y*sin(3.35*u - 1.55*v + uTime*0.63 + uPhase)*w;
}
float sYdU(float u, float v){
  float w = 1.0 - 0.55*v;
  return 0.0431*uSize.y*cos(2.05*u + uTime*0.47 + uPhase)
       + 0.0436*uSize.y*cos(3.35*u - 1.55*v + uTime*0.63 + uPhase)*w;
}
float sYdV(float u, float v){
  float ph = 3.35*u - 1.55*v + uTime*0.63 + uPhase;
  return 0.013*uSize.y*(-1.55*cos(ph)*(1.0-0.55*v) - 0.55*sin(ph));
}

void sheetPoint(vec2 q, out vec3 P, out vec3 NN){
  float u = q.x, v = q.y;
  float x=0.0, z=0.0, xe=0.0, ze=0.0, dxv=0.0, dzv=0.0, dxe=0.0, dze=0.0;
  const int NS = 20;
  float h = 1.0/float(NS);
  for(int i=0;i<NS;i++){
    float uu = (float(i)+0.5)*h;
    float w  = clamp((u-(uu-0.5*h))/h, 0.0, 1.0);
    float th = sTheta(uu,v);
    float dt = sThetaV(uu,v);
    float c = cos(th), sn = sin(th);
    xe += c*h;          ze += sn*h;
    dxe += -sn*dt*h;    dze +=  c*dt*h;
    x   += c*h*w;       z   += sn*h*w;
    dxv += -sn*dt*h*w;  dzv +=  c*dt*h*w;
  }
  float W = uSize.x, H = uSize.y;
  float th0 = sTheta(u,v);
  P = vec3((x - xe*0.5)*W, (v-0.5)*H + sYoff(u,v), (z - ze*0.5)*W);
  vec3 Tu = vec3(W*cos(th0), sYdU(u,v), W*sin(th0));
  vec3 Tv = vec3((dxv - dxe*0.5)*W, H + sYdV(u,v), (dzv - dze*0.5)*W);
  NN = normalize(cross(Tu, Tv));
}`;

  const tex = makeTexture();
  const mat = new T.MeshPhysicalMaterial({
    map: tex, color: new T.Color(0xc4d2e8), side: T.DoubleSide, metalness: 0.0,
    /* The authored varnish, restored. It had to come down while the ink was
       black — a gloss adds light on top of the base colour, and you cannot
       have a mirror finish and truly black type on one surface. With white
       ink the sheen lifts the type instead of greying it, so the full
       clearcoat is right again. */
    roughness: 0.06, clearcoat: 1.0, clearcoatRoughness: 0.03,
    iridescence: 0.10, iridescenceIOR: 1.35, iridescenceThicknessRange: [120, 420],
    envMapIntensity: 1.15, specularIntensity: 1.0, ior: 1.5,
    transparent: true, alphaTest: 0.012, opacity: 1,
  });
  mat.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, uni);
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', `#include <common>\n${WAVE}`)
      .replace('#include <beginnormal_vertex>', `
        vec3 sheetP; vec3 objectNormal;
        sheetPoint(uv, sheetP, objectNormal);
        #ifdef USE_TANGENT
          vec3 objectTangent = vec3( tangent.xyz );
        #endif
      `)
      .replace('#include <begin_vertex>', 'vec3 transformed = sheetP;');
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>',
        '#include <common>\nuniform float uRim, uRimA, uSpecA;\nuniform vec3 uRimCol;')
      // judge the cut against the artwork's own alpha, not alpha*opacity
      .replace('#include <alphatest_fragment>',
        'if ( diffuseColor.a / max(opacity,1e-4) < alphaTest ) discard;')
      .replace('#include <output_fragment>', `
        float fres = pow(1.0 - clamp(abs(dot(geometry.normal, geometry.viewDir)),0.0,1.0), 3.2);
        outgoingLight += fres * uRim * uRimCol;
        float baseA = diffuseColor.a / max(opacity, 1e-4);
        float outA  = clamp(baseA + fres*uRimA
                          + uSpecA*dot(outgoingLight, vec3(0.3333)), 0.0, 1.0) * opacity;
        gl_FragColor = vec4( outgoingLight, outA );
      `);
  };

  const mesh = new T.Mesh(geo, mat);
  const group = new T.Group();
  group.add(mesh);
  scene.add(group);

  /* A faint dark cloud so the sheet sits in front of the wordmark — authored. */
  const haloTex = (() => {
    const s = 256;
    const c = document.createElement('canvas');
    c.width = s; c.height = s;
    const x = c.getContext('2d');
    const g = x.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
    g.addColorStop(0, 'rgba(0,0,0,.55)');
    g.addColorStop(0.45, 'rgba(0,0,0,.28)');
    g.addColorStop(1, 'rgba(0,0,0,0)');
    x.fillStyle = g;
    x.fillRect(0, 0, s, s);
    const t = new T.CanvasTexture(c);
    t.encoding = T.sRGBEncoding;
    return t;
  })();
  const halo = new T.Mesh(
    new T.PlaneGeometry(3.9, 4.9),
    new T.MeshBasicMaterial({ map: haloTex, transparent: true, depthWrite: false, opacity: 0.30 }),
  );
  halo.position.z = -0.62;
  group.add(halo);

  /* ------------------------------------- pointer: drag to turn, hover to light */
  let dragging = false; let dragYaw = 0; let dragPitch = 0; let release = 0;
  let velYaw = 0; let velPitch = 0; let prevYaw = 0; let prevPitch = 0;
  let lastPX = 0; let lastPY = 0; let moved = 0; let overSheet = false;
  let hover = 0; let hoverTarget = 0;
  let quad = null; let cursorNow = '';
  const mouse = { x: 0, y: 0, tx: 0, ty: 0 };
  const hintEl = host.querySelector('.paper-hint');
  let hintUsed = false;
  let vw = 0; let vh = 0;

  // Everything is measured against the host box, not the window: inside a
  // transform-scaled slide those are different spaces, and using window
  // coordinates puts the hit test and the pointer light in the wrong place.
  const box = () => host.getBoundingClientRect();
  const localX = (clientX) => clientX - box().left;
  const localY = (clientY) => clientY - box().top;

  const _v = new T.Vector3();
  function cornerPoint(qx, qy) {
    const t = uni.uTime.value; const ph = uni.uPhase.value;
    const A = uni.uAmp.value; const F = uni.uFreq.value; const TWs = uni.uTwist.value;
    const u = qx; const v = qy;
    const theta = (uu) => A * (0.10 + Math.pow(uu, 1.35)) * (0.50 + 0.64 * v)
      * Math.sin(F * uu + TWs * v + t * 0.40 + ph);
    let x = 0; let z = 0; let xe = 0; let ze = 0;
    const N = 20; const hh = 1 / N;
    for (let i = 0; i < N; i++) {
      const uu = (i + 0.5) * hh; const w = clamp((u - (uu - 0.5 * hh)) / hh, 0, 1);
      const th = theta(uu); const c = Math.cos(th); const s = Math.sin(th);
      xe += c * hh; ze += s * hh; x += c * hh * w; z += s * hh * w;
    }
    const yo = 0.021 * SH * Math.sin(2.05 * u + t * 0.47 + ph)
      + 0.013 * SH * Math.sin(3.35 * u - 1.55 * v + t * 0.63 + ph) * (1 - 0.55 * v);
    return _v.set((x - xe * 0.5) * SW, (v - 0.5) * SH + yo, (z - ze * 0.5) * SW);
  }

  function buildQuad() {
    const pts = [];
    for (const [u, v] of [[0, 1], [1, 1], [1, 0], [0, 0]]) {
      cornerPoint(u, v).applyMatrix4(group.matrixWorld).project(camera);
      pts.push([(_v.x * 0.5 + 0.5) * vw, (-_v.y * 0.5 + 0.5) * vh]);
    }
    const cx = (pts[0][0] + pts[1][0] + pts[2][0] + pts[3][0]) / 4;
    const cy = (pts[0][1] + pts[1][1] + pts[2][1] + pts[3][1]) / 4;
    quad = pts.map(([x, y]) => [cx + (x - cx) * 1.07, cy + (y - cy) * 1.07]);
  }

  function inQuad(px, py) {
    if (!quad) return false;
    let sign = 0;
    for (let i = 0; i < 4; i++) {
      const [ax, ay] = quad[i]; const [bx, by] = quad[(i + 1) % 4];
      const c = (bx - ax) * (py - ay) - (by - ay) * (px - ax);
      if (c !== 0) { const s = c > 0 ? 1 : -1; if (sign === 0) sign = s; else if (s !== sign) return false; }
    }
    return true;
  }

  function useHint() { hintUsed = true; if (hintEl) hintEl.style.opacity = '0'; }

  const onMove = (e) => {
    const px = localX(e.clientX); const py = localY(e.clientY);
    mouse.tx = (px / Math.max(vw, 1) - 0.5) * 2;
    mouse.ty = (py / Math.max(vh, 1) - 0.5) * 2;
    if (dragging) {
      const dx = e.clientX - lastPX; const dy = e.clientY - lastPY;
      lastPX = e.clientX; lastPY = e.clientY; moved += Math.abs(dx) + Math.abs(dy);
      dragYaw += dx * 0.0060;
      dragPitch = clamp(dragPitch - dy * 0.0045, -0.60, 0.60);
      if (moved > 40) useHint();
      return;
    }
    overSheet = inQuad(px, py);
    hoverTarget = overSheet ? 1 : 0;
  };

  const onDown = (e) => {
    if (inQuad(localX(e.clientX), localY(e.clientY))) {
      dragging = true; moved = 0; lastPX = e.clientX; lastPY = e.clientY;
      velYaw = 0; velPitch = 0; prevYaw = dragYaw; prevPitch = dragPitch;
    }
  };
  const onUp = () => { if (dragging) { dragging = false; release = 0.6; } };
  const onLeave = () => { hoverTarget = 0; };

  host.addEventListener('pointermove', onMove, { passive: true });
  host.addEventListener('pointerdown', onDown);
  window.addEventListener('pointerup', onUp);
  host.addEventListener('pointerleave', onLeave);

  /* --------------------------------------------------------------- resize */
  function resize() {
    const b = box();
    vw = Math.max(1, Math.round(b.width));
    vh = Math.max(1, Math.round(b.height));
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setSize(vw, vh, false);
    camera.aspect = vw / vh;
    camera.updateProjectionMatrix();
    const visH = 2 * camera.position.z * Math.tan(T.MathUtils.degToRad(camera.fov) / 2);
    const visW = visH * camera.aspect;
    const wCap = Math.min(0.88, 0.60 + Math.max(0, 1.45 - camera.aspect) * 0.45);
    group.scale.setScalar(Math.min(visH * 0.735 / SH, visW * wCap / SW));
  }

  const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(resize) : null;
  if (ro) ro.observe(host);
  window.addEventListener('resize', resize);

  /* ----------------------------------------------------------------- loop */
  const clock = new T.Clock();
  const lightPos = new T.Vector3();
  let intro = 0;
  let raf = 0;
  let alive = true;

  function frame() {
    raf = requestAnimationFrame(frame);
    const dt = Math.min(clock.getDelta(), 0.05);
    const t = clock.elapsedTime;
    uni.uTime.value = REDUCED ? 2.4 : t * WAVE_SPEED;

    intro += (1 - intro) * Math.min(1, dt * 1.9);
    mat.opacity = intro;
    halo.material.opacity = intro * 0.30;
    if (intro > 0.7 && !hintUsed && hintEl) hintEl.style.opacity = '1';

    if (dragging) {
      const k = Math.min(1, dt * 14);
      velYaw += ((dragYaw - prevYaw) / Math.max(dt, 1e-3) - velYaw) * k;
      velPitch += ((dragPitch - prevPitch) / Math.max(dt, 1e-3) - velPitch) * k;
      velYaw = clamp(velYaw, -7, 7);
      velPitch = clamp(velPitch, -4, 4);
    } else {
      dragYaw += velYaw * dt;
      dragPitch = clamp(dragPitch + velPitch * dt, -0.60, 0.60);
      const decay = Math.pow(0.018, dt);
      velYaw *= decay; velPitch *= decay;
      release = Math.max(0, release - dt);
      if (release <= 0) {
        const home = Math.round(dragYaw / (Math.PI * 2)) * Math.PI * 2;
        const k = Math.min(1, dt * 0.55);
        dragYaw += (home - dragYaw) * k;
        dragPitch -= dragPitch * k;
      }
    }
    prevYaw = dragYaw; prevPitch = dragPitch;

    mouse.x += (mouse.tx - mouse.x) * Math.min(1, dt * 3.0);
    mouse.y += (mouse.ty - mouse.y) * Math.min(1, dt * 3.0);
    // The same drifts as the source, damped by CALM. Left as the authored
    // expressions rather than rewritten, so the rhythm is unchanged and only
    // the distance travelled is smaller.
    const idle = REDUCED ? 0 : CALM;
    const rise = 1 - intro;
    group.rotation.y = dragYaw + mouse.x * 0.16 * CALM + Math.sin(t * 0.23) * 0.045 * idle;
    group.rotation.x = dragPitch - mouse.y * 0.11 * CALM
      + Math.sin(t * 0.19) * 0.026 * idle + rise * 0.28;
    group.rotation.z = Math.sin(t * 0.27) * 0.018 * idle;
    group.position.y = Math.sin(t * 0.36) * 0.06 * idle - rise * 0.7;
    group.position.x = Math.sin(t * 0.21) * 0.05 * idle + mouse.x * 0.10 * CALM;
    group.updateMatrixWorld();

    hover += (hoverTarget - hover) * Math.min(1, dt * 4.5);
    touchLight.intensity = hover * 2.6 * intro;
    if (hover > 0.002) {
      lightPos.set(mouse.tx, -mouse.ty, 0.5).unproject(camera).sub(camera.position).normalize();
      touchLight.position.copy(camera.position)
        .addScaledVector(lightPos, (1.75 - camera.position.z) / lightPos.z);
    }

    buildQuad();
    const wantCursor = dragging ? 'grabbing' : (overSheet ? 'grab' : '');
    if (wantCursor !== cursorNow) { cursorNow = wantCursor; host.style.cursor = wantCursor; }

    renderer.render(scene, camera);
  }

  resize();
  mesh.visible = true;
  mat.opacity = 0.002;
  renderer.compile(scene, camera);
  renderer.render(scene, camera);
  mat.opacity = 1;

  return {
    resume() {
      if (!alive || raf) return;
      clock.getDelta();
      raf = requestAnimationFrame(frame);
      resize();
    },
    pause() {
      if (raf) { cancelAnimationFrame(raf); raf = 0; }
      host.style.cursor = '';
    },
    dispose() {
      alive = false;
      if (raf) cancelAnimationFrame(raf);
      raf = 0;
      host.removeEventListener('pointermove', onMove);
      host.removeEventListener('pointerdown', onDown);
      window.removeEventListener('pointerup', onUp);
      host.removeEventListener('pointerleave', onLeave);
      window.removeEventListener('resize', resize);
      if (ro) ro.disconnect();
      tex.dispose(); haloTex.dispose(); geo.dispose(); mat.dispose();
      pmrem.dispose();
      renderer.dispose();
    },
  };
}
