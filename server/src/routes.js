import { Router } from 'express';
import healthRoutes from './modules/health/health.routes.js';
import { buildAuthRoutes } from './modules/auth/auth.routes.js';
import usersRoutes from './modules/users/users.routes.js';
import { buildAdminRoutes } from './modules/admin/admin.routes.js';
import categoriesRoutes from './modules/categories/categories.routes.js';
import { buildMediaRoutes } from './modules/media/media.routes.js';
import { buildBusinessesRoutes } from './modules/businesses/businesses.routes.js';
import { buildOffersRoutes, buildBusinessOffersRoutes } from './modules/offers/offers.routes.js';
import { buildEventsRoutes } from './modules/events/events.routes.js';
import { buildNewsRoutes } from './modules/news/news.routes.js';
import { buildSearchRoutes } from './modules/search/search.routes.js';
import { buildHomeRoutes } from './modules/home/home.routes.js';
import { buildFavoritesRoutes } from './modules/favorites/favorites.routes.js';
import { buildReviewsRoutes, buildBusinessReviewsRoutes } from './modules/reviews/reviews.routes.js';
import { buildReportsRoutes } from './modules/reports/reports.routes.js';
import { buildAnalyticsRoutes } from './modules/analytics/analytics.routes.js';
import { buildPostsRoutes, buildCommentsRoutes } from './modules/community/community.routes.js';
import { buildIntegrationRoutes } from './modules/newsImport/newsImport.routes.js';

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
  router.use('/businesses', buildBusinessReviewsRoutes()); // /businesses/:id/reviews
  router.use('/offers', buildOffersRoutes());
  router.use('/events', buildEventsRoutes());
  router.use('/news', buildNewsRoutes());
  router.use('/search', buildSearchRoutes());
  router.use('/home', buildHomeRoutes());
  router.use('/favorites', buildFavoritesRoutes());
  router.use('/reviews', buildReviewsRoutes());
  router.use('/reports', buildReportsRoutes());
  router.use('/analytics', buildAnalyticsRoutes());
  router.use('/posts', buildPostsRoutes());
  router.use('/comments', buildCommentsRoutes());
  router.use('/admin', buildAdminRoutes());
  router.use('/integrations', buildIntegrationRoutes()); // server-to-server webhooks (shared secret)
  return router;
}
