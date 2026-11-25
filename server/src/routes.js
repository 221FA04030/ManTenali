import { Router } from 'express';
import healthRoutes from './modules/health/health.routes.js';
import { buildAuthRoutes } from './modules/auth/auth.routes.js';
import usersRoutes from './modules/users/users.routes.js';
import { buildAdminRoutes } from './modules/admin/admin.routes.js';
import categoriesRoutes from './modules/categories/categories.routes.js';
import { buildMediaRoutes } from './modules/media/media.routes.js';
import { buildBusinessesRoutes } from './modules/businesses/businesses.routes.js';
import { buildOffersRoutes, buildBusinessOffersRoutes } from './modules/offers/offers.routes.js';

/** Mounts every module under /api/v1. Adding a module = one line here. */
export function buildRoutes() {
  const router = Router();
  router.use('/health', healthRoutes);
  router.use('/auth', buildAuthRoutes());
  router.use('/users', usersRoutes);
  router.use('/categories', categoriesRoutes);
  router.use('/media', buildMediaRoutes());
  router.use('/businesses', buildBusinessesRoutes());
  router.use('/businesses', buildBusinessOffersRoutes()); // GET /businesses/:id/offers
  router.use('/offers', buildOffersRoutes());
  router.use('/admin', buildAdminRoutes());
  return router;
}
