import * as categoriesService from './categories.service.js';
import { ok, created } from '../../common/utils/response.js';

export async function list(req, res) {
  return ok(res, await categoriesService.listCategories(req.validated.query, req.user));
}

export async function create(req, res) {
  return created(res, await categoriesService.createCategory(req.validated.body));
}

export async function update(req, res) {
  return ok(res, await categoriesService.updateCategory(req.validated.params.id, req.validated.body));
}
