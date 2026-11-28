import { Event, EVENT_STATUS, PUBLIC_STATUSES, SUBMITTER_EDITABLE, MAX_EVENT_DAYS } from './events.model.js';
import * as evidenceService from './evidence.service.js';
import * as categoriesService from '../categories/categories.service.js';
import * as businessesService from '../businesses/businesses.service.js';
import * as usersService from '../users/users.service.js';
import { assertOwnImage } from '../media/media.service.js';
import { AppError } from '../../common/errors/index.js';
import { getPagination, buildMeta } from '../../common/utils/pagination.js';
import { generateUniqueSlug } from '../../common/utils/slug.js';
import { toPoint, fromPoint, kmToMeters, clampRadiusKm, distanceMeters } from '../../common/utils/geo.js';
import { matchFilter, relevance, rankPage, CANDIDATE_LIMIT } from '../../common/utils/textSearch.js';
import { istDateTime, istStartOfDay, istEndOfDay, toIstDateTime } from '../../common/utils/dates.js';
import { escapeRegex } from '../../common/utils/validators.js';
import { getEnv } from '../../config/env.js';
import { ROLES } from '../../config/constants.js';
import { listForModeration, moderationRow, markArchived, markRestored, unusedImageIds } from '../../common/utils/moderation.js';

const S = EVENT_STATUS;
const DAY_MS = 86_400_000;
const RESERVED_SLUGS = new Set(['submissions', 'mine', 'new', 'admin', 'submit']);
export const SUBMISSION_LIMITS = Object.freeze({ perDay: 3, open: 5 });
const PAST_WINDOW_DAYS = 90;
const LOG_CAP = 100;

const isAdmin = (user) => user?.role === ROLES.ADMIN;

/* ----------------------------- DTOs ----------------------------- */

/** PUBLIC shape: fixed allow-list. No submitter, review, log or evidence fields. */
function toPublicDTO(e, { categories, businesses }) {
  return {
    id: String(e._id),
    slug: e.slug,
    title: e.title,
    description: e.description ?? '',
    category: categories.get(String(e.categoryId)) ?? null,
    startAt: e.startAt,
    endAt: e.endAt,
    startLocal: toIstDateTime(e.startAt),
    endLocal: toIstDateTime(e.endAt),
    allDay: Boolean(e.allDay),
    venue: { name: e.venue.name, address: e.venue.address, area: e.venue.area },
    location: fromPoint(e.location),
    bannerImage: e.bannerImage ?? null,
    bookingUrl: e.bookingUrl ?? null,
    priceInfo: e.priceInfo ?? null,
    organizerName: e.organizerName,
    business: e.businessId ? (businesses.get(String(e.businessId)) ?? null) : null,
    isCancelled: e.status === S.CANCELLED,
    cancelReason: e.status === S.CANCELLED ? (e.cancelReason ?? null) : null,
    isSeed: Boolean(e.isSeed),
    updatedAt: e.updatedAt,
  };
}

/** Submitter's view of their own submission (adds status and the latest review note). */
function toSubmissionDTO(e, lookups, evidence) {
  return {
    ...toPublicDTO(e, lookups),
    status: e.status,
    source: e.source,
    revision: e.revision,
    submittedAt: e.submittedAt ?? null,
    lastSubmittedAt: e.lastSubmittedAt ?? null,
    review: e.review ? { outcome: e.review.outcome, note: e.review.note ?? null, reviewedAt: e.review.reviewedAt ?? null } : null,
    canEdit: SUBMITTER_EDITABLE.includes(e.status),
    evidence,
  };
}

async function lookups(events, { publishedOnly = true } = {}) {
  const [categories, businesses] = await Promise.all([
    categoriesService.getSummariesByIds(events.map((e) => e.categoryId)),
    businessesService.getSummariesByIds(events.map((e) => e.businessId).filter(Boolean), { publishedOnly }),
  ]);
  return { categories, businesses };
}

/* ----------------------------- helpers ----------------------------- */

/**
 * IST date+time strings -> UTC instants. All-day events run 00:00-23:59:59.999 IST.
 * End must not be before start; at most 90 days.
 */
