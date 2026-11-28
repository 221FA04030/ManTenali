import mongoose from 'mongoose';
import * as businessesService from '../businesses/businesses.service.js';
import * as offersService from '../offers/offers.service.js';
import * as eventsService from '../events/events.service.js';
import * as newsService from '../news/news.service.js';
import * as communityService from '../community/community.service.js';
import * as reviewsService from '../reviews/reviews.service.js';
import * as favoritesService from '../favorites/favorites.service.js';
import * as reportsService from '../reports/reports.service.js';
import * as usersService from '../users/users.service.js';
import { releaseImages } from '../media/media.service.js';
import * as auditService from './audit.service.js';
import { AppError } from '../../common/errors/index.js';
import { getPagination, buildMeta } from '../../common/utils/pagination.js';

/**
 * Admin content moderation: archive (take off the website, restorable),
 * restore, and delete permanently, for every kind of user content.
 *
 * Like reports, this module never touches another module's model: each content
 * module owns its own archive / restore / purge rules; this module adds the
 * audit log and, for deletions, removes the related records of other modules.
 */
const TYPES = {
  business: {
    info: businessesService.moderationInfo,
    rows: businessesService.moderationRows,
    archive: businessesService.adminArchive,
    restore: businessesService.adminRestore,
    purge: purgeBusiness,
  },
  offer: { info: offersService.moderationInfo, rows: offersService.moderationRows, archive: offersService.adminArchive, restore: offersService.adminRestore, purge: simplePurge('offer', offersService.adminPurge) },
  event: { info: eventsService.moderationInfo, rows: eventsService.moderationRows, archive: eventsService.adminArchive, restore: eventsService.adminRestore, purge: simplePurge('event', eventsService.adminPurge) },
  news: { info: newsService.moderationInfo, rows: newsService.moderationRows, archive: newsService.adminArchive, restore: newsService.adminRestore, purge: simplePurge('news', newsService.adminPurge) },
  post: { info: communityService.moderationInfo, rows: communityService.moderationRows, archive: communityService.adminArchive, restore: communityService.adminRestore, purge: purgePost },
  comment: {
    info: communityService.commentModerationInfo,
    rows: communityService.commentModerationRows,
    archive: communityService.adminArchiveComment,
    restore: communityService.adminRestoreComment,
    purge: simplePurge('comment', communityService.adminPurgeComment),
  },
  review: { info: reviewsService.moderationInfo, rows: reviewsService.moderationRows, archive: reviewsService.adminArchive, restore: reviewsService.adminRestore, purge: simplePurge('review', reviewsService.adminPurge) },
};
/** Content people can save (favorites). */
const SAVEABLE = new Set(['business', 'offer', 'event', 'post']);

async function forgetEverywhere(admin, type, ids) {
  const [saves, reports] = await Promise.all([
    SAVEABLE.has(type) ? favoritesService.deleteForTargets(type, ids) : 0,
    reportsService.closeForTargets(admin, type, ids),
  ]);
  return { saves, reports };
}

function simplePurge(type, purge) {
  return async (admin, id) => {
    const { title, images } = await purge(id);
    const { saves, reports } = await forgetEverywhere(admin, type, [id]);
    return { title, images, related: { saves, reportsClosed: reports } };
  };
}

/** A business takes its offers and reviews with it; events and posts that mention it only lose the link. */
async function purgeBusiness(admin, id) {
  const offers = await offersService.purgeForBusiness(id);
  const reviews = await reviewsService.purgeForBusiness(id);
  await Promise.all([eventsService.detachBusiness(id), communityService.detachBusiness(id)]);
  const { title, images } = await businessesService.adminPurge(id);
  const [own, ofOffers, ofReviews] = await Promise.all([
    forgetEverywhere(admin, 'business', [id]),
    forgetEverywhere(admin, 'offer', offers.ids),
    forgetEverywhere(admin, 'review', reviews.ids),
  ]);
  return {
    title,
    images: [...images, ...offers.images],
    related: {
      offers: offers.ids.length,
      reviews: reviews.ids.length,
      saves: own.saves + ofOffers.saves,
      reportsClosed: own.reports + ofOffers.reports + ofReviews.reports,
    },
  };
}

/** A post takes its likes and comments with it. */
async function purgePost(admin, id) {
  const { title, images, commentIds } = await communityService.adminPurge(id);
  const [own, ofComments] = await Promise.all([forgetEverywhere(admin, 'post', [id]), forgetEverywhere(admin, 'comment', commentIds)]);
  return { title, images, related: { comments: commentIds.length, saves: own.saves, reportsClosed: own.reports + ofComments.reports } };
}

/** Add author and archiving admin (name + email: admins only) to dashboard rows. */
async function hydrate(rows) {
  const ids = new Set();
  for (const r of rows) {
    if (r.authorId) ids.add(r.authorId);
    if (r.archivedBy) ids.add(r.archivedBy);
  }
  const contacts = await usersService.getAdminContactsByIds([...ids]);
  return rows.map(({ authorId, archivedBy, ...r }) => ({
    ...r,
    author: authorId ? (contacts.get(authorId) ?? null) : null,
    archivedBy: archivedBy ? (contacts.get(archivedBy)?.name ?? null) : null,
  }));
}

const withType = (type, rows) => rows.map((r) => ({ type, ...r }));

/** Dashboard list for one content type: published / archived / all, searchable, by author. */
export async function list({ type, status, q, author, page, limit }) {
  const p = getPagination({ page, limit });
  let authorIds;
  if (author) {
    authorIds = mongoose.isValidObjectId(author) ? [new mongoose.Types.ObjectId(author)] : await usersService.findIdsMatching(author);
    if (!authorIds.length) return { items: [], meta: buildMeta({ ...p, total: 0 }) };
  }
  const { items, total } = await TYPES[type].rows({ status, q, authorIds, skip: p.skip, limit: p.limit });
  return { items: withType(type, await hydrate(items)), meta: buildMeta({ ...p, total }) };
}

/** One item's moderation state (the admin menu asks before offering Archive or Restore). */
export async function getOne(type, id) {
  const { items } = await TYPES[type].rows({ ids: [id], limit: 1 });
  if (!items.length) throw AppError.notFound('Content not found.');
  return withType(type, await hydrate(items))[0];
}

export async function archive(admin, type, id, reason) {
  const row = await TYPES[type].archive(admin, id, reason);
  await auditService.record({ admin, contentType: type, contentId: id, action: 'archive', reason, title: row.title });
  return withType(type, await hydrate([row]))[0];
}

export async function restore(admin, type, id) {
  const row = await TYPES[type].restore(admin, id);
  await auditService.record({ admin, contentType: type, contentId: id, action: 'restore', title: row.title });
  return withType(type, await hydrate([row]))[0];
}

/**
 * Permanent delete. The record and its dependent records are removed, saves of
 * it are removed, open reports about it are closed, and images that no other
 * record uses are deleted from storage (best effort). Logged in the audit log.
 */
export async function remove(admin, type, id, reason) {
  const exists = (await TYPES[type].info([id])).get(String(id));
  if (!exists) throw AppError.notFound('Content not found.');
  const { title, images, related } = await TYPES[type].purge(admin, id);
  const media = await releaseImages(images);
  await auditService.record({ admin, contentType: type, contentId: id, action: 'delete', reason, title, related: { ...related, imagesDeleted: media.removed } });
  return { type, id: String(id), deleted: true, related, images: media };
}

export const listAudit = (query) => auditService.list(query);
