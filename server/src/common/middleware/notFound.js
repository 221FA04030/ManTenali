import { AppError } from '../errors/index.js';

export function notFound(req, _res, next) {
  next(AppError.notFound(`Route ${req.method} ${req.path} not found.`));
}
