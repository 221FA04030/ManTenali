import { Router } from 'express';
import { asyncHandler } from '../../common/utils/asyncHandler.js';
import { authenticate } from '../../common/middleware/authenticate.js';
import { validate } from '../../common/middleware/validate.js';
import { createRateLimiter } from '../../common/middleware/rateLimit.js';
import { getEnv } from '../../config/env.js';
import { registerSchema, loginSchema, googleSchema } from './auth.validation.js';
import * as controller from './auth.controller.js';

export function buildAuthRoutes() {
  const router = Router();
  // Stricter limit on credential endpoints (spec security checklist).
  const authLimiter = createRateLimiter({ windowMs: 15 * 60 * 1000, limit: getEnv().isTest ? 1000 : 20 });

  router.post('/register', authLimiter, validate({ body: registerSchema }), asyncHandler(controller.register));
  router.post('/login', authLimiter, validate({ body: loginSchema }), asyncHandler(controller.login));
  router.post('/google', authLimiter, validate({ body: googleSchema }), asyncHandler(controller.google));
  router.post('/logout', authenticate, asyncHandler(controller.logout));
  router.get('/me', authenticate, asyncHandler(controller.me));
  return router;
}