function resolveTimes(startLocal, endLocal, allDay) {
  const startAt = allDay ? istStartOfDay(startLocal.slice(0, 10)) : istDateTime(startLocal);
  const endAt = allDay ? istEndOfDay(endLocal.slice(0, 10)) : istDateTime(endLocal);
  const details = [];
  if (endAt < startAt) details.push({ field: 'body.endAt', message: 'The end must not be before the start' });
  else if (endAt.getTime() - startAt.getTime() > MAX_EVENT_DAYS * DAY_MS) {
    details.push({ field: 'body.endAt', message: `An event can last at most ${MAX_EVENT_DAYS} days` });
  }
  if (details.length) throw AppError.validation('Check the event dates.', details);
  return { startAt, endAt };
}

function assertNotOver(endAt) {
  if (endAt <= new Date()) {
    throw AppError.validation('This event has already ended.', [{ field: 'body.endAt', message: 'The event has already ended' }]);
  }
}

function log(doc, user, action, fromStatus, toStatus, note) {
  doc.moderationLog.push({ action, actorId: user.id, actorRole: user.role, at: new Date(), fromStatus, toStatus, note });
  if (doc.moderationLog.length > LOG_CAP) doc.moderationLog = doc.moderationLog.slice(-LOG_CAP);
}

/** Validate and apply editable fields (shared by submitters and admins). */
async function applyFields(doc, input) {
  // An unchanged category is kept even if it was deactivated later; a new one must be active (D7.14).
  if (input.categoryId !== undefined && input.categoryId !== String(doc.categoryId ?? '')) {
    await categoriesService.assertActiveCategory(input.categoryId, 'event');
    doc.categoryId = input.categoryId;
  }
  if (input.businessId !== undefined) {
    if (input.businessId === null) doc.businessId = undefined;
    else {
      await businessesService.assertPublished(input.businessId, 'body.businessId');
      doc.businessId = input.businessId;
    }
  }
  if (input.startAt !== undefined || input.endAt !== undefined || input.allDay !== undefined) {
    const allDay = input.allDay ?? doc.allDay ?? false;
    const start = input.startAt ?? toIstDateTime(doc.startAt);
    const end = input.endAt ?? toIstDateTime(doc.endAt);
    Object.assign(doc, resolveTimes(start, end, allDay), { allDay });
  }
  if (input.title !== undefined) doc.title = input.title; // slug is permanent
  if (input.description !== undefined) doc.description = input.description || undefined;
  if (input.venue !== undefined) doc.venue = input.venue;
  if (input.location !== undefined) doc.location = input.location ? toPoint(input.location.lat, input.location.lng) : undefined;
  if (input.bookingUrl !== undefined) doc.bookingUrl = input.bookingUrl || undefined;
  if (input.priceInfo !== undefined) doc.priceInfo = input.priceInfo || undefined;
  if (input.organizerName !== undefined) doc.organizerName = input.organizerName;
  if (input.bannerImage !== undefined) {
    doc.bannerImage = input.bannerImage ? assertOwnImage(input.bannerImage, 'event_banner', 'body.bannerImage') : undefined;
  }
}

async function slugFor(title) {
  return generateUniqueSlug(title, async (s) => RESERVED_SLUGS.has(s) || Boolean(await Event.exists({ slug: s })));
}

/* ----------------------------- public reads ----------------------------- */

/**
 * FR-EVT-1: published events (and cancelled ones, labelled) that haven't ended.
 * `includePast` also shows events that ended in the last 90 days.
 * Date range = events overlapping [from 00:00 IST, to 23:59 IST].
 */
