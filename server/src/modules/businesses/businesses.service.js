import mongoose from 'mongoose';
import { Business, BUSINESS_STATUS, MAX_PHOTOS } from './businesses.model.js';
import * as categoriesService from '../categories/categories.service.js';
import * as usersService from '../users/users.service.js';
import { assertOwnImages } from '../media/media.service.js';
import { AppError } from '../../common/errors/index.js';
import { getPagination, buildMeta } from '../../common/utils/pagination.js';
import { generateUniqueSlug } from '../../common/utils/slug.js';
import { toPoint, fromPoint, kmToMeters, clampRadiusKm } from '../../common/utils/geo.js';
import { isOpenAt, openNowFilter } from '../../common/utils/hours.js';
import { escapeRegex } from '../../common/utils/validators.js';
import { ROLES } from '../../config/constants.js';

// Paths under /businesses that must never become a slug.
const RESERVED_SLUGS = new Set(['mine', 'new', 'manage', 'admin', 'search']);
const ADMIN_ONLY_FIELDS = ['name', 'categoryId', 'kind', 'address', 'location', 'status', 'ownerId'];

const CARD_FIELDS =
  'name slug kind categoryId address location contact.phone contact.whatsapp photos isVerified isSeed ratingAvg ratingCount openingHours updatedAt';

const isAdmin = (user) => user?.role === ROLES.ADMIN;
const isOwnerOf = (user, b) => Boolean(user && b.ownerId && String(b.ownerId) === String(user.id));

/* ----------------------------- DTOs ----------------------------- */

function toCard(b, categories, now) {
  return {
    id: String(b._id),
    slug: b.slug,
    name: b.name,
    kind: b.kind,
    category: categories.get(String(b.categoryId)) ?? null,
    area: b.address?.area ?? null,
    addressLine: b.address?.line ?? null,
    location: fromPoint(b.location),
    ...(b.distanceM !== undefined ? { distanceM: Math.round(b.distanceM) } : {}),
    photo: b.photos?.[0] ?? null,
    isVerified: Boolean(b.isVerified),
    isSeed: Boolean(b.isSeed),
    ratingAvg: b.ratingAvg ?? 0,
    ratingCount: b.ratingCount ?? 0,
    isOpenNow: isOpenAt(b.openingHours, now),
    contact: { phone: b.contact?.phone ?? null, whatsapp: b.contact?.whatsapp ?? null },
    updatedAt: b.updatedAt,
  };
}

function toDetail(b, category, user, now = new Date()) {
  const manage = isAdmin(user) || isOwnerOf(user, b);
  return {
    id: String(b._id),
    slug: b.slug,
    name: b.name,
    kind: b.kind,
    category,
    description: b.description ?? '',
    tags: b.tags ?? [],
    address: { line: b.address.line, area: b.address.area, pincode: b.address.pincode ?? null },
    location: fromPoint(b.location),
    contact: {
      phone: b.contact?.phone ?? null,
      whatsapp: b.contact?.whatsapp ?? null,
      email: b.contact?.email ?? null,
      website: b.contact?.website ?? null,
    },
    openingHours: (b.openingHours ?? []).map(({ day, open, close, closed }) => ({
      day,
      open: open ?? null,
      close: close ?? null,
      closed: Boolean(closed),
    })),
    isOpenNow: isOpenAt(b.openingHours, now),
    photos: b.photos ?? [],
    isVerified: Boolean(b.isVerified),
    verifiedAt: b.verifiedAt ?? null,
    isSeed: Boolean(b.isSeed),
    ratingAvg: b.ratingAvg ?? 0,
    ratingCount: b.ratingCount ?? 0,
    updatedAt: b.updatedAt,
    createdAt: b.createdAt,
    // Management fields only for the owner or an admin.
    ...(manage ? { status: b.status, canManage: true } : { canManage: false }),
    ...(isAdmin(user) ? { ownerId: b.ownerId ? String(b.ownerId) : null } : {}),
  };
}

