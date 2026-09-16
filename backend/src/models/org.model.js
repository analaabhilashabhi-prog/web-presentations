import { data, persist } from './db.js';

export function all() {
  return [...data().organizations].sort((a, b) => a.order - b.order);
}

export function byId(id) {
  return data().organizations.find((org) => org.id === id) || null;
}

export async function insert(org) {
  data().organizations.push(org);
  await persist();
  return org;
}

export async function update(id, patch) {
  const org = byId(id);
  if (!org) return null;
  Object.assign(org, patch, { updatedAt: new Date().toISOString() });
  await persist();
  return org;
}
