import { api } from './api.js';
import { readFileAsDataUrl } from '../utils/format.js';

export async function listOrgs() {
  return (await api.get('/orgs')).organizations;
}

export async function updateOrg(orgId, patch) {
  return (await api.patch(`/orgs/${orgId}`, patch)).organization;
}

export async function listSections(orgId) {
  return (await api.get(`/orgs/${orgId}/sections`)).sections;
}

export async function createSection(orgId, payload) {
  return (await api.post(`/orgs/${orgId}/sections`, payload)).section;
}

export async function updateSection(sectionId, patch) {
  return (await api.patch(`/sections/${sectionId}`, patch)).section;
}

export async function deleteSection(sectionId) {
  return api.delete(`/sections/${sectionId}`);
}

export async function duplicateSection(sectionId, payload = {}) {
  return (await api.post(`/sections/${sectionId}/duplicate`, payload)).section;
}

export async function reorderSections(orgId, order) {
  return (await api.post(`/orgs/${orgId}/sections/reorder`, { order })).sections;
}

/** Anything above this goes up as raw bytes instead of base64 JSON. */
const BINARY_THRESHOLD = 6 * 1024 * 1024;

export function mediaCapabilities() {
  return api.get('/assets/capabilities');
}

/**
 * Uploads images and videos. Small files ride the JSON data-URL path; large
 * ones (and all video) stream as raw binary, because base64 inflates a 300MB
 * video past any sane request limit.
 */
export async function uploadFiles(fileList) {
  const files = Array.from(fileList || []);
  if (!files.length) throw new Error('No files selected');

  const assets = [];
  const smallImages = [];

  for (const file of files) {
    const isVideo = file.type.startsWith('video/') || /\.(mp4|webm|mov|avi|mkv|m4v|ogv)$/i.test(file.name);
    if (isVideo || file.size > BINARY_THRESHOLD) {
      assets.push(await api.postBinary(`/assets/binary?name=${encodeURIComponent(file.name)}`, file));
    } else {
      smallImages.push({ name: file.name, dataUrl: await readFileAsDataUrl(file) });
    }
  }

  if (smallImages.length) {
    assets.push(...(await api.post('/assets', { files: smallImages })).assets);
  }
  return assets.flatMap((entry) => (Array.isArray(entry?.assets) ? entry.assets : entry));
}

/** Kept for callers that only ever deal with images. */
export const uploadImages = uploadFiles;
