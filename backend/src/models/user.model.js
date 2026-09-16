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
