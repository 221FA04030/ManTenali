import { Router } from 'express';
import { asyncHandler } from '../../common/utils/asyncHandler.js';
import { validate } from '../../common/middleware/validate.js';
import { createRateLimiter } from '../../common/middleware/rateLimit.js';
import { getEnv } from '../../config/env.js';
import { searchQuery, suggestQuery } from './search.validation.js';
import * as c from './search.controller.js';

/** /api/v1/search - public, no login (spec Figure 4). */
export function buildSearchRoutes() {
  const router = Router();
  const test = getEnv().isTest;
  // Search is the most expensive public read: its own per-IP limit on top of the global one.
  const limiter = createRateLimiter({ windowMs: 60 * 1000, limit: test ? 10_000 : 60 });
  const suggestLimiter = createRateLimiter({ windowMs: 60 * 1000, limit: test ? 10_000 : 120 });
  router.get('/', limiter, validate({ query: searchQuery }), asyncHandler(c.search));
  router.get('/suggest', suggestLimiter, validate({ query: suggestQuery }), asyncHandler(c.suggest));
  return router;
}
