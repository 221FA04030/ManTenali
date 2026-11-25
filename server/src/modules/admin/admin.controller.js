import * as usersService from '../users/users.service.js';
import * as businessesService from '../businesses/businesses.service.js';
import * as eventsService from '../events/events.service.js';
import { ok } from '../../common/utils/response.js';

/**
 * Admin HTTP handlers. Each one calls exactly one service function of the
 * owning module; the admin module itself holds no business rules.
 */
export async function listUsers(req, res) {
  const { items, meta } = await usersService.listUsers(req.validated.query);
  return ok(res, items, meta);
}

export async function updateUser(req, res) {
  const user = await usersService.adminUpdateUser(req.user, req.validated.params.id, req.validated.body);
  return ok(res, user);
}

export async function listBusinesses(req, res) {
  const { items, meta } = await businessesService.adminList(req.validated.query);
  return ok(res, items, meta);
}

export async function verifyBusiness(req, res) {
  return ok(res, await businessesService.setVerified(req.validated.params.id, req.validated.body.isVerified));
}

export async function listSubmissions(req, res) {
  const { items, meta } = await businessesService.adminSubmissions(req.validated.query);
  return ok(res, items, meta);
}

export async function getSubmission(req, res) {
  return ok(res, await businessesService.adminGetSubmission(req.user, req.validated.params.id));
}

export async function approveSubmission(req, res) {
  return ok(res, await businessesService.approveSubmission(req.user, req.validated.params.id));
}

export async function rejectSubmission(req, res) {
  return ok(res, await businessesService.rejectSubmission(req.user, req.validated.params.id, req.validated.body.reason));
}

// Event moderation (community submissions) and event management lists
export async function eventQueue(req, res) {
  const { items, meta } = await eventsService.queue(req.validated.query);
  return ok(res, items, meta);
}

export async function eventForReview(req, res) {
  return ok(res, await eventsService.getForAdmin(req.validated.params.id));
}

export async function approveEvent(req, res) {
  return ok(res, await eventsService.approve(req.user, req.validated.params.id, req.validated.body));
}

export async function rejectEvent(req, res) {
  return ok(res, await eventsService.reject(req.user, req.validated.params.id, req.validated.body.reason));
}

export async function requestEventChanges(req, res) {
  return ok(res, await eventsService.requestChanges(req.user, req.validated.params.id, req.validated.body.note));
}

export async function listEvents(req, res) {
  const { items, meta } = await eventsService.adminList(req.validated.query);
  return ok(res, items, meta);
}
