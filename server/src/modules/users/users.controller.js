import * as usersService from './users.service.js';
import { ok } from '../../common/utils/response.js';

export async function updateMe(req, res) {
  const user = await usersService.updateSelf(req.user.id, req.validated.body);
  return ok(res, user);
}
