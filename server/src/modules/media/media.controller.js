import * as mediaService from './media.service.js';
import { ok } from '../../common/utils/response.js';

export async function sign(req, res) {
  return ok(res, mediaService.signUpload(req.user, req.validated.body.purpose));
}
