import * as reviewsService from './reviews.service.js';
import { ok, created } from '../../common/utils/response.js';

const v = (req) => req.validated;

export async function listForBusiness(req, res) {
  const { items, meta } = await reviewsService.listForBusiness(v(req).params.id, v(req).query);
  return ok(res, items, meta);
}
export async function mineForBusiness(req, res) {
  return ok(res, await reviewsService.getMineForBusiness(req.user, v(req).params.id));
}
export async function create(req, res) {
  return created(res, await reviewsService.create(req.user, v(req).params.id, v(req).body));
}
export async function mine(req, res) {
  return ok(res, await reviewsService.listMine(req.user));
}
export async function update(req, res) {
  return ok(res, await reviewsService.update(req.user, v(req).params.id, v(req).body));
}
export async function remove(req, res) {
  return ok(res, await reviewsService.remove(req.user, v(req).params.id));
}
