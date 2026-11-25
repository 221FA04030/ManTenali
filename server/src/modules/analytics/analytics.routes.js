import { Router } from 'express';
import { asyncHandler } from '../../common/utils/asyncHandler.js';
import { validate } from '../../common/middleware/validate.js';
import { createRateLimiter } from '../../common/middleware/rateLimit.js';
import { getEnv } from '../../config/env.js';
import { eventSchema } from './analytics.validation.js';
import * as c from './analytics.controller.js';

/** /api/v1/analytics - public, anonymous, stricter rate limit (spec security checklist). */
export function buildAnalyticsRoutes() {
  const router = Router();
  const limiter = createRateLimiter({ windowMs: 15 * 60 * 1000, limit: getEnv().isTest ? 10_000 : 300 });
  router.post('/events', limiter, validate({ body: eventSchema }), asyncHandler(c.record));
  return router;
}
