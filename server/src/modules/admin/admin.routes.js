import { Router } from 'express';
import { asyncHandler } from '../../common/utils/asyncHandler.js';
import { authenticate, authorize } from '../../common/middleware/authenticate.js';
import { validate } from '../../common/middleware/validate.js';
import { ROLES } from '../../config/constants.js';
import { adminListUsersQuery, adminUpdateUserSchema, idParams } from '../users/users.validation.js';
import {
  adminListQuery as businessListQuery,
  verifySchema,
  idParams as businessIdParams,
} from '../businesses/businesses.validation.js';
import * as controller from './admin.controller.js';

/** Everything under /admin requires an authenticated admin. */
export function buildAdminRoutes() {
  const router = Router();
  router.use(authenticate, authorize(ROLES.ADMIN));

  router.get('/users', validate({ query: adminListUsersQuery }), asyncHandler(controller.listUsers));
  router.patch(
    '/users/:id',
    validate({ params: idParams, body: adminUpdateUserSchema }),
    asyncHandler(controller.updateUser),
  );

  router.get('/businesses', validate({ query: businessListQuery }), asyncHandler(controller.listBusinesses));
  router.patch(
    '/businesses/:id/verify',
    validate({ params: businessIdParams, body: verifySchema }),
    asyncHandler(controller.verifyBusiness),
  );
  return router;
}
