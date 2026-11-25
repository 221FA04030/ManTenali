import * as analyticsService from './analytics.service.js';
import { ok, sendSuccess } from '../../common/utils/response.js';

/** 202 Accepted: the client never waits on analytics. */
export async function record(req, res) {
  return sendSuccess(res, await analyticsService.record(req.validated.body), { status: 202 });
}
export async function summary(req, res) {
  return ok(res, await analyticsService.summary(req.validated.query));
}
