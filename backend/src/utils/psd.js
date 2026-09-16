import zlib from 'node:zlib';

/**
 * Reads the flattened composite image out of a PSD/PSB file.
 *
 * Photoshop always writes a merged composite at the end of the file for
 * compatibility, which is exactly what a web preview needs — so we skip the
 * layer records entirely and decode that. Supports 8/16-bit depth, grayscale,
 * RGB and CMYK colour modes, and raw / RLE / ZIP compression.
 */
const COLOR_MODE = { GRAYSCALE: 1, INDEXED: 2, RGB: 3, CMYK: 4 };

export function isPsd(buffer) {
  return buffer.length > 26 && buffer.toString('ascii', 0, 4) === '8BPS';
}

function decodeRle(buffer, offset, counts, bytesPerRow, rows) {
  const out = Buffer.alloc(bytesPerRow * rows);
  let cursor = offset;
  let written = 0;

  for (let row = 0; row < rows; row += 1) {
    const end = cursor + counts[row];
    let rowWritten = 0;
    while (cursor < end && rowWritten < bytesPerRow) {
      const header = buffer.readInt8(cursor);
      cursor += 1;
      if (header >= 0) {
        const runLength = header + 1;
        buffer.copy(out, written + rowWritten, cursor, cursor + runLength);
        cursor += runLength;
        rowWritten += runLength;
      } else {
        const runLength = 1 - header;
        out.fill(buffer[cursor], written + rowWritten, written + rowWritten + runLength);
        cursor += 1;
        rowWritten += runLength;
      }
    }
    cursor = end;
    written += bytesPerRow;
  }
  return out;
}

/** ZIP with prediction stores per-row deltas. */
function undoPrediction(plane, width, height, bytesPerSample) {
  if (bytesPerSample !== 1) return plane; // 16-bit prediction is rare; leave as-is
  for (let row = 0; row < height; row += 1) {
    const base = row * width;
    for (let col = 1; col < width; col += 1) {
      plane[base + col] = (plane[base + col] + plane[base + col - 1]) & 0xff;
    }
  }
  return plane;
}

export function decodePsdComposite(buffer) {
  if (!isPsd(buffer)) throw new Error('Not a PSD file');

  const version = buffer.readUInt16BE(4);
  if (version !== 1 && version !== 2) throw new Error(`Unsupported PSD version ${version}`);
  const isPsb = version === 2;

  const channelCount = buffer.readUInt16BE(12);
  const height = buffer.readUInt32BE(14);
  const width = buffer.readUInt32BE(18);
  const depth = buffer.readUInt16BE(22);
  const colorMode = buffer.readUInt16BE(24);

  if (![8, 16].includes(depth)) throw new Error(`Unsupported PSD bit depth ${depth}`);
  if (![COLOR_MODE.GRAYSCALE, COLOR_MODE.RGB, COLOR_MODE.CMYK].includes(colorMode)) {
    throw new Error(`Unsupported PSD colour mode ${colorMode}`);
  }
  if (!width || !height) throw new Error('PSD reports zero dimensions');

  // Skip the three variable-length sections before the composite.
  let cursor = 26;
  cursor += 4 + buffer.readUInt32BE(cursor); // colour mode data
  cursor += 4 + buffer.readUInt32BE(cursor); // image resources
  if (isPsb) {
    const hi = buffer.readUInt32BE(cursor);
    const lo = buffer.readUInt32BE(cursor + 4);
    cursor += 8 + hi * 2 ** 32 + lo; // layer & mask info (64-bit length)
  } else {
    cursor += 4 + buffer.readUInt32BE(cursor);
  }

  const compression = buffer.readUInt16BE(cursor);
  cursor += 2;

  const bytesPerSample = depth / 8;
  const bytesPerRow = width * bytesPerSample;
  const planeSize = bytesPerRow * height;
  const planes = [];

  if (compression === 0) {
    for (let c = 0; c < channelCount; c += 1) {
      planes.push(buffer.subarray(cursor + c * planeSize, cursor + (c + 1) * planeSize));
    }
  } else if (compression === 1) {
    const countBytes = isPsb ? 4 : 2;
    const totalRows = channelCount * height;
    const counts = [];
    for (let i = 0; i < totalRows; i += 1) {
      counts.push(isPsb ? buffer.readUInt32BE(cursor + i * 4) : buffer.readUInt16BE(cursor + i * 2));
    }
    let dataOffset = cursor + totalRows * countBytes;
    for (let c = 0; c < channelCount; c += 1) {
      const rowCounts = counts.slice(c * height, (c + 1) * height);
      planes.push(decodeRle(buffer, dataOffset, rowCounts, bytesPerRow, height));
      dataOffset += rowCounts.reduce((sum, n) => sum + n, 0);
    }
  } else if (compression === 2 || compression === 3) {
    const inflated = zlib.inflateSync(buffer.subarray(cursor));
    for (let c = 0; c < channelCount; c += 1) {
      let plane = Buffer.from(inflated.subarray(c * planeSize, (c + 1) * planeSize));
      if (compression === 3) plane = undoPrediction(plane, width, height, bytesPerSample);
      planes.push(plane);
    }
  } else {
    throw new Error(`Unsupported PSD compression ${compression}`);
  }

  // 16-bit samples are reduced to their high byte — plenty for a preview.
  const sample = (plane, index) =>
    bytesPerSample === 1 ? plane[index] : plane[index * 2];

  const colorChannels =
    colorMode === COLOR_MODE.GRAYSCALE ? 1 : colorMode === COLOR_MODE.CMYK ? 4 : 3;
  const hasAlpha = planes.length > colorChannels;
  const outChannels = hasAlpha ? 4 : 3;
  const out = Buffer.alloc(width * height * outChannels);

  for (let i = 0; i < width * height; i += 1) {
    let r;
    let g;
    let b;
    if (colorMode === COLOR_MODE.GRAYSCALE) {
      r = sample(planes[0], i);
      g = r;
      b = r;
    } else if (colorMode === COLOR_MODE.RGB) {
      r = sample(planes[0], i);
      g = sample(planes[1], i);
      b = sample(planes[2], i);
    } else {
      // Photoshop stores CMYK inverted: 0 means full ink.
      const c = 255 - sample(planes[0], i);
      const m = 255 - sample(planes[1], i);
      const y = 255 - sample(planes[2], i);
      const k = 255 - sample(planes[3], i);
      r = Math.round(((255 - c) * (255 - k)) / 255);
      g = Math.round(((255 - m) * (255 - k)) / 255);
      b = Math.round(((255 - y) * (255 - k)) / 255);
    }

    const at = i * outChannels;
    out[at] = r;
    out[at + 1] = g;
    out[at + 2] = b;
    if (hasAlpha) out[at + 3] = sample(planes[colorChannels], i);
  }

  return { width, height, channels: outChannels, data: out, depth, colorMode };
}
