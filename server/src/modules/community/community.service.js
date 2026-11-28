import { Post, PostLike, PostComment, CONTENT_STATUS, POST_LIMITS } from './community.model.js';
import * as usersService from '../users/users.service.js';
import * as businessesService from '../businesses/businesses.service.js';
import { assertOwnImage } from '../media/media.service.js';
import { AppError } from '../../common/errors/index.js';
import { getPagination, buildMeta } from '../../common/utils/pagination.js';
import { getEnv } from '../../config/env.js';
import { ROLES } from '../../config/constants.js';
import { listForModeration, moderationRow, markArchived, markRestored, unusedImageIds } from '../../common/utils/moderation.js';

const S = CONTENT_STATUS;
const DAY_MS = 86_400_000;
const isAdmin = (user) => user?.role === ROLES.ADMIN;

/* ----------------------------- DTOs ----------------------------- */

async function hydrate(posts, viewer) {
  const [authors, businesses, liked] = await Promise.all([
    usersService.getSummariesByIds(posts.map((p) => p.authorId)),
    businessesService.getSummariesByIds(posts.map((p) => p.businessId).filter(Boolean)), // published only
    viewer ? PostLike.find({ userId: viewer.id, postId: { $in: posts.map((p) => p._id) } }).select('postId').lean() : [],
  ]);
  const likedSet = new Set(liked.map((l) => String(l.postId)));
  return posts.map((p) => ({
    id: String(p._id),
    kind: p.kind,
    text: p.text,
    photo: p.photo ?? null,
    area: p.area ?? null,
    business: p.businessId ? (businesses.get(String(p.businessId)) ?? null) : null,
    author: authors.get(String(p.authorId)) ?? null,
    likeCount: p.likeCount,
    commentCount: p.commentCount,
    likedByMe: likedSet.has(String(p._id)),
    isMine: Boolean(viewer && String(p.authorId) === String(viewer.id)),
    isSeed: Boolean(p.isSeed),
    createdAt: p.createdAt,
    editedAt: p.editedAt ?? null,
    ...(isAdmin(viewer) ? { status: p.status } : {}),
  }));
}

function commentDTO(c, authors, viewer) {
  return {
    id: String(c._id),
    postId: String(c.postId),
    text: c.text,
    author: authors.get(String(c.authorId)) ?? null,
    isMine: Boolean(viewer && String(c.authorId) === String(viewer.id)),
    isSeed: Boolean(c.isSeed),
    createdAt: c.createdAt,
  };
}

/* ----------------------------- helpers ----------------------------- */

async function applyFields(doc, input) {
  if (input.kind !== undefined) doc.kind = input.kind;
  if (input.text !== undefined) doc.text = input.text;
  if (input.area !== undefined) doc.area = input.area || undefined;
  if (input.photo !== undefined) doc.photo = input.photo ? assertOwnImage(input.photo, 'post_photo', 'body.photo') : undefined;
  if (input.businessId !== undefined) {
    if (input.businessId === null) doc.businessId = undefined;
    else if (String(doc.businessId ?? '') !== input.businessId) {
      await businessesService.assertPublished(input.businessId, 'body.businessId');
      doc.businessId = input.businessId;
    }
  }
}

/** A published post anyone can see; hidden/removed ones are 404 (admins can still open them). */
async function loadVisible(id, viewer) {
  const p = await Post.findById(id).lean();
  if (!p || (p.status !== S.PUBLISHED && !isAdmin(viewer))) throw AppError.notFound('Post not found.');
  return p;
}

/* ----------------------------- posts ----------------------------- */

/** Public feed: published posts, newest first; filters kind and area. */
export async function feed(query, viewer) {
  const { page, limit, skip } = getPagination(query);
  const filter = { status: S.PUBLISHED };
  if (query.kind) filter.kind = query.kind;
  if (query.area) filter.area = query.area;
  const [items, total] = await Promise.all([
    Post.find(filter).sort({ createdAt: -1, _id: -1 }).skip(skip).limit(limit).lean(),
    Post.countDocuments(filter),
  ]);
  return { items: await hydrate(items, viewer), meta: buildMeta({ page, limit, total }) };
}

export async function getPost(id, viewer) {
  return (await hydrate([await loadVisible(id, viewer)], viewer))[0];
}

