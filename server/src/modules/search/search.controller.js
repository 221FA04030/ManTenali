import * as searchService from './search.service.js';
import { ok } from '../../common/utils/response.js';

export async function search(req, res) {
  const { data, meta } = await searchService.search(req.validated.query);
  return ok(res, data, meta);
}

export async function suggest(req, res) {
  return ok(res, await searchService.suggest(req.validated.query.q));
}