export async function listPublic(query, now = new Date()) {
  const { page, limit, skip } = getPagination(query);
  const lowerBounds = [query.includePast ? new Date(now.getTime() - PAST_WINDOW_DAYS * DAY_MS) : now];
  if (query.from) lowerBounds.push(istStartOfDay(query.from));
  const filter = {
    status: { $in: PUBLIC_STATUSES },
    endAt: { $gte: new Date(Math.max(...lowerBounds.map((d) => d.getTime()))) },
  };
  if (query.to) filter.startAt = { $lte: istEndOfDay(query.to) };
  if (query.categoryId) filter.categoryId = query.categoryId;
  if (query.area) filter['venue.area'] = query.area;
  if (query.lat !== undefined && query.lng !== undefined) {
    filter.location = { $geoWithin: { $centerSphere: [[query.lng, query.lat], kmToMeters(clampRadiusKm(query.radiusKm)) / 6_378_100] } };
  }
  const sort = query.includePast ? { startAt: -1, _id: 1 } : { startAt: 1, _id: 1 };
  const [items, total] = await Promise.all([
    Event.find(filter).select('-moderationLog -review -submittedBy -createdBy').sort(sort).skip(skip).limit(limit).lean(),
    Event.countDocuments(filter),
  ]);
  const lk = await lookups(items);
  return { items: items.map((e) => toPublicDTO(e, lk)), meta: buildMeta({ page, limit, total }) };
}

/* ----------------------------- search and home (Step 8) ----------------------------- */

const SEARCH_FIELDS = ['title', 'description', 'venue.name', 'venue.area', 'organizerName'];

/**
 * FR-SRCH-1/2: public events (published, or cancelled with its label) that
 * haven't ended, matching every query word (title, description, venue,
 * organiser) or whose category matches the query (C6: public statuses only).
 * Area / near-me filters; relevance or distance order (events without a map
 * point sort last by distance).
 */
export async function searchPublic({ tokens, fuzzy = false, query = '', categoryIds = [], area, lat, lng, radiusKm, sort, page = 1, limit = 20 }, now = new Date()) {
  const alsoMatch = categoryIds.length ? [{ categoryId: { $in: categoryIds } }] : [];
  const filter = { status: { $in: PUBLIC_STATUSES }, endAt: { $gte: now }, ...matchFilter(tokens, SEARCH_FIELDS, { fuzzy, alsoMatch }) };
  if (area) filter['venue.area'] = area;
  const here = lat !== undefined && lng !== undefined ? { lat, lng } : null;
  if (here) filter.location = { $geoWithin: { $centerSphere: [[lng, lat], kmToMeters(clampRadiusKm(radiusKm)) / 6_378_100] } };
  const candidates = await Event.find(filter)
    .select('-moderationLog -review -submittedBy -createdBy')
    .sort({ startAt: 1, _id: 1 })
    .limit(CANDIDATE_LIMIT)
    .lean();
  const catSet = new Set(categoryIds.map(String));
  const rows = candidates.map((e, order) => ({
    e,
    order,
    distanceM: here && e.location ? distanceMeters(here, fromPoint(e.location)) : undefined,
    score: relevance(
      tokens,
      { primary: e.title, secondary: [e.description, e.venue?.name, e.venue?.area, e.organizerName], categoryMatch: catSet.has(String(e.categoryId)) },
      { fuzzy, query },
    ),
  }));
  const ranked = rankPage(rows, { page, limit, byDistance: sort === 'distance' && Boolean(here) });
  const lk = await lookups(ranked.page.map((r) => r.e));
  return {
    items: ranked.page.map((r) => ({ ...toPublicDTO(r.e, lk), ...(r.distanceM !== undefined ? { distanceM: r.distanceM } : {}) })),
    total: ranked.total,
    capped: ranked.capped,
  };
}

/** Home feed: the next published events that haven't ended (never cancelled ones), soonest first. */
export async function nextUpcoming(limit = 3, now = new Date()) {
  const items = await Event.find({ status: S.PUBLISHED, endAt: { $gte: now } })
    .select('-moderationLog -review -submittedBy -createdBy')
    .sort({ startAt: 1, _id: 1 })
    .limit(limit)
    .lean();
  const lk = await lookups(items);
  return items.map((e) => toPublicDTO(e, lk));
}

/**
 * FR-EVT-2: detail by slug. Public only when published or cancelled. Admins may
 * preview any status (with `status`). Everyone else: 404, even with the slug.
 */
export async function getBySlug(slug, user) {
  const e = await Event.findOne({ slug }).lean();
  if (!e) throw AppError.notFound('Event not found.');
  const isPublic = PUBLIC_STATUSES.includes(e.status);
  if (!isPublic && !isAdmin(user)) throw AppError.notFound('Event not found.');
  const dto = toPublicDTO(e, await lookups([e], { publishedOnly: true }));
  return isAdmin(user) ? { ...dto, status: e.status } : dto;
}