/** My posts on the profile (published and hidden; removed ones are gone). */
export async function listMine(user) {
  const items = await Post.find({ authorId: user.id, status: { $ne: S.REMOVED } }).sort({ createdAt: -1 }).limit(100).lean();
  const out = await hydrate(items, user);
  return out.map((p, i) => ({ ...p, status: items[i].status }));
}

/** Anyone signed in (and not blocked) posts; at most 10 posts per day. */
export async function create(user, input) {
  const since = new Date(Date.now() - DAY_MS);
  if ((await Post.countDocuments({ authorId: user.id, createdAt: { $gte: since } })) >= POST_LIMITS.perDay) {
    throw new AppError('RATE_LIMITED', `You can share up to ${POST_LIMITS.perDay} posts a day. Please try again tomorrow.`);
  }
  const doc = new Post({ authorId: user.id });
  await applyFields(doc, input);
  await doc.save();
  return getPost(doc._id, user);
}

async function loadOwn(user, id) {
  const p = await Post.findOne({ _id: id, authorId: user.id, status: { $ne: S.REMOVED } });
  if (!p) throw AppError.notFound('Post not found.');
  return p;
}

/** Edit own post while it is published (a hidden post can't be edited back into view). */
export async function update(user, id, input) {
  const doc = await loadOwn(user, id);
  if (doc.status === S.HIDDEN) throw AppError.conflict('This post was hidden by a moderator and can no longer be edited.');
  await applyFields(doc, input);
  doc.editedAt = new Date();
  await doc.save();
  return getPost(doc._id, user);
}

/** Admin: hide a post (kept for the record). Also used by reports. */
export async function hide(admin, id) {
  const doc = await Post.findById(id);
  if (!doc) throw AppError.notFound('Post not found.');
  if (doc.status === S.PUBLISHED) {
    markArchived(doc, { admin, hiddenStatus: S.HIDDEN, fallbackStatus: S.PUBLISHED });
    doc.hiddenBy = admin.id;
    await doc.save();
  }
  return { id: String(doc._id), status: doc.status };
}

/** DELETE: the author removes their post (gone for everyone); an admin's DELETE hides someone else's. */
export async function remove(user, id) {
  const own = await Post.findOne({ _id: id, authorId: user.id, status: { $ne: S.REMOVED } });
  if (own) {
    own.status = S.REMOVED;
    await own.save();
    return { id: String(own._id), status: own.status };
  }
  if (!isAdmin(user)) throw AppError.notFound('Post not found.');
  return hide(user, id);
}

/* ----------------------------- likes ----------------------------- */

/** Like (idempotent). The count changes only when a like is really added. */
export async function like(user, id) {
  const p = await loadVisible(id, null);
  try {
    await PostLike.create({ postId: p._id, userId: user.id });
    await Post.updateOne({ _id: p._id }, { $inc: { likeCount: 1 } }, { timestamps: false });
  } catch (err) {
    if (err?.code !== 11000) throw err; // already liked
  }
  const { likeCount } = await Post.findById(p._id).select('likeCount').lean();
  return { liked: true, likeCount };
}

export async function unlike(user, id) {
  const p = await loadVisible(id, null);
  const { deletedCount } = await PostLike.deleteOne({ postId: p._id, userId: user.id });
  if (deletedCount) await Post.updateOne({ _id: p._id, likeCount: { $gt: 0 } }, { $inc: { likeCount: -1 } }, { timestamps: false });
  const { likeCount } = await Post.findById(p._id).select('likeCount').lean();
  return { liked: false, likeCount };
}

/* ----------------------------- comments ----------------------------- */

export async function listComments(id, query, viewer) {
  const p = await loadVisible(id, viewer);
  const { page, limit, skip } = getPagination(query);
  const filter = { postId: p._id, status: S.PUBLISHED };
  const [items, total] = await Promise.all([
    PostComment.find(filter).sort({ createdAt: 1, _id: 1 }).skip(skip).limit(limit).lean(),
    PostComment.countDocuments(filter),
  ]);
  const authors = await usersService.getSummariesByIds(items.map((c) => c.authorId));
  return { items: items.map((c) => commentDTO(c, authors, viewer)), meta: buildMeta({ page, limit, total }) };
}

export async function addComment(user, id, { text }) {
  const p = await loadVisible(id, null);
  const c = await PostComment.create({ postId: p._id, authorId: user.id, text });
  await Post.updateOne({ _id: p._id }, { $inc: { commentCount: 1 } }, { timestamps: false });
  return commentDTO(c.toObject(), await usersService.getSummariesByIds([user.id]), user);
}

