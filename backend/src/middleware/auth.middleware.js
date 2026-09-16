import * as authService from '../services/auth.service.js';
import { SESSION_COOKIE } from '../config/env.js';
import { HttpError, parseCookies } from '../utils/http.js';

export function resolveUser(req) {
  const token = parseCookies(req)[SESSION_COOKIE];
  return authService.userForToken(token);
}

/** Route-level gate: 'none' is public, 'any' needs a session, 'admin' needs the admin role. */
export function enforce(auth, user) {
  if (auth === 'none') return;
  if (!user) throw new HttpError(401, 'Please sign in to continue');
  if (auth === 'admin' && user.role !== 'admin') {
    throw new HttpError(403, 'This action is available to admins only');
  }
}
