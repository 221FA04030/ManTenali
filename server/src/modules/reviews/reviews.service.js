import mongoose from 'mongoose';
import { Review, REVIEW_STATUS } from './reviews.model.js';
import * as businessesService from '../businesses/businesses.service.js';
import * as usersService from '../users/users.service.js';
import { AppError } from '../../common/errors/index.js';
import { getPagination, buildMeta } from '../../common/utils/pagination.js';
import { getEnv } from '../../config/env.js';
import { ROLES } from '../../config/constants.js';
import { listForModeration, moderationRow, markArchived, markRestored } from '../../common/utils/moderation.js';

const R = REVIEW_STATUS;
const isAdmin = (user) => user?.role === ROLES.ADMIN;

function toDTO(r, authors, { mine = false } = {}) {
  return {
    id: String(r._id),
    businessId: String(r.businessId),
    rating: r.rating,
    comment: r.comment ?? '',
    author: authors?.get(String(r.userId)) ?? null,
    createdAt: r.createdAt,
    updatedAt: r.updatedAt,
    isEdited: new Date(r.updatedAt) - new Date(r.createdAt) > 60_000,
    isSeed: Boolean(r.isSeed),
    ...(mine ? { status: r.status } : {}),
  };
}

/** The business must be published (spec: "A business must be published to receive ... reviews"); else 404. */
async function assertPublicBusiness(businessId) {
  try {
    await businessesService.assertPublished(businessId, 'params.id');
  } catch {
    throw AppError.notFound('Business not found.');
  }
}

/**
 * Spec rule: ratingAvg and ratingCount are recalculated from PUBLISHED reviews
 * after every change (create, edit, delete, hide). Average rounded to 1 decimal.
 */
export async function recalculateRating(businessId) {
  const [agg] = await Review.aggregate([
    { $match: { businessId: new mongoose.Types.ObjectId(String(businessId)), status: R.PUBLISHED } },
    { $group: { _id: null, avg: { $avg: '$rating' }, count: { $sum: 1 } } },
  ]);
  const rating = { avg: agg ? Math.round(agg.avg * 10) / 10 : 0, count: agg?.count ?? 0 };
  await businessesService.setRating(businessId, rating);
  return rating;
}

/** FR-REV-1: published reviews of a published business, newest first. */
export async function listForBusiness(businessId, query) {
  await assertPublicBusiness(businessId);
  const { page, limit, skip } = getPagination(query);
  const filter = { businessId, status: R.PUBLISHED };
  const [items, total] = await Promise.all([
    Review.find(filter).sort({ createdAt: -1, _id: -1 }).skip(skip).limit(limit).lean(),
    Review.countDocuments(filter),
  ]);
  const authors = await usersService.getSummariesByIds(items.map((r) => r.userId));
  return { items: items.map((r) => toDTO(r, authors)), meta: buildMeta({ page, limit, total }) };
}

/** The signed-in user's review of this business (any status, so a hidden one is explained), or null. */
export async function getMineForBusiness(user, businessId) {
  const r = await Review.findOne({ businessId, userId: user.id }).lean();
  if (!r) return null;
  return toDTO(r, await usersService.getSummariesByIds([r.userId]), { mine: true });
}

/** FR-PRO-2: my reviews with a small business summary (null once the business is no longer public). */
export async function listMine(user) {
  const items = await Review.find({ userId: user.id }).sort({ createdAt: -1 }).limit(200).lean();
  const businesses = await businessesService.getSummariesByIds(items.map((r) => r.businessId));
  return items.map((r) => ({ ...toDTO(r, null, { mine: true }), business: businesses.get(String(r.businessId)) ?? null }));
}

/** One review per user per business; the business must be published; owners can't review their own. */
export async function create(user, businessId, input) {
  await assertPublicBusiness(businessId);
  if (await businessesService.isOwnedBy(businessId, user.id)) {
    throw AppError.forbidden('You cannot review your own business.');
  }
  let review;
  try {
    review = await Review.create({ businessId, userId: user.id, rating: input.rating, comment: input.comment || undefined });
  } catch (err) {
    if (err?.code === 11000) throw AppError.conflict('You have already reviewed this business. Edit your review instead.');
    throw err;
  }
  await recalculateRating(businessId);
  return toDTO(review.toObject(), await usersService.getSummariesByIds([user.id]), { mine: true });
}

/** Someone else's review: 404, not 403 (no probing). */
async function loadOwn(user, id) {
  const r = await Review.findOne({ _id: id, userId: user.id });
  if (!r) throw AppError.notFound('Review not found.');
  return r;
}

/** Edit own review. A review hidden by a moderator can't be edited back into view. */
export async function update(user, id, input) {
  const r = await loadOwn(user, id);
  if (r.status === R.HIDDEN) throw AppError.conflict('This review was hidden by a moderator and can no longer be edited.');
  if (input.rating !== undefined) r.rating = input.rating;
  if (input.comment !== undefined) r.comment = input.comment || undefined;
  await r.save();
  await recalculateRating(r.businessId);
  return toDTO(r.toObject(), await usersService.getSummariesByIds([user.id]), { mine: true });
}