function toAdminRow(b, categories, owners) {
  return {
    id: String(b._id),
    slug: b.slug,
    name: b.name,
    kind: b.kind,
    category: categories.get(String(b.categoryId)) ?? null,
    area: b.address?.area ?? null,
    status: b.status,
    isVerified: Boolean(b.isVerified),
    isSeed: Boolean(b.isSeed),
    owner: b.ownerId ? (owners.get(String(b.ownerId)) ?? { id: String(b.ownerId), name: null }) : null,
    updatedAt: b.updatedAt,
  };
}

/* ----------------------------- helpers ----------------------------- */

function cleanContact(contact) {
  if (!contact) return contact;
  return Object.fromEntries(Object.entries(contact).filter(([, v]) => v));
}

const dedupe = (tags) => [...new Set(tags.map((t) => t.trim()).filter(Boolean))];

async function slugFor(name) {
  return generateUniqueSlug(name, async (s) => RESERVED_SLUGS.has(s) || Boolean(await Business.exists({ slug: s })));
}

/** Owner must be an existing, active account; plain users are promoted to owner. */
async function prepareOwner(ownerId) {
  const owner = await usersService.assertUserExists(ownerId);
  if (owner.status === 'blocked') {
    throw AppError.validation('Blocked users cannot own a business.', [{ field: 'body.ownerId', message: 'User is blocked' }]);
  }
  await usersService.ensureOwnerRole(ownerId);
  return owner._id;
}

async function loadForWrite(id) {
  const doc = await Business.findById(id);
  if (!doc) throw AppError.notFound('Business not found.');
  return doc;
}

/* ----------------------------- public reads ----------------------------- */

/** FR-BUS-1/2: published businesses with filters, optional distance, pagination. */
export async function listPublic(query, now = new Date()) {
  const { page, limit, skip } = getPagination(query);
  const filter = { status: BUSINESS_STATUS.PUBLISHED };
  if (query.categoryId) filter.categoryId = new mongoose.Types.ObjectId(query.categoryId);
  if (query.kind) filter.kind = query.kind;
  if (query.area) filter['address.area'] = query.area;
  if (query.isVerified !== undefined) filter.isVerified = query.isVerified;
  if (query.openNow) Object.assign(filter, openNowFilter(now));

  let items;
  let total;
  if (query.lat !== undefined && query.lng !== undefined) {
    const sort =
      query.sort === 'rating'
        ? { ratingAvg: -1, ratingCount: -1, distanceM: 1 }
        : query.sort === 'newest'
          ? { updatedAt: -1 }
          : { distanceM: 1 };
    const [result] = await Business.aggregate([
      {
        $geoNear: {
          near: toPoint(query.lat, query.lng),
          distanceField: 'distanceM',
          maxDistance: kmToMeters(clampRadiusKm(query.radiusKm)),
          spherical: true,
          key: 'location',
          query: filter,
        },
      },
      { $sort: sort },
      {
        $facet: {
          items: [{ $skip: skip }, { $limit: limit }],
          total: [{ $count: 'n' }],
        },
      },
    ]);
    items = result.items;
    total = result.total[0]?.n ?? 0;
  } else {
    const sort = query.sort === 'rating' ? { ratingAvg: -1, ratingCount: -1, _id: 1 } : { updatedAt: -1, _id: 1 };
    [items, total] = await Promise.all([
      Business.find(filter).select(CARD_FIELDS).slice('photos', 1).sort(sort).skip(skip).limit(limit).lean(),
      Business.countDocuments(filter),
    ]);
  }

  const categories = await categoriesService.getSummariesByIds(items.map((b) => b.categoryId));
  return { items: items.map((b) => toCard(b, categories, now)), meta: buildMeta({ page, limit, total }) };
}

/**
 * FR-BUS-3: detail by slug. Published is public; owners see their own draft or
 * hidden business; admins see everything. Others get 404 (not 403) so hidden
 * content isn't revealed.
 */
