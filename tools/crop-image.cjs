/**
 * Crops an image, through headless Chrome's canvas.
 *
 *   node tools/crop-image.cjs --port 9371 --in <src> --out <dst>  *        [--top 0] [--left 0] [--right 0] [--bottom 0] [--max-width 3000] [--quality 0.92]
 *
 * Insets are in source pixels, one per edge, all optional. `--max-width` scales
 * the result down to at most that many pixels wide, after any crop, keeping the
 * aspect ratio exactly — a 9600px banner is forty-six megapixels the browser has
 * to decode to paint a card 1560px wide, and three of them came to 33MB.
 *
 * There is no image library in this project and there is not going to be — it
 * ships no runtime dependencies, and the one tool that already needed to
 * rasterise (normalise-navicons) drives headless Chrome for it. This does the
 * same: the browser decodes the JPEG, a canvas takes the region wanted, and
 * `toDataURL` re-encodes it.
 *
 * Why a crop is ever needed: the deck's rule is that a page's own typography
 * carries its message, so a photograph that arrives as a finished social card —
 * a branded header band, a wordmark, a vignette — is cut back to the photograph
 * inside it. The original is never modified; write the crop to a new name.
 */
const fs = require('fs');
const path = require('path');
const { connect, evaluate } = require('./lib/cdp.cjs');

const arg = (name, fallback = null) => {
  const i = process.argv.indexOf(`--${name}`);
  return i > -1 && process.argv[i + 1] ? process.argv[i + 1] : fallback;
};

const MIME = { '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp' };

(async () => {
  const src = arg('in');
  const dst = arg('out');
  if (!src || !dst) throw new Error('need --in and --out');

  const inset = {
    top: Number(arg('top', 0)) || 0,
    left: Number(arg('left', 0)) || 0,
    right: Number(arg('right', 0)) || 0,
    bottom: Number(arg('bottom', 0)) || 0,
  };
  const quality = Number(arg('quality', 0.92));
  const maxWidth = Number(arg('max-width', 0)) || 0;
  /* The output format follows the output's extension. A logo cut out of a PNG
     has an alpha channel, and re-encoding it as JPEG flattens that to a white
     rectangle — which on the navigation rail's dark green is a sticker, not a
     mark. */
  const outPng = path.extname(dst).toLowerCase() === '.png';
  const outMime = outPng ? 'image/png' : 'image/jpeg';
  const ext = path.extname(src).toLowerCase();
  const buf = fs.readFileSync(src);
  const dataUrl = `data:${MIME[ext] || 'image/jpeg'};base64,${buf.toString('base64')}`;

  const cdp = await connect(Number(arg('port', 9371)));
  await cdp.send('Runtime.enable');

  const out = await evaluate(cdp, `(async () => {
    const img = new Image();
    img.src = ${JSON.stringify(dataUrl)};
    await img.decode();
    const inset = ${JSON.stringify(inset)};
    const sw = img.naturalWidth - inset.left - inset.right;
    const sh = img.naturalHeight - inset.top - inset.bottom;
    if (sw < 1 || sh < 1) return { error: 'insets leave nothing' };
    /* Scaled from the cropped region's own dimensions, so the ratio is carried
       through exactly rather than being rebuilt from two rounded numbers. */
    const max = ${maxWidth};
    const scale = max && sw > max ? max / sw : 1;
    const w = Math.round(sw * scale);
    const h = Math.round(sh * scale);
    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    const ctx = c.getContext('2d');
    /* JPEG cannot carry alpha and encodes an untouched canvas as black, so a
       transparent source needs a white ground painted under it first. A PNG
       keeps the canvas transparent. */
    if (!${JSON.stringify(outPng)}) { ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, w, h); }
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(img, inset.left, inset.top, sw, sh, 0, 0, w, h);
    return {
      w, h,
      from: { w: img.naturalWidth, h: img.naturalHeight },
      ratioDrift: Math.abs((w / h) - (sw / sh)) / (sw / sh),
      dataUrl: c.toDataURL(${JSON.stringify(outMime)}, ${quality}),
    };
  })()`);

  cdp.close();
  if (!out || out.error) throw new Error(out?.error || 'canvas returned nothing');

  const bytes = Buffer.from(out.dataUrl.split(',')[1], 'base64');
  // A canvas that ran out of memory returns a short string rather than throwing,
  // so the file is checked for its own end marker before it is written.
  const tail = bytes.slice(-8).toString('hex');
  const whole = outPng ? tail.includes('49454e44') : tail.endsWith('ffd9');
  if (!whole) throw new Error(`output is not a complete ${outPng ? 'PNG' : 'JPEG'}`);
  fs.writeFileSync(dst, bytes);
  console.log(`  ${out.from.w}x${out.from.h} -> ${out.w}x${out.h}`
    + `  ratio off by ${(out.ratioDrift * 100).toFixed(3)}%`
    + `  ${Math.round(bytes.length / 1024)}kB   ${dst}`);
})().catch((e) => { console.error('  ERROR ' + e.message); process.exitCode = 1; });
