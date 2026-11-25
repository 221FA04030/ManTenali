import * as eventsService from './events.service.js';
import { ok, created } from '../../common/utils/response.js';

const v = (req) => req.validated;

// Public
export async function list(req, res) {
  const { items, meta } = await eventsService.listPublic(v(req).query);
  return ok(res, items, meta);
}
export async function detail(req, res) {
  return ok(res, await eventsService.getBySlug(v(req).params.slug, req.user));
}

// Submitters
export async function submit(req, res) {
  return created(res, await eventsService.submitEvent(req.user, v(req).body));
}
export async function mine(req, res) {
  return ok(res, await eventsService.listMine(req.user));
}
export async function getSubmission(req, res) {
  return ok(res, await eventsService.getSubmission(req.user, v(req).params.id));
}
export async function updateSubmission(req, res) {
  return ok(res, await eventsService.updateSubmission(req.user, v(req).params.id, v(req).body));
}
export async function resubmit(req, res) {
  return ok(res, await eventsService.resubmit(req.user, v(req).params.id));
}
export async function withdraw(req, res) {
  return ok(res, await eventsService.withdraw(req.user, v(req).params.id));
}
export async function addEvidence(req, res) {
  return created(res, await eventsService.addEvidence(req.user, v(req).params.id, v(req).body));
}
export async function removeEvidence(req, res) {
  return ok(res, await eventsService.removeEvidence(req.user, v(req).params.id, v(req).params.evidenceId));
}
export async function evidenceAccess(req, res) {
  // Short-lived signed links: never cache them anywhere.
  res.set('Cache-Control', 'no-store');
  return ok(res, await eventsService.evidenceAccess(req.user, v(req).params.id, v(req).params.evidenceId));
}

// Admin (event management)
export async function adminCreate(req, res) {
  return created(res, await eventsService.adminCreate(req.user, v(req).body));
}
export async function adminUpdate(req, res) {
  return ok(res, await eventsService.adminUpdate(req.user, v(req).params.id, v(req).body));
}
export async function adminRemove(req, res) {
  return ok(res, await eventsService.adminRemove(req.user, v(req).params.id));
}
