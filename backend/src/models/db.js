import fs from 'node:fs';
import { promises as fsp } from 'node:fs';
import path from 'node:path';
import { DB_FILE, ensureDirs } from '../config/paths.js';
import { logger } from '../utils/logger.js';

const EMPTY = {
  meta: { version: 1, seededAt: null },
  users: [],
  sessions: [],
  organizations: [],
  sections: [],
  assets: [],
  templates: [],
};

let state = null;
let writeChain = Promise.resolve();

export function load() {
  ensureDirs();
  if (!fs.existsSync(DB_FILE)) {
    state = structuredClone(EMPTY);
    fs.writeFileSync(DB_FILE, JSON.stringify(state, null, 2), 'utf8');
    logger.info('created fresh database at', DB_FILE);
    return state;
  }
  try {
    const parsed = JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
    state = { ...structuredClone(EMPTY), ...parsed };
    /* Sessions never come back off disk. They are bearer tokens, and this file
       is committed to a public repository — an old commit carrying an unexpired
       token would otherwise still sign somebody in as admin. Dropping them at
       load makes every historical token in git dead on arrival. */
    state.sessions = [];
  } catch (err) {
    logger.error('database file unreadable, starting empty:', err.message);
    state = structuredClone(EMPTY);
  }
  return state;
}

export function data() {
  if (!state) load();
  return state;
}

/** Atomic write (temp file + rename) with serialized writes to avoid interleaving. */
export function persist() {
  writeChain = writeChain.then(async () => {
    const tmp = `${DB_FILE}.${process.pid}.tmp`;
    await fsp.mkdir(path.dirname(DB_FILE), { recursive: true });
    /* Everything except the sessions, which stay in memory for the life of the
       process. Writing them put live tokens into a public git history on every
       commit that touched this file. The cost is that a restart signs everyone
       out, which was already true wherever this runs without a persistent disk.
       Key order is preserved so this does not rewrite the whole file. */
    const snapshot = {};
    for (const [key, value] of Object.entries(data())) {
      snapshot[key] = key === 'sessions' ? [] : value;
    }
    await fsp.writeFile(tmp, JSON.stringify(snapshot, null, 2), 'utf8');
    await fsp.rename(tmp, DB_FILE);
  }).catch((err) => {
    logger.error('failed to persist database:', err.message);
  });
  return writeChain;
}

export async function mutate(fn) {
  const result = fn(data());
  await persist();
  return result;
}
