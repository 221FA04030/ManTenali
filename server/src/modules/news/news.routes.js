import { Router } from 'express';
import { asyncHandler } from '../../common/utils/asyncHandler.js';
import { authenticate, authorize, optionalAuthenticate } from '../../common/middleware/authenticate.js';
import { validate } from '../../common/middleware/validate.js';
import { ROLES } from '../../config/constants.js';
import { listQuery, createSchema, updateSchema, slugParams, idParams } from './news.validation.js';
import * as c from './news.controller.js';

/** /api/v1/news */
export function buildNewsRoutes() {
  const router = Router();
  const admin = [authenticate, authorize(ROLES.ADMIN)];

  // Public (admins may preview non-public items by slug)
  router.get('/', validate({ query: listQuery }), asyncHandler(c.list));
  router.get('/:slug', optionalAuthenticate, validate({ params: slugParams }), asyncHandler(c.detail));

  // Admin: create, edit / publish / pin / hide, remove (soft)
  router.post('/', ...admin, validate({ body: createSchema }), asyncHandler(c.create));
  router.patch('/:id', ...admin, validate({ params: idParams, body: updateSchema }), asyncHandler(c.update));
  router.delete('/:id', ...admin, validate({ params: idParams }), asyncHandler(c.remove));
  return router;
}
