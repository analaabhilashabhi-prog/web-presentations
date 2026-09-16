/**
 * The only place fetch() is called. Components and pages import the feature
 * services next to this file instead of talking to the network directly.
 */
const BASE = '/api';

export class ApiError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

async function request(path, { method = 'GET', body } = {}) {
  let response;
  try {
    response = await fetch(`${BASE}${path}`, {
      method,
      credentials: 'same-origin',
      headers: body ? { 'Content-Type': 'application/json' } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new ApiError(0, 'Cannot reach the server. Is it still running?');
  }

  if (response.status === 204) return null;

  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    throw new ApiError(response.status, payload?.error || `Request failed (${response.status})`);
  }
  return payload;
}

/** Raw binary upload — used for video and large images. */
async function postBinary(path, file) {
  let response;
  try {
    response = await fetch(`${BASE}${path}`, {
      method: 'POST',
      credentials: 'same-origin',
      headers: {
        'Content-Type': 'application/octet-stream',
        'X-File-Type': file.type || 'application/octet-stream',
      },
      body: file,
    });
  } catch {
    throw new ApiError(0, 'Upload failed — the server may have stopped');
  }
  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    throw new ApiError(response.status, payload?.error || `Upload failed (${response.status})`);
  }
  return payload;
}

export const api = {
  get: (path) => request(path),
  post: (path, body) => request(path, { method: 'POST', body }),
  patch: (path, body) => request(path, { method: 'PATCH', body }),
  delete: (path) => request(path, { method: 'DELETE' }),
  postBinary,
};
