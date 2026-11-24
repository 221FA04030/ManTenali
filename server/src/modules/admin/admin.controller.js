import * as usersService from '../users/users.service.js';
import * as businessesService from '../businesses/businesses.service.js';
import { ok } from '../../common/utils/response.js';

/**
 * Admin HTTP handlers. Each one calls exactly one service function of the
 * owning module; the admin module itself holds no business rules.
 */
export async function listUsers(req, res) {
  const { items, meta } = await usersService.listUsers(req.validated.query);
  return ok(res, items, meta);
}

export async function updateUser(req, res) {
  const user = await usersService.adminUpdateUser(req.user, req.validated.params.id, req.validated.body);
  return ok(res, user);
}

export async function listBusinesses(req, res) {
  const { items, meta } = await businessesService.adminList(req.validated.query);
  return ok(res, items, meta);
}

export async function verifyBusiness(req, res) {
  return ok(res, await businessesService.setVerified(req.validated.params.id, req.validated.body.isVerified));
}
