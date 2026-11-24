/** Standard error codes and their HTTP status (section 6 of the spec). */
export const ERROR_CODES = Object.freeze({
  VALIDATION_ERROR: { status: 400, message: 'The request contains invalid data.' },
  UNAUTHENTICATED: { status: 401, message: 'Please log in to continue.' },
  FORBIDDEN: { status: 403, message: 'You do not have permission to do this.' },
  NOT_FOUND: { status: 404, message: 'The requested resource was not found.' },
  CONFLICT: { status: 409, message: 'This already exists.' },
  RATE_LIMITED: { status: 429, message: 'Too many requests. Please try again later.' },
  INTERNAL_ERROR: { status: 500, message: 'Something went wrong. Please try again.' },
  SERVICE_UNAVAILABLE: { status: 503, message: 'Service temporarily unavailable.' },
});
