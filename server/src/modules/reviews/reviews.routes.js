import { Router } from 'express';
import { asyncHandler } from '../../common/utils/asyncHandler.js';
import { authenticate } from '../../common/middleware/authenticate.js';
import { validate } from '../../common/middleware/validate.js';
import { createRateLimiter } from '../../common/middleware/rateLimit.js';
import { getEnv } from '../../config/env.js';
import { createSchema, updateSchema, listQuery, businessParams, idParams } from './reviews.validation.js';
import * as c from './reviews.controller.js';

/** Mounted on /businesses: GET/POST /businesses/:id/reviews and GET /businesses/:id/reviews/mine. */
export function buildBusinessReviewsRoutes() {
  const router = Router();
  const writeLimiter = createRateLimiter({ windowMs: 60 * 60 * 1000, limit: getEnv().isTest ? 1000 : 30 });
  router.get('/:id/reviews', validate({ params: businessParams, query: listQuery }), asyncHandler(c.listForBusiness));
  router.get('/:id/reviews/mine', authenticate, validate({ params: businessParams }), asyncHandler(c.mineForBusiness));
  router.post('/:id/reviews', authenticate, writeLimiter, validate({ params: businessParams, body: createSchema }), asyncHandler(c.create));
  return router;
}

/** /reviews: own reviews (profile), edit own, delete own (admins: hide any). */
export function buildReviewsRoutes() {
  const router = Router();
  router.get('/mine', authenticate, asyncHandler(c.mine));
  router.patch('/:id', authenticate, validate({ params: idParams, body: updateSchema }), asyncHandler(c.update));
  router.delete('/:id', authenticate, validate({ params: idParams }), asyncHandler(c.remove));
  return router;
}