/* ----------------------------- submitters ----------------------------- */

async function loadOwn(user, id) {
  const e = await Event.findOne({ _id: id, submittedBy: user.id });
  if (!e) throw AppError.notFound('Submission not found.');
  return e;
}

function assertEditable(e) {
  if (!SUBMITTER_EDITABLE.includes(e.status)) {
    throw AppError.conflict('This submission can no longer be changed.');
  }
}

/** Anyone signed in submits an event with evidence; it stays private as pending_review. */
export async function submitEvent(user, input) {
  const since = new Date(Date.now() - DAY_MS);
  const [today, open] = await Promise.all([
    Event.countDocuments({ submittedBy: user.id, submittedAt: { $gte: since } }),
    Event.countDocuments({ submittedBy: user.id, status: { $in: SUBMITTER_EDITABLE } }),
  ]);
  if (today >= SUBMISSION_LIMITS.perDay) {
    throw new AppError('RATE_LIMITED', `You can submit at most ${SUBMISSION_LIMITS.perDay} events per day.`);
  }
  if (open >= SUBMISSION_LIMITS.open) {
    throw AppError.conflict(`You already have ${SUBMISSION_LIMITS.open} submissions waiting. Please wait for a decision.`);
  }

  const now = new Date();
  const doc = new Event({ slug: 'pending', source: 'community', status: S.PENDING, createdBy: user.id, submittedBy: user.id, moderationLog: [] });
  await applyFields(doc, { allDay: false, ...input, evidence: undefined });
  assertNotOver(doc.endAt);
  const verified = await evidenceService.verifyUploads(user, input.evidence);

  doc.slug = await slugFor(input.title);
  doc.submittedAt = now;
  doc.lastSubmittedAt = now;
  doc.revision = 1;
  log(doc, user, 'submitted', undefined, S.PENDING);
  await doc.save();
  try {
    await evidenceService.attachVerified(doc._id, user, verified);
  } catch (err) {
    await Event.deleteOne({ _id: doc._id }); // never accepted without its evidence
    throw err;
  }
  return getSubmission(user, doc._id);
}

export async function listMine(user) {
  const items = await Event.find({ submittedBy: user.id }).select('-moderationLog').sort({ updatedAt: -1 }).limit(100).lean();
  const lk = await lookups(items, { publishedOnly: false });
  return items.map((e) => toSubmissionDTO(e, lk, undefined));
}

export async function getSubmission(user, id) {
  const e = await Event.findOne({ _id: id, submittedBy: user.id }).lean();
  if (!e) throw AppError.notFound('Submission not found.');
  return toSubmissionDTO(e, await lookups([e], { publishedOnly: false }), await evidenceService.listForEvent(e._id));
}

/** Submitter edits while pending review or changes requested (stays in that status). */
export async function updateSubmission(user, id, input) {
  const doc = await loadOwn(user, id);
  assertEditable(doc);
  await applyFields(doc, input);
  if (input.startAt !== undefined || input.endAt !== undefined || input.allDay !== undefined) assertNotOver(doc.endAt);
  log(doc, user, 'edited', doc.status, doc.status);
  await doc.save();
  return getSubmission(user, id);
}

/** changes_requested -> pending_review (back in the queue; keeps its original place). */
export async function resubmit(user, id) {
  const doc = await loadOwn(user, id);
  if (doc.status !== S.CHANGES) throw AppError.conflict('Only submissions with requested changes can be resubmitted.');
  if ((await evidenceService.countActive(doc._id)) < 1) throw AppError.conflict('Add at least one evidence file first.');
  assertNotOver(doc.endAt);
  log(doc, user, 'resubmitted', doc.status, S.PENDING);
  doc.status = S.PENDING;
  doc.revision += 1;
  doc.lastSubmittedAt = new Date();
  await doc.save();
  return getSubmission(user, id);
}

export async function withdraw(user, id) {
  const doc = await loadOwn(user, id);
  assertEditable(doc);
  log(doc, user, 'withdrawn', doc.status, S.WITHDRAWN);
  doc.status = S.WITHDRAWN;
  await doc.save();
  return getSubmission(user, id);
}

