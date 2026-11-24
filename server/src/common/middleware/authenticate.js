import { AppError } from '../errors/index.js';
import { SESSION_COOKIE, verifySessionToken } from '../utils/jwt.js';
import { findSessionUser } from '../../modules/users/users.service.js';

/**
 * Resolve the session cookie into { id, role, name }. The user is re-loaded on
 * every request so role changes and blocks take effect immediately.
 */
async function resolveUser(req) {
  const payload = verifySessionToken(req.cookies?.[SESSION_COOKIE]);
  if (!payload?.sub) return { user: null };
  const user = await findSessionUser(payload.sub);
  if (!user) return { user: null };
  if (user.status === 'blocked') return { user: null, blocked: true };
  return { user: { id: String(user._id), role: user.role, name: user.name } };
}

/** Requires a valid session; attaches req.user or rejects with 401 (403 if blocked). */
export async function authenticate(req, _res, next) {
  try {
    const { user, blocked } = await resolveUser(req);
    if (blocked) return next(AppError.forbidden('This account has been blocked.'));
    if (!user) return next(AppError.unauthenticated());
    req.user = user;
    return next();
  } catch (err) {
    return next(err);
  }
}

/** Attaches req.user when a valid session exists; never rejects. */
export async function optionalAuthenticate(req, _res, next) {
  try {
    const { user } = await resolveUser(req);
    if (user) req.user = user;
    return next();
  } catch (err) {
    return next(err);
  }
}

/** Role gate. Default is deny: routes must list the roles they allow. */
export function authorize(...roles) {
  const allowed = new Set(roles.flat());
  return (req, _res, next) => {
    if (!req.user) return next(AppError.unauthenticated());
    if (!allowed.has(req.user.role)) return next(AppError.forbidden());
    return next();
  };
}
