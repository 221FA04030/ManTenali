import { AppError } from '../errors/index.js';

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

function originOf(value) {
  try {
    return new URL(value).origin;
  } catch {
    return null;
  }
}

/**
 * CSRF defence (with SameSite=Lax cookies): every state-changing request must
 * come from an allow-listed Origin (or Referer). Requests with neither header
 * are allowed only when they carry no cookies, because without a cookie there
 * is no ambient credential to abuse (e.g. server-to-server or curl calls).
 */
export function originCheck(allowedOrigins) {
  const allowed = new Set(allowedOrigins);
  return (req, _res, next) => {
    if (SAFE_METHODS.has(req.method)) return next();
    const origin = req.get('origin');
    const referer = req.get('referer');
    const source = origin ? originOf(origin) : referer ? originOf(referer) : undefined;
    if (source === undefined) {
      if (!req.headers.cookie) return next();
      return next(AppError.forbidden('Request origin missing.'));
    }
    if (source && allowed.has(source)) return next();
    return next(AppError.forbidden('Request origin not allowed.'));
  };
}
