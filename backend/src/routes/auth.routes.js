import { createRouter } from '../utils/router.js';
import * as authController from '../controllers/auth.controller.js';

export function authRoutes() {
  const router = createRouter();
  router.post('/api/auth/login', authController.login);
  router.post('/api/auth/logout', authController.logout);
  router.get('/api/auth/me', authController.me);
  return router;
}
