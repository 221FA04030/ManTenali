import { AppError } from '../errors/index.js';

function formatIssues(issues, location) {
  return issues.map((i) => ({
    field: [location, ...i.path].join('.'),
    message: i.message,
  }));
}

/**
 * Validate request parts with Zod schemas. Parsed (coerced, defaulted) values
 * are stored on req.validated = { body, query, params }; controllers read only
 * from there. Use z.strictObject so unknown fields are rejected.
 */
export function validate({ body, query, params } = {}) {
  return (req, _res, next) => {
    const validated = {};
    const details = [];
    for (const [location, schema] of Object.entries({ params, query, body })) {
      if (!schema) continue;
      const input = req[location] ?? {};
      const result = schema.safeParse(input);
      if (result.success) validated[location] = result.data;
      else details.push(...formatIssues(result.error.issues, location));
    }
    if (details.length) return next(AppError.validation(undefined, details));
    req.validated = { ...(req.validated ?? {}), ...validated };
    return next();
  };
}
