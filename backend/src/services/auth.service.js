import { scryptSync, randomBytes, timingSafeEqual } from 'node:crypto';
import * as userModel from '../models/user.model.js';
import * as sessionModel from '../models/session.model.js';
import { env } from '../config/env.js';
import { HttpError } from '../utils/http.js';
import { logger } from '../utils/logger.js';

const KEY_LENGTH = 64;

export function hashPassword(password) {
  const salt = randomBytes(16).toString('hex');
  const key = scryptSync(password, salt, KEY_LENGTH).toString('hex');
  return `scrypt$${salt}$${key}`;
}

export function verifyPassword(password, stored) {
  const [scheme, salt, key] = String(stored || '').split('$');
  if (scheme !== 'scrypt' || !salt || !key) return false;
  const expected = Buffer.from(key, 'hex');
  const actual = scryptSync(password, salt, KEY_LENGTH);
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

export function publicUser(user) {
  if (!user) return null;
  return { id: user.id, email: user.email, name: user.name, role: user.role };
}

export async function login(email, password) {
  const user = userModel.findByEmail(email);
  // Same message either way so the form cannot be used to enumerate accounts.
  const invalid = new HttpError(401, 'Email or password is incorrect');
  if (!user) {
    // Spend the same work as a real check to keep timing uninformative.
    verifyPassword(String(password || ''), hashPassword('placeholder'));
    throw invalid;
  }
  if (!verifyPassword(String(password || ''), user.passwordHash)) throw invalid;

  const session = await sessionModel.create(user.id, env.sessionTtlHours);
  return { user: publicUser(user), session };
}

export async function logout(token) {
  await sessionModel.remove(token);
}

export function userForToken(token) {
  const session = sessionModel.find(token);
  if (!session) return null;
  return publicUser(userModel.findById(session.userId));
}

export async function ensureSeedUsers() {
  const wanted = [
    { ...env.seedUsers.admin, role: 'admin' },
    { ...env.seedUsers.presenter, role: 'presenter' },
  ];
  for (const candidate of wanted) {
    if (userModel.findByEmail(candidate.email)) continue;
    await userModel.insert({
      email: candidate.email,
      name: candidate.name,
      role: candidate.role,
      passwordHash: hashPassword(candidate.password),
    });
    logger.info(`seeded ${candidate.role} account: ${candidate.email}`);
  }
}
