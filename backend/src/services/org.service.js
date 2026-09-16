import * as orgModel from '../models/org.model.js';
import * as assetService from './asset.service.js';
import { themeFor, fontFor, sanitizeThemeOverride, NEUTRALS, FONTS } from '../config/themes.js';
import { HttpError } from '../utils/http.js';
import { slugify } from '../utils/id.js';

export function publicOrg(org) {
  return {
    id: org.id,
    name: org.name,
    shortName: org.shortName,
    tagline: org.tagline,
    theme: themeFor(org.id, org.themeOverride),
    font: fontFor(org.fontId),
    fontChoices: Object.values(FONTS).map(({ id, label }) => ({ id, label })),
    neutrals: NEUTRALS,
    logo: org.logoAssetId ? assetService.resolveMany([org.logoAssetId])[0] || null : null,
    logoAssetId: org.logoAssetId || null,
    // The square mark the collapsed navigation rail shows: a wordmark is
    // unreadable at 44px, so brands supply both.
    mark: org.markAssetId ? assetService.resolveMany([org.markAssetId])[0] || null : null,
    markAssetId: org.markAssetId || null,
    updatedAt: org.updatedAt || null,
  };
}

export function list() {
  return orgModel.all().map(publicOrg);
}

export function get(id) {
  const org = orgModel.byId(id);
  if (!org) throw new HttpError(404, 'Organization not found');
  return publicOrg(org);
}

/**
 * Adds an organization. There was no way to do this but the seeder, which is
 * how the deck stayed at two for as long as it did.
 *
 * The id is the slug of the name unless one is given, and it doubles as the key
 * into the palette table — an org with no palette of its own falls back to
 * Torii's, so add one to `config/themes.js` alongside. No logo or mark is
 * required: the pane sets the name in type and the rail shows an initial until
 * the artwork is supplied, which is the same fallback a deleted asset gets.
 */
export async function create(payload = {}) {
  const name = String(payload.name || '').slice(0, 80).trim();
  if (!name) throw new HttpError(400, 'Organization name cannot be empty');
  const id = slugify(payload.id || name, '');
  if (!id) throw new HttpError(400, 'Organization id cannot be empty');
  if (orgModel.byId(id)) throw new HttpError(409, `Organization "${id}" already exists`);

  const all = orgModel.all();
  const org = await orgModel.insert({
    id,
    name,
    shortName: String(payload.shortName || name).slice(0, 24),
    tagline: String(payload.tagline || '').slice(0, 160),
    logoAssetId: payload.logoAssetId || null,
    markAssetId: payload.markAssetId || null,
    founded: String(payload.founded || '').slice(0, 12),
    hq: String(payload.hq || '').slice(0, 80),
    order: all.length ? Math.max(...all.map((o) => o.order ?? 0)) + 1 : 0,
    themeOverride: payload.theme ? sanitizeThemeOverride(payload.theme) : null,
    fontId: payload.fontId && FONTS[payload.fontId] ? payload.fontId : null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });
  return publicOrg(org);
}

export async function update(id, payload = {}) {
  const org = orgModel.byId(id);
  if (!org) throw new HttpError(404, 'Organization not found');

  const patch = {};
  if (payload.name !== undefined) {
    const name = String(payload.name).slice(0, 80).trim();
    if (!name) throw new HttpError(400, 'Organization name cannot be empty');
    patch.name = name;
  }
  if (payload.shortName !== undefined) patch.shortName = String(payload.shortName).slice(0, 24);
  if (payload.tagline !== undefined) patch.tagline = String(payload.tagline).slice(0, 160);
  if (payload.logoAssetId !== undefined) patch.logoAssetId = payload.logoAssetId || null;
  if (payload.markAssetId !== undefined) patch.markAssetId = payload.markAssetId || null;
  /* Where the organization sits in the pane's switcher and on the sign-in page.
     The seeder fixed it at Torii first, Technical Hub second; with a third deck
     and NGI as the one the room is shown first, it has to be settable. */
  if (payload.order !== undefined) {
    const n = Math.round(Number(payload.order));
    if (!Number.isFinite(n) || n < 0) throw new HttpError(400, 'Organization order must be a non-negative number');
    patch.order = n;
  }

  // `theme: null` resets to the approved brand palette; a partial object
  // overrides only the colours it names.
  if (payload.theme !== undefined) {
    patch.themeOverride = payload.theme === null ? null : sanitizeThemeOverride(payload.theme);
  }
  if (payload.fontId !== undefined) {
    if (payload.fontId && !FONTS[payload.fontId]) throw new HttpError(400, 'Unknown font choice');
    patch.fontId = payload.fontId || null;
  }

  return publicOrg(await orgModel.update(id, patch));
}
