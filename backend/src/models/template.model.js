import { data, persist } from './db.js';

/** Saved section templates. Shared across organizations on purpose — a layout
 *  worth keeping is usually worth reusing on the other deck too. */
export function all() {
  return [...(data().templates || [])].sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
}

export function byId(id) {
  return (data().templates || []).find((template) => template.id === id) || null;
}

export async function insert(template) {
  const store = data();
  if (!Array.isArray(store.templates)) store.templates = [];
  store.templates.push(template);
  await persist();
  return template;
}

export async function update(id, patch) {
  const template = byId(id);
  if (!template) return null;
  Object.assign(template, patch, { updatedAt: new Date().toISOString() });
  await persist();
  return template;
}

export async function remove(id) {
  const store = data();
  const before = (store.templates || []).length;
  store.templates = (store.templates || []).filter((template) => template.id !== id);
  const removed = (store.templates || []).length !== before;
  if (removed) await persist();
  return removed;
}
