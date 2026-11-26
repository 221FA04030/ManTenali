import { Router } from 'express';
import { asyncHandler } from '../../common/utils/asyncHandler.js';
import { authenticate, optionalAuthenticate } from '../../common/middleware/authenticate.js';
import { validate } from '../../common/middleware/validate.js';
import { createRateLimiter } from '../../common/middleware/rateLimit.js';
import { getEnv } from '../../config/env.js';
import { createSchema, updateSchema, feedQuery, commentSchema, commentsQuery, idParams } from './community.validation.js';
import * as c from './community.controller.js';

/** /api/v1/posts - community feed (public read; signed-in users post, like and comment). */
export function buildPostsRoutes() {
  const router = Router();
  const test = getEnv().isTest;
  const writeLimiter = createRateLimiter({ windowMs: 60 * 60 * 1000, limit: test ? 10_000 : 30 });
  const reactLimiter = createRateLimiter({ windowMs: 15 * 60 * 1000, limit: test ? 10_000 : 200 });

  router.get('/', optionalAuthenticate, validate({ query: feedQuery }), asyncHandler(c.feed));
  router.get('/mine', authenticate, asyncHandler(c.mine));
  router.post('/', authenticate, writeLimiter, validate({ body: createSchema }), asyncHandler(c.create));
  router.get('/:id', optionalAuthenticate, validate({ params: idParams }), asyncHandler(c.get));
  router.patch('/:id', authenticate, validate({ params: idParams, body: updateSchema }), asyncHandler(c.update));
  router.delete('/:id', authenticate, validate({ params: idParams }), asyncHandler(c.remove));
  router.post('/:id/like', authenticate, reactLimiter, validate({ params: idParams }), asyncHandler(c.like));
  router.delete('/:id/like', authenticate, reactLimiter, validate({ params: idParams }), asyncHandler(c.unlike));
  router.get('/:id/comments', optionalAuthenticate, validate({ params: idParams, query: commentsQuery }), asyncHandler(c.comments));
  router.post('/:id/comments', authenticate, writeLimiter, validate({ params: idParams, body: commentSchema }), asyncHandler(c.addComment));
  return router;
}

/** /api/v1/comments/:id - delete own comment (admins: hide any). */
export function buildCommentsRoutes() {
  const router = Router();
  router.delete('/:id', authenticate, validate({ params: idParams }), asyncHandler(c.removeComment));
  return router;
}
