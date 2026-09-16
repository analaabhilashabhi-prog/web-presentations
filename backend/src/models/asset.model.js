import { data, persist } from './db.js';

export function all() {
  return data().assets;
}

export function byId(id) {
  return data().assets.find((asset) => asset.id === id) || null;
}

export function byIds(ids = []) {
  return ids.map((id) => byId(id)).filter(Boolean);
}

export async function insert(asset) {
  data().assets.push(asset);
  await persist();
  return asset;
}

export async function remove(id) {
  const store = data();
  const before = store.assets.length;
  store.assets = store.assets.filter((asset) => asset.id !== id);
  const removed = store.assets.length !== before;
  if (removed) await persist();
  return removed;
}
