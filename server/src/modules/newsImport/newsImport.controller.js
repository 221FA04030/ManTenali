import { createHash, timingSafeEqual } from 'node:crypto';
import * as service from './newsImport.service.js';
import { ok, sendSuccess } from '../../common/utils/response.js';
import { AppError } from '../../common/errors/index.js';
import { getEnv } from '../../config/env.js';

export const startFetch = async (req, res) => sendSuccess(res, await service.startManualFetch(req.user), { status: 202 });
export const latestRun = async (_req, res) => ok(res, await service.latestRun());
export const getRun = async (req, res) => ok(res, await service.getRun(req.validated.params.id));

export async function list(req, res) {
  const { items, meta } = await service.list(req.validated.query);
  return ok(res, items, meta);
}
export const get = async (req, res) => ok(res, await service.get(req.validated.params.id));
export const saveDraft = async (req, res) => ok(res, await service.saveDraft(req.user, req.validated.params.id, req.validated.body));
export const publish = async (req, res) => ok(res, await service.publish(req.user, req.validated.params.id, req.validated.body));
export const reject = async (req, res) => ok(res, await service.reject(req.user, req.validated.params.id, req.validated.body));

/** Constant-time comparison of the shared secret (hashed first so lengths always match). */
function secretMatches(given, expected) {
  const a = createHash('sha256').update(String(given ?? '')).digest();
  const b = createHash('sha256').update(expected).digest();
  return timingSafeEqual(a, b);
}

/**
 * POST /integrations/apify/news-import - called by a scheduled Apify task's
 * webhook when its run succeeds. Off (404) until APIFY_WEBHOOK_SECRET is set.
 */
export async function apifyWebhook(req, res) {
  const secret = getEnv().APIFY_WEBHOOK_SECRET;
  if (!secret) throw AppError.notFound();
  if (!secretMatches(req.get('x-mana-tenali-secret'), secret)) throw AppError.unauthenticated('Invalid webhook secret.');
  const { eventType, resource } = req.validated.body;
  if (eventType !== 'ACTOR.RUN.SUCCEEDED' || !resource?.defaultDatasetId) {
    return ok(res, { ignored: true, reason: 'Only successful runs with a dataset are imported.' });
  }
  return sendSuccess(res, await service.startScheduledImport(resource.defaultDatasetId), { status: 202 });
}
