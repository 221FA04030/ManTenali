import { Router } from 'express';
import { asyncHandler } from '../../common/utils/asyncHandler.js';
import { authenticate } from '../../common/middleware/authenticate.js';
import { validate } from '../../common/middleware/validate.js';
import { createRateLimiter } from '../../common/middleware/rateLimit.js';
import { getEnv } from '../../config/env.js';
import { signSchema } from './media.validation.js';
import * as controller from './media.controller.js';

export function buildMediaRoutes() {
  const router = Router();
  const signLimiter = createRateLimiter({ windowMs: 60 * 60 * 1000, limit: getEnv().isTest ? 1000 : 60 });
  // Role per purpose is checked in media.service (e.g. only admins sign event banners).
  router.post('/sign', authenticate, signLimiter, validate({ body: signSchema }), asyncHandler(controller.sign));
  return router;
}
