import { Router } from 'express';
import { asyncHandler } from '../../common/utils/asyncHandler.js';
import { validate } from '../../common/middleware/validate.js';
import { optionalAuthenticate } from '../../common/middleware/authenticate.js';
import { homeQuery } from './home.validation.js';
import * as c from './home.controller.js';

/** /api/v1/home - public Home feed (spec section 8). */
export function buildHomeRoutes() {
  const router = Router();
  router.get('/', optionalAuthenticate, validate({ query: homeQuery }), asyncHandler(c.feed));
  return router;
}
