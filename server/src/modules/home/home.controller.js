import * as homeService from './home.service.js';
import { ok } from '../../common/utils/response.js';

export async function feed(req, res) {
  return ok(res, await homeService.getFeed(req.validated.query));
}
