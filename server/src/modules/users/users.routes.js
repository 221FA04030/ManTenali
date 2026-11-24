import { Router } from 'express';
import { asyncHandler } from '../../common/utils/asyncHandler.js';
import { authenticate } from '../../common/middleware/authenticate.js';
import { validate } from '../../common/middleware/validate.js';
import { updateMeSchema } from './users.validation.js';
import * as controller from './users.controller.js';

const router = Router();

router.patch('/me', authenticate, validate({ body: updateMeSchema }), asyncHandler(controller.updateMe));

export default router;
