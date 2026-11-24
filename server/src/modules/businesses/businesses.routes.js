import { Router } from 'express';
import { asyncHandler } from '../../common/utils/asyncHandler.js';
import { authenticate, authorize, optionalAuthenticate } from '../../common/middleware/authenticate.js';
import { validate } from '../../common/middleware/validate.js';
import { createRateLimiter } from '../../common/middleware/rateLimit.js';
import { getEnv } from '../../config/env.js';
import { ROLES } from '../../config/constants.js';
import {
  listQuery,
  createSchema,
  adminUpdateSchema,
  ownerUpdateSchema,
  submissionCreateSchema,
  slugParams,
  idParams,
} from './businesses.validation.js';
import * as controller from './businesses.controller.js';

export function buildBusinessesRoutes() {
  const router = Router();
  const submitLimiter = createRateLimiter({ windowMs: 60 * 60 * 1000, limit: getEnv().isTest ? 1000 : 20 });

  /** Admins may send any editable field; everyone else the owner schema (the service checks ownership and status). */
  const validateUpdate = (req, res, next) =>
    validate({ params: idParams, body: req.user.role === ROLES.ADMIN ? adminUpdateSchema : ownerUpdateSchema })(req, res, next);

  // Public
  router.get('/', validate({ query: listQuery }), asyncHandler(controller.list));

  // Signed-in users: their own listings and submissions
  router.get('/mine', authenticate, asyncHandler(controller.mine));
  router.get('/mine/:id', authenticate, validate({ params: idParams }), asyncHandler(controller.getMine));
  router.post('/submissions', authenticate, submitLimiter, validate({ body: submissionCreateSchema }), asyncHandler(controller.submit));
  router.post('/:id/submit', authenticate, submitLimiter, validate({ params: idParams }), asyncHandler(controller.submitForReview));

  // Public detail (owners/admins may also see their non-published listing)
  router.get('/:slug', optionalAuthenticate, validate({ params: slugParams }), asyncHandler(controller.detail));

  // Writes
  router.post('/', authenticate, authorize(ROLES.ADMIN), validate({ body: createSchema }), asyncHandler(controller.create));
  router.patch('/:id', authenticate, validateUpdate, asyncHandler(controller.update));
  router.delete('/:id', authenticate, authorize(ROLES.ADMIN), validate({ params: idParams }), asyncHandler(controller.archive));
  return router;
}
