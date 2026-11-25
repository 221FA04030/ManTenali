import { Router } from 'express';
import { asyncHandler } from '../../common/utils/asyncHandler.js';
import { authenticate, authorize, optionalAuthenticate } from '../../common/middleware/authenticate.js';
import { validate } from '../../common/middleware/validate.js';
import { createRateLimiter } from '../../common/middleware/rateLimit.js';
import { getEnv } from '../../config/env.js';
import { ROLES } from '../../config/constants.js';
import {
  listQuery,
  submissionSchema,
  submissionUpdateSchema,
  adminCreateSchema,
  adminUpdateSchema,
  evidenceItem,
  slugParams,
  idParams,
  evidenceParams,
} from './events.validation.js';
import * as c from './events.controller.js';

/** /api/v1/events */
export function buildEventsRoutes() {
  const router = Router();
  const test = getEnv().isTest;
  const submitLimiter = createRateLimiter({ windowMs: 60 * 60 * 1000, limit: test ? 1000 : 10 });
  const evidenceLimiter = createRateLimiter({ windowMs: 60 * 60 * 1000, limit: test ? 1000 : 60 });
  const admin = [authenticate, authorize(ROLES.ADMIN)];

  // Public
  router.get('/', validate({ query: listQuery }), asyncHandler(c.list));

  // Submitters (any signed-in user; ownership is checked in the service)
  router.post('/submissions', authenticate, submitLimiter, validate({ body: submissionSchema }), asyncHandler(c.submit));
  router.get('/submissions/mine', authenticate, asyncHandler(c.mine));
  router.get('/submissions/:id', authenticate, validate({ params: idParams }), asyncHandler(c.getSubmission));
  router.patch('/submissions/:id', authenticate, validate({ params: idParams, body: submissionUpdateSchema }), asyncHandler(c.updateSubmission));
  router.post('/submissions/:id/resubmit', authenticate, submitLimiter, validate({ params: idParams }), asyncHandler(c.resubmit));
  router.post('/submissions/:id/withdraw', authenticate, validate({ params: idParams }), asyncHandler(c.withdraw));
  router.post('/submissions/:id/evidence', authenticate, evidenceLimiter, validate({ params: idParams, body: evidenceItem }), asyncHandler(c.addEvidence));
  router.delete('/submissions/:id/evidence/:evidenceId', authenticate, validate({ params: evidenceParams }), asyncHandler(c.removeEvidence));
  // POST (not GET) so signed links are never cached by browsers or proxies.
  router.post('/submissions/:id/evidence/:evidenceId/access', authenticate, evidenceLimiter, validate({ params: evidenceParams }), asyncHandler(c.evidenceAccess));

  // Public detail (admins may preview non-public events)
  router.get('/:slug', optionalAuthenticate, validate({ params: slugParams }), asyncHandler(c.detail));

  // Admin event management (FR-EVT-3)
  router.post('/', ...admin, validate({ body: adminCreateSchema }), asyncHandler(c.adminCreate));
  router.patch('/:id', ...admin, validate({ params: idParams, body: adminUpdateSchema }), asyncHandler(c.adminUpdate));
  router.delete('/:id', ...admin, validate({ params: idParams }), asyncHandler(c.adminRemove));
  return router;
}
