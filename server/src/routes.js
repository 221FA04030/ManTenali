import { Router } from 'express';
import healthRoutes from './modules/health/health.routes.js';
import { buildAuthRoutes } from './modules/auth/auth.routes.js';
import usersRoutes from './modules/users/users.routes.js';
import { buildAdminRoutes } from './modules/admin/admin.routes.js';

/** Mounts every module under /api/v1. Adding a module = one line here. */
export function buildRoutes() {
  const router = Router();
  router.use('/health', healthRoutes);
  router.use('/auth', buildAuthRoutes());
  router.use('/users', usersRoutes);
  router.use('/admin', buildAdminRoutes());
  return router;
}
