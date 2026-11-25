import { Router } from 'express';
import { asyncHandler } from '../../common/utils/asyncHandler.js';
import { authenticate } from '../../common/middleware/authenticate.js';
import { validate } from '../../common/middleware/validate.js';
import { createSchema, idParams } from './favorites.validation.js';
import * as c from './favorites.controller.js';

/** /api/v1/favorites - signed-in users only (spec section 8). */
export function buildFavoritesRoutes() {
  const router = Router();
  router.use(authenticate);
  router.get('/', asyncHandler(c.list));
  router.post('/', validate({ body: createSchema }), asyncHandler(c.add));
  router.delete('/:id', validate({ params: idParams }), asyncHandler(c.remove));
  return router;
}
