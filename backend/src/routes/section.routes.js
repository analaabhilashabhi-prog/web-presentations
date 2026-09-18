import { createRouter } from '../utils/router.js';
import * as sectionController from '../controllers/section.controller.js';

export function sectionRoutes() {
  const router = createRouter();
  router.get('/api/orgs/:orgId/sections', sectionController.listByOrg, 'any');
  /* Every image the deck will ask for, so the client can warm them while the
     first slide is on screen rather than as each tab is opened. */
  router.get('/api/orgs/:orgId/media-manifest', sectionController.mediaManifest, 'any');
  router.post('/api/orgs/:orgId/sections', sectionController.create, 'admin');
  router.post('/api/orgs/:orgId/sections/reorder', sectionController.reorder, 'admin');
  router.get('/api/sections/:sectionId', sectionController.get, 'any');
  router.post('/api/sections/:sectionId/duplicate', sectionController.duplicate, 'admin');
  router.patch('/api/sections/:sectionId', sectionController.update, 'admin');
  router.delete('/api/sections/:sectionId', sectionController.remove, 'admin');
  return router;
}
