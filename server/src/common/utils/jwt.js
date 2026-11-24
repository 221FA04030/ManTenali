import jwt from 'jsonwebtoken';
import { getEnv } from '../../config/env.js';

export const SESSION_COOKIE = 'mt_session';

const UNIT_MS = { s: 1000, m: 60_000, h: 3_600_000, d: 86_400_000 };
export function durationToMs(value) {
  const match = /^(\d+)([smhd])$/.exec(value);
  return match ? Number(match[1]) * UNIT_MS[match[2]] : 7 * UNIT_MS.d;
}

export function signSessionToken(user) {
  const env = getEnv();
  return jwt.sign({ sub: String(user._id ?? user.id), role: user.role }, env.JWT_SECRET, {
    algorithm: 'HS256',
    expiresIn: env.JWT_EXPIRES_IN,
  });
}

/** Returns the payload, or null when the token is missing, expired or forged. */
export function verifySessionToken(token) {
  if (!token) return null;
  try {
    return jwt.verify(token, getEnv().JWT_SECRET, { algorithms: ['HS256'] });
  } catch {
    return null;
  }
}

/** httpOnly + SameSite=Lax; Secure in production. JavaScript can never read it. */
export function sessionCookieOptions() {
  const env = getEnv();
  return {
    httpOnly: true,
    secure: env.isProduction,
    sameSite: 'lax',
    domain: env.COOKIE_DOMAIN,
    path: '/',
    maxAge: durationToMs(env.JWT_EXPIRES_IN),
  };
}

export function setSessionCookie(res, user) {
  res.cookie(SESSION_COOKIE, signSessionToken(user), sessionCookieOptions());
}

export function clearSessionCookie(res) {
  const { maxAge: _maxAge, ...opts } = sessionCookieOptions();
  res.clearCookie(SESSION_COOKIE, opts);
}
