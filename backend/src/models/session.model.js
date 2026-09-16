import { randomBytes } from 'node:crypto';
import { data, persist } from './db.js';

export async function create(userId, ttlHours) {
  const token = randomBytes(32).toString('hex');
  const session = {
    token,
    userId,
    createdAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + ttlHours * 3600_000).toISOString(),
  };
  data().sessions.push(session);
  await persist();
  return session;
}

export function find(token) {
  if (!token) return null;
  const session = data().sessions.find((item) => item.token === token);
  if (!session) return null;
  if (new Date(session.expiresAt).getTime() < Date.now()) return null;
  return session;
}

export async function remove(token) {
  const store = data();
  const before = store.sessions.length;
  store.sessions = store.sessions.filter((item) => item.token !== token);
  if (store.sessions.length !== before) await persist();
}

export async function purgeExpired() {
  const store = data();
  const now = Date.now();
  const before = store.sessions.length;
  store.sessions = store.sessions.filter(
    (item) => new Date(item.expiresAt).getTime() > now,
  );
  if (store.sessions.length !== before) await persist();
  return before - store.sessions.length;
}
