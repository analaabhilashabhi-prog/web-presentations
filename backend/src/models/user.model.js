import { data, persist } from './db.js';
import { newId } from '../utils/id.js';

export function all() {
  return data().users;
}

export function findByEmail(email) {
  const needle = String(email || '').trim().toLowerCase();
  return data().users.find((user) => user.email.toLowerCase() === needle) || null;
}

export function findById(id) {
  return data().users.find((user) => user.id === id) || null;
}

/** Renames an account in place. The id is what sessions and every other
    reference are keyed on, so changing the address signs nobody out. */
export async function setEmail(id, email) {
  const user = findById(id);
  if (!user) return null;
  user.email = email;
  user.updatedAt = new Date().toISOString();
  await persist();
  return user;
}

/** Rotates a password in place. The account keeps its id, so live sessions and
    anything referencing the user survive the change. */
export async function setPassword(id, passwordHash) {
  const user = findById(id);
  if (!user) return null;
  user.passwordHash = passwordHash;
  user.updatedAt = new Date().toISOString();
  await persist();
  return user;
}

export async function insert({ email, name, role, passwordHash }) {
  const user = {
    id: newId('usr'),
    email,
    name,
    role,
    passwordHash,
    createdAt: new Date().toISOString(),
  };
  data().users.push(user);
  await persist();
  return user;
}
