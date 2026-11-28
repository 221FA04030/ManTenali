import mongoose from 'mongoose';
import { AppError } from '../errors/index.js';
import { escapeRegex } from './validators.js';

/**
 * Admin moderation, shared by every content module (DECISIONS: admin moderation).
 *
 * Archiving reuses each model's own "hidden" status, which every public query
 * already excludes - so an archived item leaves the website, search, feeds and
 * public URLs without any public query having to change. The `moderation`
 * sub-document records who archived it, why, and the status to go back to on
 * restore. It exists only while the item is archived and is never part of a
 * public response.
 */
export const MODERATION_STATUS = Object.freeze({ PUBLISHED: 'published', ARCHIVED: 'archived', OTHER: 'other' });
export const MODERATION_REASON_MAX = 500;

const moderationSchema = new mongoose.Schema(
  {
    archivedAt: { type: Date, required: true },
    archivedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    reason: { type: String, trim: true, maxlength: MODERATION_REASON_MAX },
    previousStatus: { type: String },
  },
  { _id: false },
);

/** Schema field to add to a content model: `moderation: moderationField`. */
export const moderationField = { type: moderationSchema, default: undefined };

/**
 * Archived = hidden by an admin through moderation (the record says so). An item
 * an admin later re-published through its normal edit form is no longer archived,
 * even if the old record is still there.
 */
export function isArchived(doc, hiddenStatus) {
  return doc.status === hiddenStatus && Boolean(doc.moderation?.archivedAt);
}

/** Move a document (not saved yet) into the archived state. */
export function markArchived(doc, { admin, reason, hiddenStatus, fallbackStatus, removedStatuses = [] }) {
  if (isArchived(doc, hiddenStatus)) throw AppError.conflict('This content is already archived.');
  if (removedStatuses.includes(doc.status)) throw AppError.conflict('This content was removed. Delete it permanently instead.');
  // Something hidden before moderation existed (e.g. by a report) goes back to its normal public status.
  const previousStatus = doc.status === hiddenStatus ? fallbackStatus : doc.status;
  doc.moderation = { archivedAt: new Date(), archivedBy: admin.id, reason: reason || undefined, previousStatus };
  doc.status = hiddenStatus;
}

/** Bring an archived document (not saved yet) back to the status it had. Returns that status. */
export function markRestored(doc, { hiddenStatus, fallbackStatus, allowedStatuses }) {
  if (!isArchived(doc, hiddenStatus)) throw AppError.conflict('This content is not archived.');
  const previous = doc.moderation.previousStatus;
  doc.status = previous && allowedStatuses.includes(previous) ? previous : fallbackStatus;
  doc.moderation = undefined;
  return doc.status;
}

/**
 * One page of a content collection for the admin moderation dashboard.
 * cfg: { hiddenStatus, publicStatuses, titleField, authorFields, select }.
 * status: 'published' | 'archived' | 'all'. authorIds / ids: restrict to these authors / items.
 */
export async function listForModeration(Model, cfg, { status = 'all', q, authorIds, ids, skip = 0, limit = 20 }) {
  const and = [];
  if (ids) and.push({ _id: { $in: ids } });
  if (status === MODERATION_STATUS.ARCHIVED) and.push({ status: cfg.hiddenStatus, 'moderation.archivedAt': { $exists: true } });
  if (status === MODERATION_STATUS.PUBLISHED) and.push({ status: { $in: cfg.publicStatuses } });
  if (q) and.push({ [cfg.titleField]: new RegExp(escapeRegex(q), 'i') });
  if (authorIds) and.push({ $or: cfg.authorFields.map((f) => ({ [f]: { $in: authorIds } })) });
  const filter = and.length ? { $and: and } : {};
  const [items, total] = await Promise.all([
    Model.find(filter).select(cfg.select).sort({ updatedAt: -1, _id: -1 }).skip(skip).limit(limit).lean(),
    Model.countDocuments(filter),
  ]);
  return { items, total };
}

/** Shared part of a dashboard row: moderation state and the archive record. */
export function moderationRow(doc, cfg) {
  const archived = isArchived(doc, cfg.hiddenStatus);
  const moderationStatus = archived
    ? MODERATION_STATUS.ARCHIVED
    : cfg.publicStatuses.includes(doc.status)
      ? MODERATION_STATUS.PUBLISHED
      : MODERATION_STATUS.OTHER;
  return {
    id: String(doc._id),
    status: doc.status,
    moderationStatus,
    archivedAt: archived ? doc.moderation.archivedAt : null,
    archivedBy: archived ? String(doc.moderation.archivedBy) : null,
    moderationReason: archived ? (doc.moderation.reason ?? null) : null,
    authorId: cfg.authorFields.map((f) => doc[f]).find(Boolean)?.toString() ?? null,
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
  };
}

/**
 * Of these image ids, the ones no remaining document of `Model` still uses (call
 * AFTER deleting). An image shared with another record is never released.
 */
export async function unusedImageIds(Model, path, ids) {
  const list = [...new Set(ids.filter(Boolean).map(String))];
  if (!list.length) return [];
  const used = new Set((await Model.distinct(path, { [path]: { $in: list } })).map(String));
  return list.filter((id) => !used.has(id));
}
