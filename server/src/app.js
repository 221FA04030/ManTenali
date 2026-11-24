import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import mongoSanitize from 'express-mongo-sanitize';
import { API_PREFIX, BODY_LIMIT } from './config/constants.js';
import {
  requestId,
  httpLogger,
  createRateLimiter,
  originCheck,
  notFound,
  errorHandler,
} from './common/middleware/index.js';
import { buildRoutes } from './routes.js';

/**
 * Build the Express app. No listening and no DB connection here, so tests can
 * import it directly.
 */
export function createApp({ env, logger }) {
  const app = express();
  app.disable('x-powered-by');
  if (env.TRUST_PROXY) app.set('trust proxy', env.TRUST_PROXY);

  const allowedOrigins = env.CLIENT_ORIGINS;

  app.use(requestId);
  app.use(httpLogger(logger));
  app.use(helmet());
  app.use(
    cors({
      origin: (origin, cb) => cb(null, !origin || allowedOrigins.includes(origin)),
      credentials: true,
    }),
  );
  app.use(express.json({ limit: BODY_LIMIT }));
  app.use(cookieParser());
  app.use(mongoSanitize());
  app.use(createRateLimiter({ windowMs: 15 * 60 * 1000, limit: 600 }));
  app.use(originCheck(allowedOrigins));

  app.use(API_PREFIX, buildRoutes());

  app.use(notFound);
  app.use(errorHandler);
  return app;
}
