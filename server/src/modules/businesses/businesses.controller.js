import * as businessesService from './businesses.service.js';
import { ok, created } from '../../common/utils/response.js';

export async function list(req, res) {
  const { items, meta } = await businessesService.listPublic(req.validated.query);
  return ok(res, items, meta);
}

export async function detail(req, res) {
  return ok(res, await businessesService.getBySlug(req.validated.params.slug, req.user));
}

export async function mine(req, res) {
  return ok(res, await businessesService.listMine(req.user));
}

export async function create(req, res) {
  return created(res, await businessesService.createBusiness(req.user, req.validated.body));
}

export async function update(req, res) {
  return ok(res, await businessesService.updateBusiness(req.user, req.validated.params.id, req.validated.body));
}

export async function archive(req, res) {
  return ok(res, await businessesService.archiveBusiness(req.validated.params.id));
}
