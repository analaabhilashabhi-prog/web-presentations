/**
 * Writes weight-normalised copies of the navigation artwork.
 *
 *   node tools/normalise-navicons.cjs [--port 9371]
 *
 * Needs the app server on 4173 and a headless Chrome with remote debugging on --port.
 *
 * The supplied files come from several icon sets and are drawn at several weights —
 * measured from 0.44 to 1.40 px of stroke at the 21px the pane renders, a 3.2x spread.
 * That is what makes a column of them look collected rather than drawn. CSS cannot
 * even it out, because for most of them the thickness is the shape and not a
 * stroke-width.
 *
 * Two kinds of file, handled differently:
 *
 *   stroked  (`fill:none; stroke-width:N`) — scale the widths it declares. Exact, and
 *            the only kind that can be made *thinner*.
 *   filled   outlines of strokes — add a stroke. Half lands outside the fill and half
 *            inside, so the visible line grows by one whole stroke-width. Injected as
 *            a `<style>` block with `!important`: several files carry inline styles on
 *            their groups that beat a root attribute.
 *
 * The target is the heaviest of the fourteen in the column. Deliberately not the
 * heaviest of all seventeen — `expand` is drawn at 2.6px, three times the median, and
 * letting it lead made every icon in the pane fat.
 *
 * Weight cannot be read from a file; it has to be measured off a raster. Dilation then
 * shifts that measurement non-linearly as thin gaps close, so this iterates: measure,
 * correct, measure again. Steps are damped because an undamped one overshoots and
 * oscillates.
 *
 * Originals are never modified. Output goes to backend/uploads/navicons-fit/.
 */
const fs = require('fs');
const path = require('path');
const { connect, evaluate, sleep } = require('./lib/cdp.cjs');

const ROOT = path.resolve(__dirname, '..');
const SRC = path.join(ROOT, 'backend/uploads/navicons');
const OUT = path.join(ROOT, 'backend/uploads/navicons-fit');
const PROBE = path.join(ROOT, 'backend/uploads/_navicon-probe.html');
const ORIGIN = 'http://127.0.0.1:4173';

const NAV = 21;      // the size the pane draws at
const RASTER = 240;  // the size we measure at
/* One raster pixel is worth NAV/RASTER = 0.088 nav pixels, so a tolerance below that
   can never be met and the loop only oscillates. */
const TOLERANCE = 0.1;
const ROUNDS = 8;
const DAMP = 0.6;

/** Not sections: the sign-out row and the two states of the pane control. */
const CHROME = ['Signout', 'collapse', 'expand'];

/* The pane control is its own group. Both of its files are filled and both are drawn
   heavier than the column, and a filled shape cannot be thinned by adding a stroke, so
   they cannot join the column. What matters for a control that toggles is that its two
   states match each other, so they normalise among themselves. Signout is not in here:
   it already measures the column weight and sits next to text, where it belongs. */
const PAIR = ['collapse', 'expand'];

const portArg = process.argv.indexOf('--port');
const PORT = portArg > -1 ? Number(process.argv[portArg + 1]) : 9371;

/* Served from the app's own origin on purpose: a cross-origin SVG taints the canvas,
   and then getImageData throws inside the image's onload where nothing catches it. */
const PROBE_PAGE = `<!doctype html><meta charset="utf-8">
<style>html,body{margin:0;background:#fff}</style>
<canvas id="c" width="${RASTER}" height="${RASTER}"></canvas>
<script>
window.weigh = (url) => new Promise((resolve) => {
  const bail = setTimeout(() => resolve({ error: 'timeout' }), 8000);
  const img = new Image();
  img.onload = () => {
    try {
      const N = ${RASTER}, x = document.getElementById('c').getContext('2d');
      x.fillStyle = '#fff'; x.fillRect(0, 0, N, N);
      const s = Math.min(N / img.width, N / img.height);
      x.drawImage(img, (N - img.width * s) / 2, (N - img.height * s) / 2, img.width * s, img.height * s);
      const d = x.getImageData(0, 0, N, N).data;
      const ink = (i) => d[i * 4] < 128;
      const runs = [];
      // Both axes: one alone measures stroke length rather than thickness.
      for (let y = 0; y < N; y++) { let r = 0;
        for (let p = 0; p < N; p++) { if (ink(y * N + p)) r++; else { if (r) runs.push(r); r = 0; } }
        if (r) runs.push(r); }
      for (let p = 0; p < N; p++) { let r = 0;
        for (let y = 0; y < N; y++) { if (ink(y * N + p)) r++; else { if (r) runs.push(r); r = 0; } }
        if (r) runs.push(r); }
      clearTimeout(bail);
      if (!runs.length) return resolve({ error: 'no ink' });
      runs.sort((a, b) => a - b);
      const half = runs.slice(0, Math.max(1, Math.round(runs.length / 2)));
      resolve({ median: half[Math.floor(half.length / 2)] });
    } catch (e) { clearTimeout(bail); resolve({ error: String(e).slice(0, 90) }); }
  };
  img.onerror = () => { clearTimeout(bail); resolve({ error: 'load failed' }); };
  img.src = url + (url.includes('?') ? '&' : '?') + 'v=' + Math.random();
});
</script>`;

const viewWidth = (svg) => {
  const vb = /viewBox\s*=\s*"([^"]+)"/i.exec(svg);
  return vb ? Number(vb[1].trim().split(/[\s,]+/)[2]) : null;
};

