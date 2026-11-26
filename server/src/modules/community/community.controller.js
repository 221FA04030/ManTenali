import * as communityService from './community.service.js';
import { ok, created } from '../../common/utils/response.js';

const v = (req) => req.validated;

export async function feed(req, res) {
  const { items, meta } = await communityService.feed(v(req).query, req.user);
  return ok(res, items, meta);
}
export async function mine(req, res) {
  return ok(res, await communityService.listMine(req.user));
}
export async function get(req, res) {
  return ok(res, await communityService.getPost(v(req).params.id, req.user));
}
export async function create(req, res) {
  return created(res, await communityService.create(req.user, v(req).body));
}
export async function update(req, res) {
  return ok(res, await communityService.update(req.user, v(req).params.id, v(req).body));
}
export async function remove(req, res) {
  return ok(res, await communityService.remove(req.user, v(req).params.id));
}
export async function like(req, res) {
  return ok(res, await communityService.like(req.user, v(req).params.id));
}
export async function unlike(req, res) {
  return ok(res, await communityService.unlike(req.user, v(req).params.id));
}
export async function comments(req, res) {
  const { items, meta } = await communityService.listComments(v(req).params.id, v(req).query, req.user);
  return ok(res, items, meta);
}
export async function addComment(req, res) {
  return created(res, await communityService.addComment(req.user, v(req).params.id, v(req).body));
}
export async function removeComment(req, res) {
  return ok(res, await communityService.removeComment(req.user, v(req).params.id));
}
