import mongoose from 'mongoose';
import { AppError, ERROR_CODES } from '../errors/index.js';
import { errorBody } from '../utils/response.js';
import { reportError } from '../integrations/sentry.js';

/** Convert known non-AppError failures into AppErrors. */
function normalise(err) {
  if (err instanceof AppError) return err;
  if (err?.type === 'entity.parse.failed') return AppError.validation('Malformed JSON body.');
  if (err?.type === 'entity.too.large') return AppError.validation('Request body is too large.');
  if (err instanceof mongoose.Error.CastError) return AppError.notFound();
  if (err instanceof mongoose.Error.ValidationError) {
    const details = Object.values(err.errors).map((e) => ({ field: `body.${e.path}`, message: e.message }));
    return AppError.validation(undefined, details);
  }
  if (err?.code === 11000) {
    const fields = Object.keys(err.keyPattern ?? err.keyValue ?? {});
    return AppError.conflict(undefined, fields.map((field) => ({ field })));
  }
  return null;
}

/** Central error handler: one response format, no internals leaked. */
export function errorHandler(err, req, res, _next) {
  const appError = normalise(err);
  if (appError) {
    if (appError.status >= 500) {
      req.log?.error({ err }, appError.message);
      reportError(err, { requestId: req.id, method: req.method, route: req.route?.path ?? req.path });
    }
    return res.status(appError.status).json(errorBody(appError.code, appError.message, appError.details));
  }
  req.log?.error({ err, requestId: req.id }, 'unhandled error');
  reportError(err, { requestId: req.id, method: req.method, route: req.route?.path ?? req.path });
  return res.status(500).json(
    errorBody('INTERNAL_ERROR', ERROR_CODES.INTERNAL_ERROR.message, { requestId: req.id }),
  );
}