export async function addEvidence(user, id, item) {
  const doc = await loadOwn(user, id);
  assertEditable(doc);
  const added = await evidenceService.addOne(doc._id, user, item);
  log(doc, user, 'evidence_added', doc.status, doc.status, item.kind);
  await doc.save();
  return added;
}

export async function removeEvidence(user, id, evidenceId) {
  const doc = await loadOwn(user, id);
  assertEditable(doc);
  const removed = await evidenceService.removeOne(doc._id, evidenceId, user);
  log(doc, user, 'evidence_removed', doc.status, doc.status, removed.kind);
  await doc.save();
  return removed;
}

/** Short-lived evidence links: the submitter of the event or an admin only; everyone else 404. */
export async function evidenceAccess(user, id, evidenceId) {
  const filter = isAdmin(user) ? { _id: id } : { _id: id, submittedBy: user.id };
  if (!(await Event.exists(filter))) throw AppError.notFound('Evidence not found.');
  return evidenceService.accessLinks(id, evidenceId);
}

/* ----------------------------- admin ----------------------------- */

async function loadForAdmin(id) {
  const doc = await Event.findById(id);
  if (!doc) throw AppError.notFound('Event not found.');
  return doc;
}

function toAdminRow(e, contacts) {
  return {
    id: String(e._id),
    slug: e.slug,
    title: e.title,
    status: e.status,
    source: e.source,
    startAt: e.startAt,
    startLocal: toIstDateTime(e.startAt),
    area: e.venue?.area ?? null,
    revision: e.revision,
    submittedAt: e.submittedAt ?? null,
    lastSubmittedAt: e.lastSubmittedAt ?? null,
    submitter: e.submittedBy ? (contacts.get(String(e.submittedBy)) ?? null) : null,
    updatedAt: e.updatedAt,
  };
}

/** Full moderation view: submitter contact, review, history and evidence metadata. */
export async function getForAdmin(id) {
  const e = await Event.findById(id).lean();
  if (!e) throw AppError.notFound('Event not found.');
  const ids = [e.submittedBy, e.review?.reviewedBy, ...e.moderationLog.map((l) => l.actorId)].filter(Boolean).map(String);
  const [lk, contacts, evidence] = await Promise.all([
    lookups([e], { publishedOnly: false }),
    usersService.getAdminContactsByIds([...new Set(ids)]),
    evidenceService.listForEvent(e._id, { includeRemoved: true }),
  ]);
  const nameOf = (uid) => (uid ? (contacts.get(String(uid))?.name ?? null) : null);
  return {
    ...toSubmissionDTO(e, lk, evidence),
    businessId: e.businessId ? String(e.businessId) : null,
    submitter: e.submittedBy ? (contacts.get(String(e.submittedBy)) ?? null) : null,
    review: e.review ? { ...e.review, reviewedBy: nameOf(e.review.reviewedBy) } : null,
    publishedAt: e.publishedAt ?? null,
    moderationLog: e.moderationLog.map((l) => ({ ...l, actorId: undefined, actor: nameOf(l.actorId) })),
  };
}

export async function adminList({ status, q, page, limit }) {
  const p = getPagination({ page, limit });
  const filter = {};
  if (status) filter.status = status;
  if (q) filter.title = new RegExp(escapeRegex(q), 'i');
  const [items, total] = await Promise.all([
    Event.find(filter).select('-moderationLog').sort({ updatedAt: -1 }).skip(p.skip).limit(p.limit).lean(),
    Event.countDocuments(filter),
  ]);
  const contacts = await usersService.getAdminContactsByIds(items.map((e) => e.submittedBy).filter(Boolean));
  return { items: items.map((e) => toAdminRow(e, contacts)), meta: buildMeta({ ...p, total }) };
}