async function setCommentStatus(c, status, by) {
  const wasPublished = c.status === S.PUBLISHED;
  c.status = status;
  if (by) c.hiddenBy = by;
  await c.save();
  if (wasPublished) await Post.updateOne({ _id: c.postId, commentCount: { $gt: 0 } }, { $inc: { commentCount: -1 } }, { timestamps: false });
}

/** Admin: hide a comment. Also used by reports. */
export async function hideComment(admin, id) {
  const c = await PostComment.findById(id);
  if (!c) throw AppError.notFound('Comment not found.');
  if (c.status === S.PUBLISHED) {
    markArchived(c, { admin, hiddenStatus: S.HIDDEN, fallbackStatus: S.PUBLISHED });
    c.status = S.PUBLISHED; // setCommentStatus moves it to hidden and keeps the post's count right
    await setCommentStatus(c, S.HIDDEN, admin.id);
  }
  return { id: String(c._id), status: c.status };
}

/** The author removes their comment; an admin hides someone else's. */
export async function removeComment(user, id) {
  const own = await PostComment.findOne({ _id: id, authorId: user.id, status: S.PUBLISHED });
  if (own) {
    await setCommentStatus(own, S.REMOVED);
    return { id: String(own._id), status: own.status };
  }
  if (!isAdmin(user)) throw AppError.notFound('Comment not found.');
  return hideComment(user, id);
}

/* ----------------------------- other modules ----------------------------- */

/** Home "Community highlights": the latest published posts. */
export async function latest(limit = 3, viewer = null) {
  const items = await Post.find({ status: S.PUBLISHED }).sort({ createdAt: -1, _id: -1 }).limit(limit).lean();
  return hydrate(items, viewer);
}

/** Saved posts (favorites): published posts by id, as feed cards. */
export async function getPublicByIds(ids) {
  if (!ids.length) return new Map();
  const items = await Post.find({ _id: { $in: ids }, status: S.PUBLISHED }).lean();
  const cards = await hydrate(items, null);
  return new Map(cards.map((c) => [c.id, c]));
}

/** Reports: moderation view of posts and comments (any status). */
export async function moderationInfo(ids) {
  if (!ids.length) return new Map();
  const items = await Post.find({ _id: { $in: ids } }).lean();
  return new Map(items.map((p) => [String(p._id), { title: p.text.slice(0, 80), status: p.status, isPublic: p.status === S.PUBLISHED, responsibleUserId: String(p.authorId) }]));
}

export async function commentModerationInfo(ids) {
  if (!ids.length) return new Map();
  const items = await PostComment.find({ _id: { $in: ids } }).lean();
  const posts = new Map((await Post.find({ _id: { $in: items.map((c) => c.postId) } }).select('status').lean()).map((p) => [String(p._id), p.status]));
  return new Map(
    items.map((c) => [
      String(c._id),
      { title: c.text.slice(0, 80), postId: String(c.postId), status: c.status, isPublic: c.status === S.PUBLISHED && posts.get(String(c.postId)) === S.PUBLISHED, responsibleUserId: String(c.authorId) },
    ]),
  );
}

/** Demo data only (local development); refused in production. Idempotent by text + author. */
export async function seedPosts(list) {
  if (getEnv().isProduction) throw new Error('Sample data cannot be seeded in production.');
  let created = 0;
  for (const item of list) {
    if (await Post.exists({ authorId: item.authorId, text: item.text })) continue;
    const { comments = [], likedBy = [], ...post } = item;
    const doc = await Post.create({ ...post, isSeed: true, likeCount: likedBy.length, commentCount: comments.length });
    for (const userId of likedBy) await PostLike.create({ postId: doc._id, userId });
    for (const c of comments) await PostComment.create({ postId: doc._id, authorId: c.authorId, text: c.text, isSeed: true });
    created += 1;
  }
  return { created, skipped: list.length - created };
}

/* ----------------------------- admin moderation (archive / restore / delete) ----------------------------- */
const POST_MOD = {
  hiddenStatus: S.HIDDEN,
  publicStatuses: [S.PUBLISHED],
  titleField: 'text',
  authorFields: ['authorId'],
  select: 'authorId kind text status moderation commentCount createdAt updatedAt',
};
const COMMENT_MOD = {
  hiddenStatus: S.HIDDEN,
  publicStatuses: [S.PUBLISHED],
  titleField: 'text',
  authorFields: ['authorId'],
  select: 'postId authorId text status moderation createdAt updatedAt',
};
const postRow = (p) => ({ ...moderationRow(p, POST_MOD), title: p.text.slice(0, 140), postKind: p.kind });
const commentRow = (c) => ({ ...moderationRow(c, COMMENT_MOD), title: c.text.slice(0, 140), postId: String(c.postId) });

