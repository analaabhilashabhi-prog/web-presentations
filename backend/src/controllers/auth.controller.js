import * as authService from '../services/auth.service.js';
import { env, SESSION_COOKIE } from '../config/env.js';
import { HttpError, sendJson, parseCookies, setCookie, clearCookie } from '../utils/http.js';

export async function login(req, res, ctx) {
  const { email, password } = ctx.body || {};
  if (!email || !password) throw new HttpError(400, 'Email and password are required');

  const { user, session } = await authService.login(email, password);
  setCookie(res, SESSION_COOKIE, session.token, {
    maxAgeSeconds: env.sessionTtlHours * 3600,
  });
  sendJson(res, 200, { user, expiresAt: session.expiresAt });
}

export async function logout(req, res) {
  const token = parseCookies(req)[SESSION_COOKIE];
  if (token) await authService.logout(token);
  clearCookie(res, SESSION_COOKIE);
  sendJson(res, 200, { ok: true });
}

export function me(req, res, ctx) {
  sendJson(res, 200, { user: ctx.user, loginHint: env.showLoginHint ? hint() : null });
}

function hint() {
  return {
    admin: env.seedUsers.admin.email,
    presenter: env.seedUsers.presenter.email,
    adminPassword: env.seedUsers.admin.password,
    presenterPassword: env.seedUsers.presenter.password,
  };
}
