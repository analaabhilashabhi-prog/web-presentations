import * as sectionService from '../services/section.service.js';
import { sendJson } from '../utils/http.js';

export function listByOrg(req, res, ctx) {
  const sections = sectionService.listForRole(ctx.params.orgId, ctx.user?.role || 'presenter');
  sendJson(res, 200, { sections });
}

export function get(req, res, ctx) {
  sendJson(res, 200, {
    section: sectionService.get(ctx.params.sectionId, ctx.user?.role || 'presenter'),
  });
}

export async function create(req, res, ctx) {
  sendJson(res, 201, { section: await sectionService.create(ctx.params.orgId, ctx.body || {}) });
}

export async function update(req, res, ctx) {
  sendJson(res, 200, { section: await sectionService.update(ctx.params.sectionId, ctx.body || {}) });
}

export async function duplicate(req, res, ctx) {
  const section = await sectionService.duplicate(ctx.params.sectionId, ctx.body || {});
  sendJson(res, 201, { section });
}

export async function remove(req, res, ctx) {
  sendJson(res, 200, await sectionService.remove(ctx.params.sectionId));
}

export async function reorder(req, res, ctx) {
  const sections = await sectionService.reorder(ctx.params.orgId, ctx.body?.order);
  sendJson(res, 200, { sections });
}
