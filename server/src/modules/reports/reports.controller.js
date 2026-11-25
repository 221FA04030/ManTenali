import * as reportsService from './reports.service.js';
import { ok, created } from '../../common/utils/response.js';

export async function create(req, res) {
  return created(res, await reportsService.create(req.user, req.validated.body));
}
export async function adminList(req, res) {
  const { items, meta } = await reportsService.adminList(req.validated.query);
  return ok(res, items, meta);
}
export async function act(req, res) {
  return ok(res, await reportsService.act(req.user, req.validated.params.id, req.validated.body));
}