/** Moderation queue: community submissions by status; pending oldest first. */
export async function queue({ status, page, limit }) {
  const p = getPagination({ page, limit });
  const filter = { source: 'community', status };
  const sort = status === S.PENDING ? { submittedAt: 1, _id: 1 } : { updatedAt: -1 };
  const [items, total] = await Promise.all([
    Event.find(filter).select('-moderationLog').sort(sort).skip(p.skip).limit(p.limit).lean(),
    Event.countDocuments(filter),
  ]);
  const contacts = await usersService.getAdminContactsByIds(items.map((e) => e.submittedBy).filter(Boolean));
  return { items: items.map((e) => toAdminRow(e, contacts)), meta: buildMeta({ ...p, total }) };
}

function setReview(doc, admin, outcome, note) {
  doc.review = { outcome, note, reviewedBy: admin.id, reviewedAt: new Date() };
}

export async function approve(admin, id, { bannerImage } = {}) {
  const doc = await loadForAdmin(id);
  if (doc.status !== S.PENDING) throw AppError.conflict('Only submissions pending review can be approved.');
  assertNotOver(doc.endAt);
  if (bannerImage) doc.bannerImage = assertOwnImage(bannerImage, 'event_banner', 'body.bannerImage');
  setReview(doc, admin, 'approved');
  log(doc, admin, 'approved', doc.status, S.PUBLISHED);
  doc.status = S.PUBLISHED;
  doc.publishedAt = new Date();
  doc.publishedBy = admin.id;
  await doc.save();
  return getForAdmin(id);
}

export async function reject(admin, id, reason) {
  const doc = await loadForAdmin(id);
  if (doc.status !== S.PENDING) throw AppError.conflict('Only submissions pending review can be rejected.');
  setReview(doc, admin, 'rejected', reason);
  log(doc, admin, 'rejected', doc.status, S.REJECTED, reason);
  doc.status = S.REJECTED;
  await doc.save();
  return getForAdmin(id);
}

export async function requestChanges(admin, id, note) {
  const doc = await loadForAdmin(id);
  if (doc.status !== S.PENDING) throw AppError.conflict('Changes can only be requested for submissions pending review.');
  setReview(doc, admin, 'changes_requested', note);
  log(doc, admin, 'changes_requested', doc.status, S.CHANGES, note);
  doc.status = S.CHANGES;
  await doc.save();
  return getForAdmin(id);
}

/** FR-EVT-3: admins create events directly (draft or published, no review). */
export async function adminCreate(admin, input) {
  const doc = new Event({ slug: 'pending', source: 'admin', createdBy: admin.id, moderationLog: [] });
  await applyFields(doc, { allDay: false, ...input, status: undefined });
  assertNotOver(doc.endAt);
  doc.slug = await slugFor(input.title);
  doc.status = input.status ?? S.DRAFT;
  if (doc.status === S.PUBLISHED) {
    doc.publishedAt = new Date();
    doc.publishedBy = admin.id;
  }
  log(doc, admin, 'created', undefined, doc.status);
  await doc.save();
  return getForAdmin(doc._id);
}

/** Allowed admin status changes through PATCH (review uses its own endpoints). */
const ADMIN_TRANSITIONS = {
  [S.PUBLISHED]: [S.DRAFT, S.CANCELLED, S.HIDDEN],
  [S.CANCELLED]: [S.PUBLISHED],
  [S.HIDDEN]: [S.PUBLISHED, S.CANCELLED],
};
const FINAL = [S.REJECTED, S.WITHDRAWN, S.ARCHIVED];

/** Admin edit / publish / cancel / hide / restore. */
export async function adminUpdate(admin, id, input) {
  const doc = await loadForAdmin(id);
  if (FINAL.includes(doc.status)) throw AppError.conflict('This event can no longer be changed.');
  const target = input.status;
  if (target !== undefined && target !== doc.status) {
    if (SUBMITTER_EDITABLE.includes(doc.status)) {
      throw AppError.conflict('Use approve, reject or request changes for submissions under review.');
    }
    if (!(ADMIN_TRANSITIONS[target] ?? []).includes(doc.status)) {
      throw AppError.conflict(`An event can't change from ${doc.status} to ${target}.`);
    }
  }
  await applyFields(doc, { ...input, status: undefined, cancelReason: undefined });
  const from = doc.status;
  if (target !== undefined && target !== from) {
    if (target === S.PUBLISHED) {
      assertNotOver(doc.endAt);
      doc.publishedAt ??= new Date();
      doc.publishedBy ??= admin.id;
      doc.cancelledAt = undefined;
      doc.cancelReason = undefined;
    }
    if (target === S.CANCELLED) {
      doc.cancelledAt = new Date();
      doc.cancelReason = input.cancelReason || undefined;
    }
    doc.status = target;
    log(doc, admin, target === S.CANCELLED ? 'cancelled' : target === S.HIDDEN ? 'hidden' : 'published', from, target, input.cancelReason);
  } else {
    if (input.cancelReason !== undefined && doc.status === S.CANCELLED) doc.cancelReason = input.cancelReason || undefined;
    log(doc, admin, 'edited_by_admin', from, from);
  }
  await doc.save();
  return getForAdmin(id);
}

