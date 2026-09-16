import { createRouter } from '../utils/router.js';
import * as orgController from '../controllers/org.controller.js';

export function orgRoutes() {
  const router = createRouter();
  router.get('/api/orgs', orgController.list, 'any');
  router.get('/api/orgs/:orgId', orgController.get, 'any');
  router.post('/api/orgs', orgController.create, 'admin');
  router.patch('/api/orgs/:orgId', orgController.update, 'admin');
  return router;
}
