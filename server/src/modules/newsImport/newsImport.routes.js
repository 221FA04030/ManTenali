import { Router } from 'express';
import { asyncHandler } from '../../common/utils/asyncHandler.js';
import { validate } from '../../common/middleware/validate.js';
import { idParams, listQuery, draftSchema, publishSchema, rejectSchema, webhookBody } from './newsImport.validation.js';
import * as c from './newsImport.controller.js';

/**
 * Admin routes, mounted at /admin/news-imports inside the admin router (which
 * already requires an authenticated admin).
 */
export function buildNewsImportAdminRoutes() {
  const router = Router();
  router.post('/fetch', asyncHandler(c.startFetch));
  router.get('/runs/latest', asyncHandler(c.latestRun));
  router.get('/runs/:id', validate({ params: idParams }), asyncHandler(c.getRun));
  router.get('/', validate({ query: listQuery }), asyncHandler(c.list));
  router.get('/:id', validate({ params: idParams }), asyncHandler(c.get));
  router.patch('/:id', validate({ params: idParams, body: draftSchema }), asyncHandler(c.saveDraft));
  router.post('/:id/publish', validate({ params: idParams, body: publishSchema }), asyncHandler(c.publish));
  router.post('/:id/reject', validate({ params: idParams, body: rejectSchema }), asyncHandler(c.reject));
  return router;
}

/** Server-to-server: the scheduled Apify task's webhook (shared-secret header, no session). */
export function buildIntegrationRoutes() {
  const router = Router();
  router.post('/apify/news-import', validate({ body: webhookBody }), asyncHandler(c.apifyWebhook));
  return router;
}
