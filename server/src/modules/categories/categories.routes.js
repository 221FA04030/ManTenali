import { Router } from 'express';
import { asyncHandler } from '../../common/utils/asyncHandler.js';
import { authenticate, authorize, optionalAuthenticate } from '../../common/middleware/authenticate.js';
import { validate } from '../../common/middleware/validate.js';
import { ROLES } from '../../config/constants.js';
import { listQuery, createSchema, updateSchema, idParams } from './categories.validation.js';
import * as controller from './categories.controller.js';

const router = Router();

router.get('/', optionalAuthenticate, validate({ query: listQuery }), asyncHandler(controller.list));
router.post('/', authenticate, authorize(ROLES.ADMIN), validate({ body: createSchema }), asyncHandler(controller.create));
router.patch(
  '/:id',
  authenticate,
  authorize(ROLES.ADMIN),
  validate({ params: idParams, body: updateSchema }),
  asyncHandler(controller.update),
);

export default router;
