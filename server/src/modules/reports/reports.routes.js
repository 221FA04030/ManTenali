import { Router } from 'express';
import { asyncHandler } from '../../common/utils/asyncHandler.js';
import { authenticate } from '../../common/middleware/authenticate.js';
import { validate } from '../../common/middleware/validate.js';
import { createRateLimiter } from '../../common/middleware/rateLimit.js';
import { getEnv } from '../../config/env.js';
import { createSchema } from './reports.validation.js';
import * as c from './reports.controller.js';

/** /api/v1/reports - signed-in users report content or send a suggestion. Admin queue: /admin/reports. */
export function buildReportsRoutes() {
  const router = Router();
  const limiter = createRateLimiter({ windowMs: 60 * 60 * 1000, limit: getEnv().isTest ? 1000 : 10 });
  router.post('/', authenticate, limiter, validate({ body: createSchema }), asyncHandler(c.create));
  return router;
}
