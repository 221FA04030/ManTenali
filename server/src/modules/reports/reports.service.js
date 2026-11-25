import { Report, REPORT_STATUS } from './reports.model.js';
import * as businessesService from '../businesses/businesses.service.js';
import * as reviewsService from '../reviews/reviews.service.js';
import * as offersService from '../offers/offers.service.js';
import * as eventsService from '../events/events.service.js';
import * as newsService from '../news/news.service.js';
import * as usersService from '../users/users.service.js';
import { AppError } from '../../common/errors/index.js';
import { getPagination, buildMeta } from '../../common/utils/pagination.js';
import { getEnv } from '../../config/env.js';
import { ROLES } from '../../config/constants.js';

const ST = REPORT_STATUS;
const FINAL = [ST.ACTIONED, ST.DISMISSED];

/**
 * Each module describes its own content for moderation (title, status, whether
 * it is public, and the user responsible for it). This module never touches
 * another module's model.
 */
const INFO = {
  business: (ids) => businessesService.moderationInfo(ids),
  review: (ids) => reviewsService.moderationInfo(ids),
  offer: (ids) => offersService.moderationInfo(ids),
  event: (ids) => eventsService.moderationInfo(ids),
  news: (ids) => newsService.moderationInfo(ids),
};

/** Hiding goes through each module's own admin action, so its rules and history apply. */
const HIDE = {
  business: (admin, id) => businessesService.updateBusiness(admin, id, { status: 'hidden' }),
  review: (admin, id) => reviewsService.hide(admin, id),
  offer: (admin, id) => offersService.hideOffer(admin, id),
  event: (admin, id) => eventsService.adminUpdate(admin, id, { status: 'hidden' }),
  news: (admin, id) => newsService.update(admin, id, { status: 'hidden' }),
};

/* ----------------------------- users ----------------------------- */

/**
 * FR-REP-1: report content the reporter can see, or send a suggestion.
 * Hidden or missing content: 404 (no probing). The same person can't have two
 * open reports about the same thing (409).
 */
export async function create(user, input) {
  const isSuggestion = input.targetType === 'suggestion';
  if (!isSuggestion) {
    const info = (await INFO[input.targetType]([input.targetId])).get(String(input.targetId));
    if (!info?.isPublic) throw AppError.notFound('This item is not available.');
    const duplicate = await Report.exists({
      reporterId: user.id,
      targetType: input.targetType,
      targetId: input.targetId,
      status: { $in: [ST.OPEN, ST.REVIEWED] },
    });
    if (duplicate) throw AppError.conflict('You have already reported this. Our team will look at it.');
  }
  const r = await Report.create({
    reporterId: user.id,
    targetType: input.targetType,
    targetId: isSuggestion ? undefined : input.targetId,
    reason: input.reason,
    details: input.details || undefined,
  });
  // The reporter sees only that it was received - never moderation details.
  return { id: String(r._id), targetType: r.targetType, reason: r.reason, status: r.status, createdAt: r.createdAt };
}

/* ----------------------------- admin (FR-ADM-1) ----------------------------- */

async function targetInfo(reports) {
  const idsByType = {};
  for (const r of reports) if (r.targetId) (idsByType[r.targetType] ??= []).push(String(r.targetId));
  const entries = await Promise.all(Object.entries(idsByType).map(async ([type, ids]) => [type, await INFO[type](ids)]));
  return Object.fromEntries(entries);
}

function toAdminDTO(r, infoByType, contacts) {
  const info = r.targetId ? (infoByType[r.targetType]?.get(String(r.targetId)) ?? null) : null;
  const responsible = info?.responsibleUserId ?? (r.targetType === 'suggestion' ? String(r.reporterId) : null);
  return {
    id: String(r._id),
    targetType: r.targetType,
    targetId: r.targetId ? String(r.targetId) : null,
    // null when the content no longer exists (e.g. a review its author deleted).
    target: info ? { title: info.title, slug: info.slug ?? null, businessId: info.businessId ?? null, status: info.status, isPublic: info.isPublic } : null,
    reason: r.reason,
    details: r.details ?? '',
    status: r.status,
    reporter: contacts.get(String(r.reporterId)) ?? null,
    responsibleUser: responsible ? (contacts.get(responsible) ?? null) : null,
    handledBy: r.handledBy ? (contacts.get(String(r.handledBy))?.name ?? null) : null,
    handledAt: r.handledAt ?? null,
    resolution: r.resolution ?? null,
    createdAt: r.createdAt,
  };
}