/** DELETE = remove (archived). Soft delete: the record and its history are kept. */
export async function adminRemove(admin, id) {
  const doc = await loadForAdmin(id);
  if (doc.status === S.ARCHIVED) throw AppError.conflict('Already removed.');
  log(doc, admin, 'removed', doc.status, S.ARCHIVED);
  doc.status = S.ARCHIVED;
  await doc.save();
  return { id: String(doc._id), status: doc.status };
}

/* ----------------------------- Step 9: favorites, reports ----------------------------- */

/** Public events by id (published or cancelled, past ones included) as public DTOs (Saved page). */
export async function getPublicByIds(ids) {
  if (!ids.length) return new Map();
  const items = await Event.find({ _id: { $in: ids }, status: { $in: PUBLIC_STATUSES } })
    .select('-moderationLog -review -submittedBy -createdBy')
    .lean();
  const lk = await lookups(items);
  return new Map(items.map((e) => [String(e._id), toPublicDTO(e, lk)]));
}

/** Moderation view for reports (any status). Responsible user = the community submitter, if any. */
export async function moderationInfo(ids) {
  if (!ids.length) return new Map();
  const items = await Event.find({ _id: { $in: ids } }).select('title slug status submittedBy').lean();
  return new Map(
    items.map((e) => [
      String(e._id),
      { title: e.title, slug: e.slug, status: e.status, isPublic: PUBLIC_STATUSES.includes(e.status), responsibleUserId: e.submittedBy ? String(e.submittedBy) : null },
    ]),
  );
}

/** Step 10 metrics: public events that have not ended, and how many were updated since `since`. */
export async function freshness(since, now = new Date()) {
  const base = { status: { $in: PUBLIC_STATUSES }, endAt: { $gte: now } };
  const [total, fresh] = await Promise.all([Event.countDocuments(base), Event.countDocuments({ ...base, updatedAt: { $gte: since } })]);
  return { total, fresh };
}

/* ----------------------------- development seed ----------------------------- */

/** Sample events for local development only - refused in production. Idempotent by slug. */
/* ------------------------- evidence retention ------------------------- */

export const EVIDENCE_RETENTION_DAYS = 180;
const DECISION_ACTIONS = new Set(['approved', 'rejected', 'withdrawn', 'removed']);
const DECIDED_STATUSES = [S.PUBLISHED, S.CANCELLED, S.HIDDEN, S.REJECTED, S.WITHDRAWN, S.ARCHIVED];

/** When the final decision on an event was made (approve, reject, withdraw or remove). */
function decidedAt(e) {
  const entry = [...(e.moderationLog ?? [])].reverse().find((l) => DECISION_ACTIONS.has(l.action));
  return entry?.at ?? e.review?.reviewedAt ?? e.updatedAt;
}

/**
 * Evidence retention (manual: `npm run cleanup:evidence`). Finds decided
 * events whose final decision is older than `days` and that still hold
 * evidence files; with `apply` deletes those files. Pending and
 * changes-requested submissions are never touched.
 */
