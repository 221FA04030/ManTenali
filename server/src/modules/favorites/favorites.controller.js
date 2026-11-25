import * as favoritesService from './favorites.service.js';
import { ok, created } from '../../common/utils/response.js';

export async function list(req, res) {
  return ok(res, await favoritesService.listMine(req.user));
}
export async function add(req, res) {
  return created(res, await favoritesService.add(req.user, req.validated.body));
}
export async function remove(req, res) {
  return ok(res, await favoritesService.remove(req.user, req.validated.params.id));
}
