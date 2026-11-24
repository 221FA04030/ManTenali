import { Router } from 'express';
import { asyncHandler } from '../../common/utils/asyncHandler.js';
import * as controller from './health.controller.js';

const router = Router();
router.get('/', asyncHandler(controller.health));
export default router;
