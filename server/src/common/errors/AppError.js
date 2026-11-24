import { ERROR_CODES } from './errorCodes.js';

/**
 * The only error type services throw. Carries a stable code, an HTTP status
 * and optional field-level details for the client.
 */
export class AppError extends Error {
  constructor(code, message, details) {
    const def = ERROR_CODES[code] ?? ERROR_CODES.INTERNAL_ERROR;
    super(message ?? def.message);
    this.name = 'AppError';
    this.code = ERROR_CODES[code] ? code : 'INTERNAL_ERROR';
    this.status = def.status;
    if (details !== undefined) this.details = details;
  }

  static validation(message, details) {
    return new AppError('VALIDATION_ERROR', message, details);
  }
  static unauthenticated(message) {
    return new AppError('UNAUTHENTICATED', message);
  }
  static forbidden(message) {
    return new AppError('FORBIDDEN', message);
  }
  static notFound(message) {
    return new AppError('NOT_FOUND', message);
  }
  static conflict(message, details) {
    return new AppError('CONFLICT', message, details);
  }
}
