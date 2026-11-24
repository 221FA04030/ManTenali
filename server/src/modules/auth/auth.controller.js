import * as authService from './auth.service.js';
import { toSelf } from '../users/users.service.js';
import { ok, created } from '../../common/utils/response.js';
import { setSessionCookie, clearSessionCookie } from '../../common/utils/jwt.js';

export async function register(req, res) {
  const user = await authService.register(req.validated.body);
  setSessionCookie(res, user);
  return created(res, toSelf(user));
}

export async function login(req, res) {
  const user = await authService.login(req.validated.body);
  setSessionCookie(res, user);
  return ok(res, toSelf(user));
}

export async function google(req, res) {
  const user = await authService.loginWithGoogle(req.validated.body);
  setSessionCookie(res, user);
  return ok(res, toSelf(user));
}

export async function logout(_req, res) {
  clearSessionCookie(res);
  return ok(res, { loggedOut: true });
}

export async function me(req, res) {
  return ok(res, await authService.me(req.user.id));
}
