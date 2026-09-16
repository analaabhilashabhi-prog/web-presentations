import { data, persist } from './db.js';

export function byOrg(orgId) {
  return data()
    .sections.filter((section) => section.orgId === orgId)
    .sort((a, b) => a.order - b.order);
}

export function byId(id) {
  return data().sections.find((section) => section.id === id) || null;
}

export function nextOrder(orgId) {
  const rows = byOrg(orgId);
  return rows.length ? rows[rows.length - 1].order + 1 : 0;
}

export async function insert(section) {
  data().sections.push(section);
  await persist();
  return section;
}

export async function update(id, patch) {
  const section = byId(id);
  if (!section) return null;
  Object.assign(section, patch, { updatedAt: new Date().toISOString() });
  await persist();
  return section;
}

export async function remove(id) {
  const store = data();
  const before = store.sections.length;
  store.sections = store.sections.filter((section) => section.id !== id);
  const removed = store.sections.length !== before;
  if (removed) await persist();
  return removed;
}

export async function applyOrder(orgId, orderedIds) {
  const rows = byOrg(orgId);
  const position = new Map(orderedIds.map((id, index) => [id, index]));
  for (const section of rows) {
    if (position.has(section.id)) section.order = position.get(section.id);
    else section.order = position.size + section.order;
  }
  await persist();
  return byOrg(orgId);
}