const isStroked = (svg) => /stroke-width\s*[:=]/i.test(svg) && /fill\s*:\s*none/i.test(svg);

const scaleStrokes = (svg, k) => svg
  .replace(/stroke-width\s*:\s*([\d.]+)/gi, (_, v) => `stroke-width:${Number((v * k).toFixed(3))}`)
  .replace(/stroke-width\s*=\s*"([\d.]+)"/gi, (_, v) => `stroke-width="${Number((v * k).toFixed(3))}"`);

const dilate = (svg, u) => svg.replace(/(<svg\b[^>]*>)/i, `$1<style>svg *{stroke:#000!important;`
  + `stroke-width:${Number(u.toFixed(3))}!important;stroke-linejoin:round!important;`
  + 'stroke-linecap:round!important;paint-order:stroke!important}</style>');

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  fs.writeFileSync(PROBE, PROBE_PAGE);

  const cdp = await connect(PORT);
  await cdp.send('Runtime.enable');
  await cdp.send('Page.enable');
  await cdp.send('Page.navigate', { url: `${ORIGIN}/uploads/_navicon-probe.html` });
  await sleep(1600);

  const weigh = async (file) => {
    const rel = `/uploads/navicons-fit/${encodeURIComponent(file)}`;
    const r = await evaluate(cdp, `window.weigh(${JSON.stringify(rel)})`);
    if (!r || r.error) throw new Error(`measuring ${file}: ${r && r.error}`);
    return Number(((r.median / RASTER) * NAV).toFixed(3));
  };

  const state = [];
  for (const file of fs.readdirSync(SRC).filter((f) => f.endsWith('.svg'))) {
    const src = fs.readFileSync(path.join(SRC, file), 'utf8');
    const vw = viewWidth(src);
    if (!vw) { console.log(`  skip ${file} — no viewBox`); continue; }
    fs.copyFileSync(path.join(SRC, file), path.join(OUT, file));
    const was = await weigh(file);
    state.push({
      file, name: file.replace('.svg', ''), vw, src, was, now: was,
      stroked: isStroked(src), amount: 0,
    });
  }

  const column = state.filter((s) => !PAIR.includes(s.name));
  const target = Math.max(...column.map((s) => s.was));
  const pair = state.filter((s) => PAIR.includes(s.name));
  const pairTarget = pair.length ? Math.max(...pair.map((s) => s.was)) : target;
  const aim = (s) => (PAIR.includes(s.name) ? pairTarget : target);
  console.log(`  ${state.length} files. Target ${target}px at ${NAV}px`
    + ' — the heaviest of the fourteen in the column.\n');
  console.log('  glyph                          kind      was');
  for (const s of state.slice().sort((a, b) => a.was - b.was)) {
    console.log(`  ${s.name.padEnd(30)} ${s.stroked ? 'stroked' : 'filled '}  ${String(s.was).padStart(6)}px`);
  }

  for (let round = 1; round <= ROUNDS; round += 1) {
    // A filled glyph already at or over target cannot be thinned; leave it be.
    const off = state.filter((s) => (s.stroked
      ? Math.abs(s.now - aim(s)) > TOLERANCE
      : aim(s) - s.now > TOLERANCE));
    if (!off.length) { console.log(`\n  settled after ${round - 1} round(s)`); break; }
    console.log(`\n  round ${round}: correcting ${off.length}`);
    for (const s of off) {
      if (s.stroked) {
        s.amount = (s.amount || 1) * (1 + ((aim(s) / s.now) - 1) * DAMP);
        fs.writeFileSync(path.join(OUT, s.file), scaleStrokes(s.src, s.amount));
      } else {
        s.amount = Math.max(0, s.amount + ((aim(s) - s.now) * DAMP * s.vw) / NAV);
        fs.writeFileSync(path.join(OUT, s.file), s.amount > 0.001 ? dilate(s.src, s.amount) : s.src);
      }
      const before = s.now;
      s.now = await weigh(s.file);
      console.log(`    ${s.name.padEnd(30)} ${String(before).padStart(6)} -> ${String(s.now).padStart(6)}px`
        + `   ${s.stroked ? 'x' : '+'}${Number(s.amount.toFixed(2))}`);
    }
  }

  const done = state.slice().sort((a, b) => a.now - b.now);
  console.log('\n  final:');
  for (const s of done) {
    const ok = Math.abs(s.now - aim(s)) <= TOLERANCE;
    console.log(`  ${s.name.padEnd(30)} ${String(s.now).padStart(6)}px  ${ok ? 'ok' : 'off target'}`);
  }
  const col = done.filter((s) => !PAIR.includes(s.name)).map((s) => s.now);
  console.log(`\n  the fourteen: ${col[0]} to ${col[col.length - 1]}px`
    + `   spread ${Number((col[col.length - 1] / col[0]).toFixed(2))}x`
    + `   (was ${Number((target / Math.min(...column.map((s) => s.was))).toFixed(2))}x)`);
  console.log(`  pane control, matched to each other at ${pairTarget}px: `
    + done.filter((s) => PAIR.includes(s.name)).map((s) => `${s.name} ${s.now}px`).join(', '));
  console.log('  chrome: ' + done.filter((s) => CHROME.includes(s.name))
    .map((s) => `${s.name} ${s.now}px`).join(', '));

  fs.unlinkSync(PROBE);
  cdp.close();
})().catch((e) => {
  console.error('  ERROR ' + e.message);
  try { fs.unlinkSync(PROBE); } catch { /* already gone */ }
  process.exitCode = 1;
});
