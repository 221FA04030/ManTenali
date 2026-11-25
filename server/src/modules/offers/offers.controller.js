import * as offersService from './offers.service.js';
import { ok, created } from '../../common/utils/response.js';

export async function list(req, res) {
  const { items, meta } = await offersService.listPublic(req.validated.query);
  return ok(res, items, meta);
}

export async function listForBusiness(req, res) {
  const { items, meta } = await offersService.listForBusiness(req.validated.params.id, req.validated.query);
  return ok(res, items, meta);
}

export async function detail(req, res) {
  return ok(res, await offersService.getOffer(req.validated.params.id, req.user));
}

export async function manage(req, res) {
  return ok(res, await offersService.listForManagement(req.user, req.validated.query.businessId));
}

export async function create(req, res) {
  return created(res, await offersService.createOffer(req.user, req.validated.body));
}

export async function update(req, res) {
  return ok(res, await offersService.updateOffer(req.user, req.validated.params.id, req.validated.body));
}

export async function hide(req, res) {
  return ok(res, await offersService.hideOffer(req.user, req.validated.params.id));
}
