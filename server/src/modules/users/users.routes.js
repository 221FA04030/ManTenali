import { Router } from 'express';
import { asyncHandler } from '../../common/utils/asyncHandler.js';
import { authenticate } from '../../common/middleware/authenticate.js';
import { validate } from '../../common/middleware/validate.js';
import { updateMeSchema, engagementSchema } from './users.validation.js';
import * as controller from './users.controller.js';

const router = Router();

router.patch('/me', authenticate, validate({ body: updateMeSchema }), asyncHandler(controller.updateMe));
// Home shortcut ranking: the signed-in user's own feature engagement scores.
router.get('/me/engagement', authenticate, asyncHandler(controller.getEngagement));
router.patch('/me/engagement', authenticate, validate({ body: engagementSchema }), asyncHandler(controller.saveEngagement));

export default router;
