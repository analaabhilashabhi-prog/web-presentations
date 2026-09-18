/**
 * Moves an MP4's `moov` index in front of its media, so a browser can start
 * playing before it has the whole file.
 *
 *   node tools/faststart.cjs <in.mp4> <out.mp4>
 *
 * WHY THIS EXISTS. There is no ffmpeg here and there is not going to be — the
 * same reason `crop-image.cjs` does its work through a canvas. An MP4 written by
 * most screen recorders puts `moov` last, and a browser cannot play a frame of
 * it until that index has arrived: on a 69MB recording served from a room with
 * no network that is a stall with nothing on the screen. This is the one
 * rearrangement that fixes it, and it is pure bookkeeping — not a re-encode, so
 * not a single pixel changes.
 *
 * HOW. The file is a flat list of atoms: `[size:4][type:4][payload]`. Moving
 * `moov` before `mdat` shifts every byte of the media down by `moov`'s length,
 * so every absolute chunk offset inside `moov` has to grow by the same amount.
 * Those offsets live in `stco` (32-bit) and `co64` (64-bit), one per track,
 * nested several boxes deep — hence the recursive walk over the container types
 * below. Everything else in `moov` is relative and is copied untouched.
 *
 * Two guards worth knowing:
 *   - A 32-bit `stco` that would overflow past 4GB after the shift is refused
 *     rather than silently wrapped. Rewriting it as `co64` changes the atom's
 *     size, which changes the shift, which changes the offsets — a fixed point
 *     this does not try to solve for a file that large.
 *   - A file whose `moov` is already first is left alone and reported, so this
 *     is safe to run twice.
 */
const fs = require('fs');

/* Boxes that hold other boxes. Anything not here is a leaf and is skipped. */
const CONTAINERS = new Set(['moov', 'trak', 'mdia', 'minf', 'stbl', 'edts', 'udta']);

/** The top-level atoms, in file order. */
function topLevel(buf) {
  const out = [];
  let off = 0;
  while (off + 8 <= buf.length) {
    let size = buf.readUInt32BE(off);
    const type = buf.toString('ascii', off + 4, off + 8);
    let header = 8;
    if (size === 1) {                    // 64-bit size
      size = Number(buf.readBigUInt64BE(off + 8));
      header = 16;
    } else if (size === 0) {             // to end of file
      size = buf.length - off;
    }
    if (size < header) throw new Error(`atom "${type}" at ${off} has size ${size}`);
    out.push({ type, start: off, size });
    off += size;
  }
  return out;
}

/** Adds `delta` to every chunk offset inside a `moov` buffer, in place. */
function shiftChunkOffsets(moov, delta) {
  let patched = 0;
  const walk = (start, end) => {
    let off = start;
    while (off + 8 <= end) {
      const size = moov.readUInt32BE(off);
      const type = moov.toString('ascii', off + 4, off + 8);
      if (size < 8) return;              // malformed or a terminator
      const body = off + 8;
      if (type === 'stco') {
        const n = moov.readUInt32BE(body + 4);
        for (let i = 0; i < n; i++) {
          const at = body + 8 + i * 4;
          const was = moov.readUInt32BE(at);
          const now = was + delta;
          if (now > 0xFFFFFFFF) throw new Error('a 32-bit chunk offset would overflow; this file needs co64');
          moov.writeUInt32BE(now, at);
        }
        patched += n;
      } else if (type === 'co64') {
        const n = moov.readUInt32BE(body + 4);
        for (let i = 0; i < n; i++) {
          const at = body + 8 + i * 8;
          moov.writeBigUInt64BE(moov.readBigUInt64BE(at) + BigInt(delta), at);
        }
        patched += n;
      } else if (CONTAINERS.has(type)) {
        walk(body, off + size);
      }
      off += size;
    }
  };
  walk(8, moov.length);                  // past moov's own header
  return patched;
}

const [, , IN, OUT] = process.argv;
if (!IN || !OUT) {
  console.error('  usage: node tools/faststart.cjs <in.mp4> <out.mp4>');
  process.exit(1);
}

const buf = fs.readFileSync(IN);
const atoms = topLevel(buf);
console.log(`  atoms: ${atoms.map((a) => a.type).join(' ')}`);

const moovAt = atoms.findIndex((a) => a.type === 'moov');
const mdatAt = atoms.findIndex((a) => a.type === 'mdat');
if (moovAt < 0 || mdatAt < 0) throw new Error('not an MP4 with both moov and mdat');
if (moovAt < mdatAt) {
  console.log('  moov is already ahead of mdat — nothing to do');
  if (IN !== OUT) fs.copyFileSync(IN, OUT);
  process.exit(0);
}

const moov = Buffer.from(buf.subarray(atoms[moovAt].start, atoms[moovAt].start + atoms[moovAt].size));
const patched = shiftChunkOffsets(moov, moov.length);
console.log(`  moov ${(moov.length / 1024).toFixed(0)}kB, ${patched} chunk offsets shifted by ${moov.length}`);

/* Everything except moov, in its original order, with moov put back in front of
   the first mdat. */
const rest = atoms.filter((_, i) => i !== moovAt);
const parts = [];
for (const a of rest) {
  if (a.type === 'mdat' && !parts.includes(moov)) parts.push(moov);
  parts.push(buf.subarray(a.start, a.start + a.size));
}
fs.writeFileSync(OUT, Buffer.concat(parts));

const check = topLevel(fs.readFileSync(OUT)).map((a) => a.type);
console.log(`  wrote ${OUT}`);
console.log(`  atoms now: ${check.join(' ')}`);
console.log(`  fast-start: ${check.indexOf('moov') < check.indexOf('mdat') ? 'yes' : 'NO'}`);