export async function getBySlug(slug, user, now = new Date()) {
  const b = await Business.findOne({ slug }).lean();
  if (!b) throw AppError.notFound('Business not found.');
  if (b.status !== BUSINESS_STATUS.PUBLISHED) {
    const ownerCanSee = isOwnerOf(user, b) && b.status !== BUSINESS_STATUS.ARCHIVED;
    if (!isAdmin(user) && !ownerCanSee) throw AppError.notFound('Business not found.');
  }
  const categories = await categoriesService.getSummariesByIds([b.categoryId]);
  return toDetail(b, categories.get(String(b.categoryId)) ?? null, user, now);
}

/* ----------------------------- management ----------------------------- */

/** Owner dashboard: businesses the caller owns (any status except archived). */
export async function listMine(user) {
  const items = await Business.find({ ownerId: user.id, status: { $ne: BUSINESS_STATUS.ARCHIVED } })
    .sort({ name: 1 })
    .limit(100)
    .lean();
  const categories = await categoriesService.getSummariesByIds(items.map((b) => b.categoryId));
  return items.map((b) => toAdminRow(b, categories, new Map()));
}

/** Admin: every business, any status, searchable. */
export async function adminList({ q, status, ownerId, page, limit }) {
  const p = getPagination({ page, limit });
  const filter = {};
  if (status) filter.status = status;
  if (ownerId) filter.ownerId = ownerId;
  if (q) filter.name = new RegExp(escapeRegex(q), 'i');
  const [items, total] = await Promise.all([
    Business.find(filter).sort({ updatedAt: -1 }).skip(p.skip).limit(p.limit).lean(),
    Business.countDocuments(filter),
  ]);
  const [categories, owners] = await Promise.all([
    categoriesService.getSummariesByIds(items.map((b) => b.categoryId)),
    usersService.getSummariesByIds(items.map((b) => b.ownerId).filter(Boolean)),
  ]);
  return { items: items.map((b) => toAdminRow(b, categories, owners)), meta: buildMeta({ ...p, total }) };
}

/** FR-BUS-4: admin creates a business (draft by default), optionally assigning an owner. */
export async function createBusiness(user, input) {
  const category = await categoriesService.assertActiveCategory(input.categoryId, 'business');
  const doc = new Business({
    name: input.name,
    slug: await slugFor(input.name),
    categoryId: input.categoryId,
    kind: input.kind,
    description: input.description,
    tags: input.tags ? dedupe(input.tags) : [],
    address: { ...input.address, pincode: input.address.pincode || undefined },
    location: toPoint(input.location.lat, input.location.lng),
    contact: cleanContact(input.contact) ?? {},
    openingHours: input.openingHours ?? [],
    photos: assertOwnImages(input.photos ?? [], 'business_photo', { max: MAX_PHOTOS }),
    status: input.status ?? BUSINESS_STATUS.DRAFT,
    createdBy: user.id,
  });
  if (input.ownerId) doc.ownerId = await prepareOwner(input.ownerId);
  await doc.save();
  return toDetail(doc.toObject(), category, user);
}

/**
 * FR-BUS-4/5: admins edit anything; owners only their own business and only
 * description, tags, contact, hours and photos (checked here, not just in routes).
 */
export async function updateBusiness(user, id, input) {
  const doc = await loadForWrite(id);
  if (!isAdmin(user)) {
    if (!isOwnerOf(user, doc) || doc.status === BUSINESS_STATUS.ARCHIVED) {
      throw AppError.forbidden('You can only edit your own business.');
    }
    const blocked = ADMIN_ONLY_FIELDS.filter((f) => input[f] !== undefined);
    if (blocked.length) throw AppError.forbidden(`Only an admin can change: ${blocked.join(', ')}.`);
  }

  let category;
  if (input.categoryId) {
    category = await categoriesService.assertActiveCategory(input.categoryId, 'business');
    doc.categoryId = input.categoryId;
  }
  if (input.name !== undefined) doc.name = input.name; // slug is permanent
  if (input.kind !== undefined) doc.kind = input.kind;
  if (input.description !== undefined) doc.description = input.description;
  if (input.tags !== undefined) doc.tags = dedupe(input.tags);
  if (input.address !== undefined) doc.address = { ...input.address, pincode: input.address.pincode || undefined };
  if (input.location !== undefined) doc.location = toPoint(input.location.lat, input.location.lng);
  if (input.contact !== undefined) doc.contact = cleanContact(input.contact);
  if (input.openingHours !== undefined) doc.openingHours = input.openingHours;
  if (input.photos !== undefined) doc.photos = assertOwnImages(input.photos, 'business_photo', { max: MAX_PHOTOS });
  if (input.status !== undefined) doc.status = input.status;
  if (input.ownerId !== undefined) doc.ownerId = input.ownerId === null ? undefined : await prepareOwner(input.ownerId);

  await doc.save();
  if (!category) {
    category = (await categoriesService.getSummariesByIds([doc.categoryId])).get(String(doc.categoryId)) ?? null;
  }
  return toDetail(doc.toObject(), category, user);
}

