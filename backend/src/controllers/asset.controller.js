import * as assetService from '../services/asset.service.js';
import { env } from '../config/env.js';
import { HttpError, sendJson } from '../utils/http.js';

export function list(req, res) {
  sendJson(res, 200, { assets: assetService.list(), capabilities: assetService.capabilities() });
}

export function capabilities(req, res) {
  sendJson(res, 200, assetService.capabilities());
}

/** JSON upload: one or more base64 data URLs. Used for images. */
export async function upload(req, res, ctx) {
  const files = Array.isArray(ctx.body?.files) ? ctx.body.files : [ctx.body];
  if (!files.length) throw new HttpError(400, 'No files in request');

  const assets = [];
  for (const file of files.slice(0, 30)) {
    assets.push(await assetService.saveDataUrl({ name: file?.name, dataUrl: file?.dataUrl }));
  }
  sendJson(res, 201, { assets });
}

/**
 * Raw binary upload, streamed to memory then disk. Videos are far too large to
 * base64-encode, so the client posts the file bytes with the name in the query.
 */
export async function uploadBinary(req, res, ctx) {
  const name = ctx.query.get('name') || 'upload';
  const declaredType = req.headers['x-file-type'] || req.headers['content-type'] || '';
  const limit = env.maxVideoBytes;

  const bytes = await new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    req.on('data', (chunk) => {
      size += chunk.length;
      if (size > limit) {
        reject(new HttpError(413, `File is larger than ${Math.round(limit / 1024 / 1024)}MB`));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });

  const asset = await assetService.ingest({ name, mime: declaredType, bytes });
  sendJson(res, 201, { assets: [asset] });
}
