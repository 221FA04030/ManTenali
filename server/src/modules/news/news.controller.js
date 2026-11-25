import * as newsService from './news.service.js';
import { ok, created } from '../../common/utils/response.js';

const v = (req) => req.validated;

// Public
export async function list(req, res) {
  const { items, meta } = await newsService.listPublic(v(req).query);
  return ok(res, items, meta);
}
export async function detail(req, res) {
  return ok(res, await newsService.getBySlug(v(req).params.slug, req.user));
}

// Admin (FR-NEWS-3)
export async function create(req, res) {
  return created(res, await newsService.create(req.user, v(req).body));
}
export async function update(req, res) {
  return ok(res, await newsService.update(req.user, v(req).params.id, v(req).body));
}
export async function remove(req, res) {
  return ok(res, await newsService.remove(req.user, v(req).params.id));
}
