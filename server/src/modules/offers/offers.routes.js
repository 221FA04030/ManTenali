import { Router } from 'express';
import { asyncHandler } from '../../common/utils/asyncHandler.js';
import { authenticate, authorize, optionalAuthenticate } from '../../common/middleware/authenticate.js';
import { validate } from '../../common/middleware/validate.js';
import { createRateLimiter } from '../../common/middleware/rateLimit.js';
import { getEnv } from '../../config/env.js';
import { ROLES } from '../../config/constants.js';
import { createSchema, updateSchema, listQuery, businessOffersQuery, manageQuery, idParams } from './offers.validation.js';
import * as controller from './offers.controller.js';

const managers = authorize(ROLES.OWNER, ROLES.ADMIN);

/** /api/v1/offers */
export function buildOffersRoutes() {
  const router = Router();
  const writeLimiter = createRateLimiter({ windowMs: 60 * 60 * 1000, limit: getEnv().isTest ? 1000 : 60 });

  router.get('/', validate({ query: listQuery }), asyncHandler(controller.list));
  // Owner/admin management list (all statuses). Ownership is checked in the service.
  router.get('/mine', authenticate, managers, validate({ query: manageQuery }), asyncHandler(controller.manage));
  router.get('/:id', optionalAuthenticate, validate({ params: idParams }), asyncHandler(controller.detail));
  router.post('/', authenticate, managers, writeLimiter, validate({ body: createSchema }), asyncHandler(controller.create));
  router.patch('/:id', authenticate, managers, writeLimiter, validate({ params: idParams, body: updateSchema }), asyncHandler(controller.update));
  router.delete('/:id', authenticate, managers, validate({ params: idParams }), asyncHandler(controller.hide));
  return router;
}

/** /api/v1/businesses/:id/offers - mounted next to the businesses router (offers depend on businesses, not vice versa). */
export function buildBusinessOffersRoutes() {
  const router = Router();
  router.get('/:id/offers', validate({ params: idParams, query: businessOffersQuery }), asyncHandler(controller.listForBusiness));
  return router;
}
