import http from 'node:http';
import { env } from './config/env.js';
import { ensureDirs } from './config/paths.js';
import { load } from './models/db.js';
import * as sessionModel from './models/session.model.js';
import { ensureSeedUsers } from './services/auth.service.js';
import { seedIfEmpty } from './services/seed.service.js';
import { migrateLayouts } from './services/section.service.js';
import { logMediaCapabilities } from './utils/media.js';
import { buildRouter } from './routes/index.js';
import { serveStatic } from './middleware/static.middleware.js';
import { resolveUser, enforce } from './middleware/auth.middleware.js';
import { handleError } from './middleware/error.middleware.js';
import { HttpError, readJsonBody, sendJson } from './utils/http.js';
import { logger } from './utils/logger.js';

const BODY_METHODS = new Set(['POST', 'PATCH', 'PUT']);
const router = buildRouter();

async function handle(req, res) {
  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);

  if (await serveStatic(req, res, url.pathname)) return;

  const match = router.match(req.method, url.pathname);
  if (!match) throw new HttpError(404, `No route for ${req.method} ${url.pathname}`);
  if (match.methodMismatch) throw new HttpError(405, `${req.method} not allowed on ${url.pathname}`);

  const user = resolveUser(req);
  enforce(match.route.auth, user);

  const body = BODY_METHODS.has(req.method) && !match.route.raw
    ? await readJsonBody(req, env.maxUploadBytes * 4)
    : null;

  await match.route.handler(req, res, { params: match.params, query: url.searchParams, user, body });
}

const server = http.createServer((req, res) => {
  handle(req, res).catch((err) => handleError(res, err));
});

async function start() {
  ensureDirs();
  load();
  await ensureSeedUsers();
  await seedIfEmpty();
  const migrated = await migrateLayouts();
  if (migrated) logger.info(`gave canvas coordinates to ${migrated} pre-canvas section(s)`);
  logMediaCapabilities();
  const purged = await sessionModel.purgeExpired();
  if (purged) logger.info(`purged ${purged} expired session(s)`);

  server.listen(env.port, env.host, () => {
    logger.info(`presentation app ready at http://${env.host}:${env.port}`);
    logger.info(`admin: ${env.seedUsers.admin.email} · presenter: ${env.seedUsers.presenter.email}`);
  });
}

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    logger.error(`port ${env.port} is already in use. Set PORT in backend/.env and retry.`);
    process.exit(1);
  }
  logger.error(err.message);
  process.exit(1);
});

process.on('SIGINT', () => {
  logger.info('shutting down');
  server.close(() => process.exit(0));
});

start().catch((err) => {
  logger.error('failed to start:', err.stack || err.message);
  process.exit(1);
});

export { server };