/** DELETE = soft delete (archive). Admin only. */
export async function archiveBusiness(id) {
  const doc = await loadForWrite(id);
  doc.status = BUSINESS_STATUS.ARCHIVED;
  await doc.save();
  return { id: String(doc._id), status: doc.status };
}

/** FR-BUS-6: verify / unverify. Sample (seed) content can never be verified. */
export async function setVerified(id, isVerified) {
  const doc = await loadForWrite(id);
  if (isVerified && doc.isSeed) throw AppError.validation('Sample data cannot be marked verified.');
  doc.isVerified = isVerified;
  doc.verifiedAt = isVerified ? new Date() : undefined;
  await doc.save();
  return { id: String(doc._id), isVerified: doc.isVerified, verifiedAt: doc.verifiedAt ?? null };
}

/* ----------------------------- for other modules ----------------------------- */

/**
 * Used by offers (Step 5): the caller must own the business or be an admin.
 * Returns the business (lean).
 */
export async function assertCanManage(user, businessId) {
  const b = await Business.findById(businessId).lean();
  if (!b || b.status === BUSINESS_STATUS.ARCHIVED) throw AppError.notFound('Business not found.');
  if (!isAdmin(user) && !isOwnerOf(user, b)) throw AppError.forbidden('You can only manage your own business.');
  return b;
}

/** A business must be published to receive offers or reviews. */
export async function assertPublished(businessId, field = 'body.businessId') {
  const b = await Business.findOne({ _id: businessId, status: BUSINESS_STATUS.PUBLISHED }).lean();
  if (!b) throw AppError.validation('The business must be published.', [{ field, message: 'Business is not published' }]);
  return b;
}

export async function getPublishedIds(ids) {
  const found = await Business.find({ _id: { $in: ids }, status: BUSINESS_STATUS.PUBLISHED }).select('_id').lean();
  return new Set(found.map((b) => String(b._id)));
}

/** Small summaries for cards in other modules (offers, favorites, events). */
export async function getSummariesByIds(ids, { publishedOnly = true } = {}) {
  const filter = { _id: { $in: ids } };
  if (publishedOnly) filter.status = BUSINESS_STATUS.PUBLISHED;
  const items = await Business.find(filter).select('name slug address.area photos isVerified isSeed').slice('photos', 1).lean();
  return new Map(
    items.map((b) => [
      String(b._id),
      { id: String(b._id), name: b.name, slug: b.slug, area: b.address?.area ?? null, photo: b.photos?.[0] ?? null, isVerified: b.isVerified, isSeed: b.isSeed },
    ]),
  );
}

/** Seed sample businesses (always isSeed, never verified). Idempotent by slug. */
export async function seedBusinesses(list, categoryIdBySlug) {
  let created = 0;
  for (const item of list) {
    if (await Business.exists({ slug: item.slug })) continue;
    const categoryId = categoryIdBySlug.get(item.categorySlug);
    if (!categoryId) continue;
    const { categorySlug: _c, lat, lng, ...rest } = item;
    await Business.create({ ...rest, categoryId, location: toPoint(lat, lng), isSeed: true, isVerified: false, status: BUSINESS_STATUS.PUBLISHED });
    created += 1;
  }
  return { created, skipped: list.length - created };
}
