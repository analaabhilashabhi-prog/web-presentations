import * as orgService from '../services/org.service.js';
import { sendJson } from '../utils/http.js';

export function list(req, res) {
  sendJson(res, 200, { organizations: orgService.list() });
}

export function get(req, res, ctx) {
  sendJson(res, 200, { organization: orgService.get(ctx.params.orgId) });
}

export async function update(req, res, ctx) {
  sendJson(res, 200, { organization: await orgService.update(ctx.params.orgId, ctx.body || {}) });
}

export async function create(req, res, ctx) {
  sendJson(res, 201, { organization: await orgService.create(ctx.body || {}) });
}
