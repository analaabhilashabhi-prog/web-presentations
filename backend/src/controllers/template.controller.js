import * as templateService from '../services/template.service.js';
import { sendJson } from '../utils/http.js';

export function list(req, res) {
  sendJson(res, 200, { templates: templateService.list() });
}

export async function create(req, res, ctx) {
  sendJson(res, 201, { template: await templateService.create(ctx.body || {}, ctx.user) });
}

export async function update(req, res, ctx) {
  sendJson(res, 200, { template: await templateService.update(ctx.params.templateId, ctx.body || {}) });
}

export async function remove(req, res, ctx) {
  sendJson(res, 200, await templateService.remove(ctx.params.templateId));
}
