import * as templateModel from '../models/template.model.js';
import { normalizeBlocks, hydrateBlocks } from './section.service.js';
import { HttpError } from '../utils/http.js';
import { newId } from '../utils/id.js';

const text = (value, max = 200) => String(value ?? '').slice(0, max);

/** Resolved media, so a saved template previews exactly like the real thing. */
function publicTemplate(template) {
  return { ...template, blocks: hydrateBlocks(template.blocks) };
}

export function list() {
  return templateModel.all().map(publicTemplate);
}

export async function create(payload = {}, author = null) {
  const name = text(payload.name, 80).trim();
  if (!name) throw new HttpError(400, 'Give the template a name');
  const blocks = normalizeBlocks(payload.blocks);
  if (!blocks.length) throw new HttpError(400, 'A template needs at least one block');

  return publicTemplate(
    await templateModel.insert({
      id: newId('tpl'),
      name,
      description: text(payload.description, 240),
      icon: text(payload.icon, 8) || '◆',
      sourceOrgId: text(payload.orgId, 60) || null,
      createdBy: author?.name || null,
      blocks,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }),
  );
}

export async function update(id, payload = {}) {
  if (!templateModel.byId(id)) throw new HttpError(404, 'Template not found');
  const patch = {};
  if (payload.name !== undefined) {
    const name = text(payload.name, 80).trim();
    if (!name) throw new HttpError(400, 'Template name cannot be empty');
    patch.name = name;
  }
  if (payload.description !== undefined) patch.description = text(payload.description, 240);
  if (payload.blocks !== undefined) patch.blocks = normalizeBlocks(payload.blocks);
  return publicTemplate(await templateModel.update(id, patch));
}

export async function remove(id) {
  if (!templateModel.byId(id)) throw new HttpError(404, 'Template not found');
  await templateModel.remove(id);
  return { id };
}