async function hydrate(reports) {
  const infoByType = await targetInfo(reports);
  const userIds = new Set();
  for (const r of reports) {
    userIds.add(String(r.reporterId));
    if (r.handledBy) userIds.add(String(r.handledBy));
    const info = r.targetId ? infoByType[r.targetType]?.get(String(r.targetId)) : null;
    if (info?.responsibleUserId) userIds.add(info.responsibleUserId);
  }
  const contacts = await usersService.getAdminContactsByIds([...userIds]);
  return reports.map((r) => toAdminDTO(r, infoByType, contacts));
}

/** Moderation queue: by status (open by default), oldest first while open, newest first otherwise. */
export async function adminList({ status, targetType, page, limit }) {
  const p = getPagination({ page, limit });
  const filter = { status };
  if (targetType) filter.targetType = targetType;
  const sort = status === ST.OPEN || status === ST.REVIEWED ? { createdAt: 1, _id: 1 } : { handledAt: -1, _id: -1 };
  const [items, total] = await Promise.all([Report.find(filter).sort(sort).skip(p.skip).limit(p.limit).lean(), Report.countDocuments(filter)]);
  return { items: await hydrate(items), meta: buildMeta({ ...p, total }) };
}

/**
 * Dismiss, mark reviewed, hide the content, block the responsible user, or both.
 * Hiding uses the content module's own admin action. Blocking never applies to
 * admins (or yourself). Acting on content also closes the other open reports
 * about the same content.
 */
export async function act(admin, id, { action, note }) {
  const report = await Report.findById(id);
  if (!report) throw AppError.notFound('Report not found.');
  if (FINAL.includes(report.status)) throw AppError.conflict('This report has already been handled.');

  const hide = action === 'hide_target' || action === 'hide_and_block';
  const block = action === 'block_user' || action === 'hide_and_block';
  const info = report.targetId ? (await INFO[report.targetType]([report.targetId])).get(String(report.targetId)) : null;

  if (hide) {
    if (report.targetType === 'suggestion') throw AppError.conflict('A suggestion has no content to hide.');
    if (!info) throw AppError.conflict('The reported content no longer exists. Dismiss the report instead.');
    if (info.isPublic) await HIDE[report.targetType](admin, report.targetId);
  }
  if (block) {
    const userId = report.targetType === 'suggestion' ? String(report.reporterId) : info?.responsibleUserId;
    if (!userId) throw AppError.conflict('There is no user to block for this content.');
    const target = await usersService.assertUserExists(userId);
    if (target.role === ROLES.ADMIN) throw AppError.conflict('Admins cannot be blocked from a report.');
    await usersService.adminUpdateUser(admin, userId, { status: 'blocked' });
  }

  const status = action === 'dismiss' ? ST.DISMISSED : action === 'mark_reviewed' ? ST.REVIEWED : ST.ACTIONED;
  const handled = { status, handledBy: admin.id, handledAt: new Date(), resolution: { action, note: note || undefined } };
  Object.assign(report, handled);
  await report.save();
  if (status === ST.ACTIONED && report.targetId) {
    await Report.updateMany(
      { _id: { $ne: report._id }, targetType: report.targetType, targetId: report.targetId, status: { $in: [ST.OPEN, ST.REVIEWED] } },
      { $set: { ...handled, resolution: { action, note: `Handled with report ${report._id}` } } },
    );
  }
  return (await hydrate([report.toObject()]))[0];
}

/** Demo data only (local development); refused in production. Idempotent by (reporter, target, reason). */
export async function seedReports(list) {
  if (getEnv().isProduction) throw new Error('Sample data cannot be seeded in production.');
  let created = 0;
  for (const r of list) {
    const key = { reporterId: r.reporterId, targetType: r.targetType, targetId: r.targetId ?? null, reason: r.reason };
    if (await Report.exists(key)) continue;
    await Report.create({ ...r, isSeed: true });
    created += 1;
  }
  return { created, skipped: list.length - created };
}
