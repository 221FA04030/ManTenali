import { News, NEWS_STATUS, MAX_PINNED } from './news.model.js';
import * as categoriesService from '../categories/categories.service.js';
import { assertOwnImage } from '../media/media.service.js';
import { AppError } from '../../common/errors/index.js';
import { getPagination, buildMeta } from '../../common/utils/pagination.js';
import { generateUniqueSlug } from '../../common/utils/slug.js';
import { istDateTime, toIstDateTime } from '../../common/utils/dates.js';
import { escapeRegex } from '../../common/utils/validators.js';
import { getEnv } from '../../config/env.js';
import { ROLES } from '../../config/constants.js';

const S = NEWS_STATUS;
const DAY_MS = 86_400_000;
const MAX_VALIDITY_DAYS = 366;
const isAdmin = (user) => user?.role === ROLES.ADMIN;
const isExpired = (n, now = new Date()) => Boolean(n.validUntil) && n.validUntil <= now;

/** Public "not expired" condition: no validUntil, or validUntil still ahead. */
const notExpired = (now) => ({ $or: [{ validUntil: null }, { validUntil: { $gt: now } }] });

/** Only published, unexpired pinned items use one of the MAX_PINNED slots (drafts and hidden items don't). */
const usesPinSlot = (n, now = new Date()) => Boolean(n.isPinned) && n.status === S.PUBLISHED && !isExpired(n, now);

/**
 * Fields whose change counts as a content edit ("Updated" time shown to readers).
 * Category, pinning and status changes are administrative and don't count.
 */
const CONTENT_FIELDS = ['title', 'summary', 'body', 'type', 'sourceName', 'sourceUrl', 'validUntil', 'coverImage'];
function contentKey(doc) {
  return JSON.stringify(
    CONTENT_FIELDS.map((k) => {
      const v = doc[k];
      if (v instanceof Date) return v.getTime();
      if (k === 'coverImage') return v?.publicId ? [v.url, v.publicId] : null;
      return v || null;
    }),
  );
}

/* ----------------------------- DTOs ----------------------------- */

/** PUBLIC shape (fixed allow-list). Lists omit the body to keep payloads small. */
function toPublicDTO(n, categories, { withBody = false, now = new Date() } = {}) {
  return {
    id: String(n._id),
    slug: n.slug,
    title: n.title,
    summary: n.summary,
    ...(withBody ? { body: n.body ?? '' } : {}),
    type: n.type,
    category: n.categoryId ? (categories.get(String(n.categoryId)) ?? null) : null,
    coverImage: n.coverImage ?? null,
    sourceName: n.sourceName,
    sourceUrl: n.sourceUrl ?? null,
    publishedAt: n.publishedAt ?? null,
    // "Updated" = last CONTENT edit (D7.13). Administrative changes (pin, hide, publish, category) don't move it.
    updatedAt: n.contentUpdatedAt ?? n.publishedAt ?? n.createdAt ?? null,
    validUntil: n.validUntil ?? null,
    validUntilLocal: toIstDateTime(n.validUntil),
    isPinned: Boolean(n.isPinned),
    isExpired: isExpired(n, now),
    isSeed: Boolean(n.isSeed),
  };
}

/** Admin shape: public fields plus status and editing fields. */
function toAdminDTO(n, categories) {
  return {
    ...toPublicDTO(n, categories, { withBody: true }),
    status: n.status,
    categoryId: n.categoryId ? String(n.categoryId) : null,
    createdAt: n.createdAt,
    lastChangedAt: n.updatedAt, // any change, including pinning and status (admin list order)
  };
}

const categoriesFor = (items) => categoriesService.getSummariesByIds(items.map((n) => n.categoryId));

/* ----------------------------- helpers ----------------------------- */

/** validUntil (IST "YYYY-MM-DDTHH:mm") must be in the future and within a year. */
function resolveValidUntil(local, now = new Date()) {
  const at = istDateTime(local);
  if (at <= now) {
    throw AppError.validation('Check the "show until" time.', [{ field: 'body.validUntil', message: 'Choose a time in the future' }]);
  }
  if (at.getTime() - now.getTime() > MAX_VALIDITY_DAYS * DAY_MS) {
    throw AppError.validation('Check the "show until" time.', [{ field: 'body.validUntil', message: 'Choose a time within one year' }]);
  }
  return at;
}

