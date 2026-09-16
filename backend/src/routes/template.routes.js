import { createRouter } from '../utils/router.js';
import * as templateController from '../controllers/template.controller.js';

export function templateRoutes() {
  const router = createRouter();
  router.get('/api/templates', templateController.list, 'any');
  router.post('/api/templates', templateController.create, 'admin');
  router.patch('/api/templates/:templateId', templateController.update, 'admin');
  router.delete('/api/templates/:templateId', templateController.remove, 'admin');
  return router;
}