export async function purgeExpiredEvidence({ days = EVIDENCE_RETENTION_DAYS, apply = false, now = new Date() } = {}) {
  const cutoff = new Date(now.getTime() - days * 86_400_000);
  const candidates = await Event.find({ source: 'community', status: { $in: DECIDED_STATUSES } })
    .select('_id status moderationLog review updatedAt')
    .lean();
  const due = candidates.filter((e) => decidedAt(e) < cutoff);
  const withFiles = new Set((await evidenceService.eventIdsWithActiveEvidence(due.map((e) => e._id))).map(String));
  const targets = due.filter((e) => withFiles.has(String(e._id)));
  let files = 0;
  if (apply) {
    for (const e of targets) files += await evidenceService.purgeForEvent(e._id);
  }
  return { cutoff, events: targets.length, files, applied: apply };
}

export async function seedEvents(list, categoryIdBySlug, now = new Date()) {
  if (getEnv().isProduction) throw new Error('Sample data cannot be seeded in production.');
  let created = 0;
  for (const item of list) {
    if (await Event.exists({ slug: item.slug })) continue;
    const categoryId = categoryIdBySlug.get(item.categorySlug);
    if (!categoryId) continue;
    const day = toIstDateTime(new Date(now.getTime() + item.startsInDays * DAY_MS)).slice(0, 10);
    const startAt = istDateTime(`${day}T${String(item.startHourIst).padStart(2, '0')}:00`);
    const endAt = new Date(startAt.getTime() + item.hours * 3_600_000);
    const { categorySlug: _c, startsInDays: _s, startHourIst: _h, hours: _d, lat, lng, ...rest } = item;
    await Event.create({
      ...rest,
      categoryId,
      startAt,
      endAt,
      location: lat !== undefined ? toPoint(lat, lng) : undefined,
      status: S.PUBLISHED,
      source: 'admin',
      isSeed: true,
      publishedAt: now,
    });
    created += 1;
  }
  return { created, skipped: list.length - created };
}

/* ----------------------------- admin moderation (archive / restore / delete) ----------------------------- */
const MOD = {
  hiddenStatus: S.HIDDEN,
  publicStatuses: PUBLIC_STATUSES,
  titleField: 'title',
  authorFields: ['submittedBy', 'createdBy'],
  select: 'title slug status submittedBy createdBy moderation startAt publishedAt createdAt updatedAt',
};
const RESTORABLE = [S.PUBLISHED, S.CANCELLED, S.DRAFT, S.PENDING, S.CHANGES];
const modRow = (e) => ({ ...moderationRow(e, MOD), title: e.title, slug: e.slug, startAt: e.startAt, publishedAt: e.publishedAt ?? null });

/** Moderation dashboard rows, any status. */
export async function moderationRows(query) {
  const { items, total } = await listForModeration(Event, MOD, query);
  return { items: items.map(modRow), total };
}

/** Admin: take an event off the website (kept, restorable; written to its history). */
export async function adminArchive(admin, id, reason) {
  const doc = await loadForAdmin(id);
  const from = doc.status;
  markArchived(doc, { admin, reason, hiddenStatus: S.HIDDEN, fallbackStatus: S.PUBLISHED, removedStatuses: [S.ARCHIVED, S.WITHDRAWN, S.REJECTED] });
  log(doc, admin, 'hidden', from, doc.status, reason);
  await doc.save();
  return modRow(doc.toObject());
}

export async function adminRestore(admin, id) {
  const doc = await loadForAdmin(id);
  const from = doc.status;
  markRestored(doc, { hiddenStatus: S.HIDDEN, fallbackStatus: S.PUBLISHED, allowedStatuses: RESTORABLE });
  log(doc, admin, 'restored', from, doc.status);
  await doc.save();
  return modRow(doc.toObject());
}

/** Admin: delete the event record and its private evidence files. Returns its banner id when unused elsewhere. */
export async function adminPurge(id) {
  const doc = await Event.findById(id).select('title bannerImage').lean();
  if (!doc) throw AppError.notFound('Event not found.');
  await evidenceService.deleteForEvent(doc._id);
  await Event.deleteOne({ _id: doc._id });
  return { title: doc.title, images: await unusedImageIds(Event, 'bannerImage.publicId', [doc.bannerImage?.publicId]) };
}

/** Business deletion: events keep their own organiser name and venue; only the link goes. */
export async function detachBusiness(businessId) {
  await Event.updateMany({ businessId }, { $unset: { businessId: 1 } }, { timestamps: false });
}
