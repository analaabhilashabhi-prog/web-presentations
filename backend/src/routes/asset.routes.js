import { createRouter } from '../utils/router.js';
import * as assetController from '../controllers/asset.controller.js';

export function assetRoutes() {
  const router = createRouter();
  router.get('/api/assets', assetController.list, 'admin');
  router.get('/api/assets/capabilities', assetController.capabilities, 'any');
  router.post('/api/assets', assetController.upload, 'admin');
  router.post('/api/assets/binary', assetController.uploadBinary, 'admin', { raw: true });
  return router;
}