/** Moderation dashboard rows, any status. */
export async function moderationRows(query) {
  const { items, total } = await listForModeration(Post, POST_MOD, query);
  return { items: items.map(postRow), total };
}

export async function commentModerationRows(query) {
  const { items, total } = await listForModeration(PostComment, COMMENT_MOD, query);
  return { items: items.map(commentRow), total };
}

/** Admin: take a post off the feed (kept, restorable). The author can no longer edit it. */
export async function adminArchive(admin, id, reason) {
  const doc = await Post.findById(id);
  if (!doc) throw AppError.notFound('Post not found.');
  markArchived(doc, { admin, reason, hiddenStatus: S.HIDDEN, fallbackStatus: S.PUBLISHED, removedStatuses: [S.REMOVED] });
  doc.hiddenBy = admin.id;
  await doc.save();
  return postRow(doc.toObject());
}

export async function adminRestore(admin, id) {
  const doc = await Post.findById(id);
  if (!doc) throw AppError.notFound('Post not found.');
  markRestored(doc, { hiddenStatus: S.HIDDEN, fallbackStatus: S.PUBLISHED, allowedStatuses: [S.PUBLISHED] });
  doc.hiddenBy = undefined;
  await doc.save();
  return postRow(doc.toObject());
}

/** Admin: delete the post with its likes and comments. Returns the comment ids and the photo id when unused. */
export async function adminPurge(id) {
  const doc = await Post.findById(id).select('text photo').lean();
  if (!doc) throw AppError.notFound('Post not found.');
  const commentIds = (await PostComment.find({ postId: doc._id }).select('_id').lean()).map((c) => c._id);
  await Promise.all([PostLike.deleteMany({ postId: doc._id }), PostComment.deleteMany({ postId: doc._id })]);
  await Post.deleteOne({ _id: doc._id });
  return { title: doc.text.slice(0, 80), commentIds, images: await unusedImageIds(Post, 'photo.publicId', [doc.photo?.publicId]) };
}

/** Admin: take a comment off its post (kept, restorable); the post's comment count follows. */
export async function adminArchiveComment(admin, id, reason) {
  const c = await PostComment.findById(id);
  if (!c) throw AppError.notFound('Comment not found.');
  const wasPublished = c.status === S.PUBLISHED;
  markArchived(c, { admin, reason, hiddenStatus: S.HIDDEN, fallbackStatus: S.PUBLISHED, removedStatuses: [S.REMOVED] });
  c.hiddenBy = admin.id;
  await c.save();
  if (wasPublished) await Post.updateOne({ _id: c.postId, commentCount: { $gt: 0 } }, { $inc: { commentCount: -1 } }, { timestamps: false });
  return commentRow(c.toObject());
}

export async function adminRestoreComment(admin, id) {
  const c = await PostComment.findById(id);
  if (!c) throw AppError.notFound('Comment not found.');
  markRestored(c, { hiddenStatus: S.HIDDEN, fallbackStatus: S.PUBLISHED, allowedStatuses: [S.PUBLISHED] });
  c.hiddenBy = undefined;
  await c.save();
  await Post.updateOne({ _id: c.postId }, { $inc: { commentCount: 1 } }, { timestamps: false });
  return commentRow(c.toObject());
}

/** Admin: delete the comment record; the post's comment count follows. */
export async function adminPurgeComment(id) {
  const c = await PostComment.findById(id).lean();
  if (!c) throw AppError.notFound('Comment not found.');
  await PostComment.deleteOne({ _id: c._id });
  if (c.status === S.PUBLISHED) await Post.updateOne({ _id: c.postId, commentCount: { $gt: 0 } }, { $inc: { commentCount: -1 } }, { timestamps: false });
  return { title: c.text.slice(0, 80), images: [] };
}

/** Business deletion: posts that recommended it keep their text; only the link goes. */
export async function detachBusiness(businessId) {
  await Post.updateMany({ businessId }, { $unset: { businessId: 1 } }, { timestamps: false });
}
