import { Router } from 'express';
import { asyncHandler } from '../../common/utils/asyncHandler.js';
import { authenticate, authorize, optionalAuthenticate } from '../../common/middleware/authenticate.js';
import { validate } from '../../common/middleware/validate.js';
import { ROLES } from '../../config/constants.js';
import {
  listQuery,
  createSchema,
  adminUpdateSchema,
  ownerUpdateSchema,
  slugParams,
  idParams,
} from './businesses.validation.js';
import * as controller from './businesses.controller.js';

const router = Router();

/** Admins may send any editable field; owners only the owner-editable subset. */
const validateUpdate = (req, res, next) =>
  validate({ params: idParams, body: req.user.role === ROLES.ADMIN ? adminUpdateSchema : ownerUpdateSchema })(req, res, next);

router.get('/', validate({ query: listQuery }), asyncHandler(controller.list));
router.get('/mine', authenticate, authorize(ROLES.OWNER, ROLES.ADMIN), asyncHandler(controller.mine));
router.get('/:slug', optionalAuthenticate, validate({ params: slugParams }), asyncHandler(controller.detail));
router.post('/', authenticate, authorize(ROLES.ADMIN), validate({ body: createSchema }), asyncHandler(controller.create));
router.patch('/:id', authenticate, authorize(ROLES.OWNER, ROLES.ADMIN), validateUpdate, asyncHandler(controller.update));
router.delete('/:id', authenticate, authorize(ROLES.ADMIN), validate({ params: idParams }), asyncHandler(controller.archive));

export default router;