/**
 * Apply editable fields. Returns true when the CONTENT changed (see CONTENT_FIELDS),
 * so re-sending unchanged values from the edit form is not an edit.
 */
async function applyFields(doc, input) {
  const before = contentKey(doc);
  // An unchanged category is kept even if it was deactivated later (D7.14); a new one must be active.
  if (input.categoryId !== undefined && input.categoryId !== String(doc.categoryId ?? '')) {
    if (input.categoryId === null) doc.categoryId = undefined;
    else {
      await categoriesService.assertActiveCategory(input.categoryId, 'news');
      doc.categoryId = input.categoryId;
    }
  }
  if (input.validUntil !== undefined) {
    // Only a NEW or CHANGED time must be in the future, so an expired item can still be edited.
    const unchanged = input.validUntil !== null && doc.validUntil && toIstDateTime(doc.validUntil) === input.validUntil;
    if (!unchanged) doc.validUntil = input.validUntil === null ? undefined : resolveValidUntil(input.validUntil);
  }
  if (input.coverImage !== undefined) {
    doc.coverImage = input.coverImage ? assertOwnImage(input.coverImage, 'news_cover', 'body.coverImage') : undefined;
  }
  for (const key of ['title', 'summary', 'type', 'sourceName']) {
    if (input[key] !== undefined) doc[key] = input[key]; // slug is permanent
  }
  if (input.body !== undefined) doc.body = input.body || undefined;
  if (input.sourceUrl !== undefined) doc.sourceUrl = input.sourceUrl || undefined;
  return contentKey(doc) !== before;
}

/**
 * Called when an item STARTS using a pin slot (pinned + published + not expired),
 * whether by pinning, publishing a pinned draft, or extending an expired pinned notice.
 */
async function assertPinSlot(excludeId) {
  const pinned = await News.countDocuments({ _id: { $ne: excludeId }, isPinned: true, status: S.PUBLISHED, ...notExpired(new Date()) });
  if (pinned >= MAX_PINNED) {
    throw AppError.conflict(`At most ${MAX_PINNED} published items can be pinned. Unpin one first.`);
  }
}

function assertPublishable(doc) {
  if (isExpired(doc)) {
    throw AppError.validation('This notice has already expired.', [
      { field: 'body.validUntil', message: 'Choose a later "show until" time or clear it before publishing' },
    ]);
  }
}

async function slugFor(title) {
  return generateUniqueSlug(title, async (s) => Boolean(await News.exists({ slug: s })));
}

async function loadForAdmin(id) {
  const doc = await News.findById(id);
  if (!doc) throw AppError.notFound('News item not found.');
  return doc;
}

async function adminView(doc) {
  const n = doc.toObject ? doc.toObject() : doc;
  return toAdminDTO(n, await categoriesFor([n]));
}

/* ----------------------------- public reads ----------------------------- */

/**
 * FR-NEWS-1/2: published items that haven't expired, pinned first, newest next.
 * Filters: type, categoryId.
 */
export async function listPublic(query, now = new Date()) {
  const { page, limit, skip } = getPagination(query);
  const filter = { status: S.PUBLISHED, ...notExpired(now) };
  if (query.type) filter.type = query.type;
  if (query.categoryId) filter.categoryId = query.categoryId;
  const [items, total] = await Promise.all([
    News.find(filter).select('-body -createdBy -updatedBy').sort({ isPinned: -1, publishedAt: -1, _id: -1 }).skip(skip).limit(limit).lean(),
    News.countDocuments(filter),
  ]);
  const categories = await categoriesFor(items);
  return { items: items.map((n) => toPublicDTO(n, categories, { now })), meta: buildMeta({ page, limit, total }) };
}

/**
 * Detail by slug. Public only when published; an expired notice still opens
 * (labelled expired) so shared links keep working, but it is left out of lists.
 * Admins may preview any status (response includes `status`). Everyone else: 404.
 */
export async function getBySlug(slug, user) {
  const n = await News.findOne({ slug }).lean();
  if (!n) throw AppError.notFound('News item not found.');
  if (n.status !== S.PUBLISHED && !isAdmin(user)) throw AppError.notFound('News item not found.');
  const dto = toPublicDTO(n, await categoriesFor([n]), { withBody: true });
  return isAdmin(user) ? { ...dto, status: n.status } : dto;
}

