import { createRouter } from '../utils/router.js';
import { authRoutes } from './auth.routes.js';
import { orgRoutes } from './org.routes.js';
import { sectionRoutes } from './section.routes.js';
import { assetRoutes } from './asset.routes.js';
import { templateRoutes } from './template.routes.js';
import { sendJson } from '../utils/http.js';
import { buildId } from '../utils/build-id.js';
import { env } from '../config/env.js';

export function buildRouter() {
  const router = createRouter();
  // Doubles as the keep-alive target and as the frontend's "am I stale?" probe.
  router.get('/api/health', async (req, res) => sendJson(res, 200, {
    ok: true,
    build: await buildId(),
  }));
  /* Read by frontend/src/utils/media.js before any module loads. A one-line
     script rather than a fetch, so nothing renders before the prefix is known. */
  router.get('/config.js', (req, res) => {
    res.writeHead(200, {
      'Content-Type': 'text/javascript; charset=utf-8',
      'Cache-Control': 'no-cache',
    });
    res.end(`window.__MEDIA_BASE__=${JSON.stringify(env.mediaBaseUrl || '')};`);
  });
  router.use(authRoutes());
  router.use(orgRoutes());
  router.use(sectionRoutes());
  router.use(assetRoutes());
  router.use(templateRoutes());
  return router;
}