/** Admin: hide a review (kept for the record; rating recalculated). Also used by reports. */
export async function hide(admin, id) {
  const r = await Review.findById(id);
  if (!r) throw AppError.notFound('Review not found.');
  if (r.status !== R.HIDDEN) {
    markArchived(r, { admin, hiddenStatus: R.HIDDEN, fallbackStatus: R.PUBLISHED });
    r.hiddenBy = admin.id;
    r.hiddenAt = new Date();
    await r.save();
    await recalculateRating(r.businessId);
  }
  return { id: String(r._id), status: r.status };
}

/**
 * DELETE: the author removes their own review permanently (D9.3); an admin
 * deleting someone else's review HIDES it (spec: "admin can hide any").
 */
export async function remove(user, id) {
  const own = await Review.findOne({ _id: id, userId: user.id });
  if (own) {
    await own.deleteOne();
    await recalculateRating(own.businessId);
    return { id: String(own._id), deleted: true };
  }
  if (!isAdmin(user)) throw AppError.notFound('Review not found.');
  return hide(user, id);
}

/** Moderation view for reports: Map id -> { title, businessId, status, isPublic, responsibleUserId }. */
export async function moderationInfo(ids) {
  if (!ids.length) return new Map();
  const items = await Review.find({ _id: { $in: ids } }).lean();
  const businessIds = items.map((r) => r.businessId);
  const [published, businesses] = await Promise.all([
    businessesService.getPublishedIds(businessIds),
    businessesService.getSummariesByIds(businessIds, { publishedOnly: false }),
  ]);
  return new Map(
    items.map((r) => [
      String(r._id),
      {
        title: `${r.rating}/5${r.comment ? ` - ${r.comment.slice(0, 80)}` : ''}`,
        businessId: String(r.businessId),
        slug: businesses.get(String(r.businessId))?.slug ?? null, // the business page shows the review
        status: r.status,
        isPublic: r.status === R.PUBLISHED && published.has(String(r.businessId)),
        responsibleUserId: String(r.userId),
      },
    ]),
  );
}

/** Demo data only (local development); refused in production. Idempotent per (business, user). */
export async function seedReviews(list) {
  if (getEnv().isProduction) throw new Error('Sample data cannot be seeded in production.');
  let created = 0;
  const touched = new Set();
  for (const r of list) {
    if (await Review.exists({ businessId: r.businessId, userId: r.userId })) continue;
    await Review.create({ ...r, isSeed: true });
    touched.add(String(r.businessId));
    created += 1;
  }
  for (const id of touched) await recalculateRating(id);
  return { created, skipped: list.length - created };
}

/* ----------------------------- admin moderation (archive / restore / delete) ----------------------------- */
const MOD = {
  hiddenStatus: R.HIDDEN,
  publicStatuses: [R.PUBLISHED],
  titleField: 'comment',
  authorFields: ['userId'],
  select: 'businessId userId rating comment status moderation createdAt updatedAt',
};
const reviewTitle = (r) => `${r.rating}/5${r.comment ? ` - ${r.comment.slice(0, 120)}` : ''}`;

async function moderationRowsFor(items) {
  const businesses = await businessesService.getSummariesByIds([...new Set(items.map((r) => String(r.businessId)))], { publishedOnly: false });
  return items.map((r) => ({ ...moderationRow(r, MOD), title: reviewTitle(r), business: businesses.get(String(r.businessId)) ?? null }));
}

/** Moderation dashboard rows, any status. */
export async function moderationRows(query) {
  const { items, total } = await listForModeration(Review, MOD, query);
  return { items: await moderationRowsFor(items), total };
}

/** Admin: hide a review from the business page (kept, restorable); the rating is recalculated. */
export async function adminArchive(admin, id, reason) {
  const r = await Review.findById(id);
  if (!r) throw AppError.notFound('Review not found.');
  markArchived(r, { admin, reason, hiddenStatus: R.HIDDEN, fallbackStatus: R.PUBLISHED });
  r.hiddenBy = admin.id;
  r.hiddenAt = new Date();
  await r.save();
  await recalculateRating(r.businessId);
  return (await moderationRowsFor([r.toObject()]))[0];
}

export async function adminRestore(admin, id) {
  const r = await Review.findById(id);
  if (!r) throw AppError.notFound('Review not found.');
  markRestored(r, { hiddenStatus: R.HIDDEN, fallbackStatus: R.PUBLISHED, allowedStatuses: [R.PUBLISHED] });
  r.hiddenBy = undefined;
  r.hiddenAt = undefined;
  await r.save();
  await recalculateRating(r.businessId);
  return (await moderationRowsFor([r.toObject()]))[0];
}

/** Admin: delete the review record; the business rating is recalculated. */
export async function adminPurge(id) {
  const r = await Review.findById(id).lean();
  if (!r) throw AppError.notFound('Review not found.');
  await Review.deleteOne({ _id: r._id });
  await recalculateRating(r.businessId);
  return { title: reviewTitle(r), images: [] };
}

/** Business deletion: remove its reviews. Returns their ids. */
export async function purgeForBusiness(businessId) {
  const ids = (await Review.find({ businessId }).select('_id').lean()).map((r) => r._id);
  await Review.deleteMany({ businessId });
  return { ids };
}
