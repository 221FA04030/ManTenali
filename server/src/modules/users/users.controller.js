import * as usersService from './users.service.js';
import { ok } from '../../common/utils/response.js';

export async function updateMe(req, res) {
  const user = await usersService.updateSelf(req.user.id, req.validated.body);
  return ok(res, user);
}

export async function getEngagement(req, res) {
  return ok(res, await usersService.getEngagement(req.user.id));
}

export async function saveEngagement(req, res) {
  return ok(res, await usersService.saveEngagement(req.user.id, req.validated.body));
}
