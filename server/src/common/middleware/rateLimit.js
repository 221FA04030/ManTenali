import rateLimit from 'express-rate-limit';
import { ERROR_CODES } from '../errors/index.js';
import { errorBody } from '../utils/response.js';

/** Rate limiter factory that replies with the standard error envelope. */
export function createRateLimiter({ windowMs = 15 * 60 * 1000, limit = 300 } = {}) {
  return rateLimit({
    windowMs,
    limit,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    handler: (_req, res) => {
      res.status(429).json(errorBody('RATE_LIMITED', ERROR_CODES.RATE_LIMITED.message));
    },
  });
}