/* ----------------------------- admin (FR-NEWS-3) ----------------------------- */

export async function adminGet(id) {
  const n = await News.findById(id).lean();
  if (!n) throw AppError.notFound('News item not found.');
  return adminView(n);
}

export async function adminList({ status, type, q, page, limit }) {
  const p = getPagination({ page, limit });
  const filter = {};
  if (status) filter.status = status;
  if (type) filter.type = type;
  if (q) filter.title = new RegExp(escapeRegex(q), 'i');
  const [items, total] = await Promise.all([
    News.find(filter).sort({ updatedAt: -1, _id: -1 }).skip(p.skip).limit(p.limit).lean(),
    News.countDocuments(filter),
  ]);
  const categories = await categoriesFor(items);
  return { items: items.map((n) => toAdminDTO(n, categories)), meta: buildMeta({ ...p, total }) };
}

export async function create(admin, input) {
  const doc = new News({ slug: 'pending', createdBy: admin.id, updatedBy: admin.id });
  await applyFields(doc, { ...input, status: undefined, isPinned: undefined });
  doc.status = input.status ?? S.DRAFT;
  doc.contentUpdatedAt = new Date();
  if (doc.status === S.PUBLISHED) {
    assertPublishable(doc);
    doc.publishedAt = doc.contentUpdatedAt;
  }
  doc.isPinned = Boolean(input.isPinned);
  if (usesPinSlot(doc)) await assertPinSlot(doc._id);
  doc.slug = await slugFor(input.title);
  await doc.save();
  return adminView(doc);
}

/** Edit, publish, unpublish (draft), hide, pin or unpin. Removed items can't change. */
export async function update(admin, id, input) {
  const doc = await loadForAdmin(id);
  if (doc.status === S.ARCHIVED) throw AppError.conflict('This news item was removed and can no longer be changed.');
  const hadPinSlot = usesPinSlot(doc);
  if (await applyFields(doc, input)) doc.contentUpdatedAt = new Date();
  if (input.status !== undefined && input.status !== doc.status) {
    if (input.status === S.PUBLISHED) {
      assertPublishable(doc);
      doc.publishedAt ??= new Date(); // first publish time is kept when re-published
    }
    doc.status = input.status;
  }
  if (input.isPinned !== undefined) doc.isPinned = input.isPinned;
  if (!hadPinSlot && usesPinSlot(doc)) await assertPinSlot(doc._id);
  doc.updatedBy = admin.id;
  await doc.save();
  return adminView(doc);
}

/** DELETE = remove (archived, unpinned). Soft delete: the record is kept. */
export async function remove(admin, id) {
  const doc = await loadForAdmin(id);
  if (doc.status === S.ARCHIVED) throw AppError.conflict('Already removed.');
  doc.status = S.ARCHIVED;
  doc.isPinned = false;
  doc.updatedBy = admin.id;
  await doc.save();
  return { id: String(doc._id), status: doc.status };
}

/* ----------------------------- development seed ----------------------------- */

/**
 * Sample news for local development only - refused in production (no override).
 * Idempotent by slug. `publishedHoursAgo`, `editedHoursAgo` and `validForHours` are relative to `now`.
 */
export async function seedNews(list, categoryIdBySlug = new Map(), now = new Date()) {
  if (getEnv().isProduction) throw new Error('Sample data cannot be seeded in production.');
  let created = 0;
  for (const item of list) {
    if (await News.exists({ slug: item.slug })) continue;
    const { categorySlug, publishedHoursAgo = 1, editedHoursAgo, validForHours, status = S.PUBLISHED, ...rest } = item;
    const publishedAt = new Date(now.getTime() - publishedHoursAgo * 3_600_000);
    const draft = status === S.DRAFT;
    await News.create({
      ...rest,
      status,
      categoryId: categorySlug ? (categoryIdBySlug.get(categorySlug) ?? undefined) : undefined,
      publishedAt: draft ? undefined : publishedAt,
      // Content last edited when published, unless the sample says it was edited later.
      contentUpdatedAt: editedHoursAgo !== undefined ? new Date(now.getTime() - editedHoursAgo * 3_600_000) : draft ? now : publishedAt,
      validUntil: validForHours !== undefined ? new Date(now.getTime() + validForHours * 3_600_000) : undefined,
      isSeed: true,
    });
    created += 1;
  }
  return { created, skipped: list.length - created };
}
