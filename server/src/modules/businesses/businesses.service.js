import mongoose from 'mongoose';
import { Business, BUSINESS_STATUS, MAX_PHOTOS, normaliseName } from './businesses.model.js';
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
import { getEnv } from '../../config/env.js';

const S = BUSINESS_STATUS;

// Paths under /businesses that must never become a slug.
const RESERVED_SLUGS = new Set(['mine', 'new', 'manage', 'admin', 'search', 'submissions']);

/** Identity/placement ("material") fields: owners may change them only before approval. */
const MATERIAL_FIELDS = ['name', 'categoryId', 'subcategoryId', 'kind', 'address', 'location'];
/** Statuses in which the owner may still edit material fields (not yet live). */
const OWNER_DRAFT_STATUSES = [S.DRAFT, S.PENDING, S.REJECTED];
/** Statuses that are "in progress" submissions of a user. */
const OPEN_SUBMISSION_STATUSES = [S.DRAFT, S.PENDING, S.REJECTED];

export const SUBMISSION_LIMITS = Object.freeze({ maxPending: 3, maxOpen: 10 });

/** Default kind from the main category when the submitter doesn't choose one. */
const KIND_BY_MAIN_SLUG = { 'food-dining': 'food', shopping: 'shop' };
const kindFor = (mainCategory, explicit) => explicit ?? KIND_BY_MAIN_SLUG[mainCategory?.slug] ?? 'service';

const CARD_FIELDS =
  'name slug kind categoryId subcategoryId address location contact.phone contact.whatsapp photos isVerified isSeed ratingAvg ratingCount openingHours updatedAt priceRange food.cuisines food.isVegFriendly';

/* ----------------------------- food (Step 4) ----------------------------- */

/** Card-level food summary (no menu, to keep list payloads small). */
function foodSummary(b) {
  if (b.kind !== 'food') return null;
  return { cuisines: b.food?.cuisines ?? [], isVegFriendly: Boolean(b.food?.isVegFriendly) };
}

function foodDetail(b) {
  if (b.kind !== 'food') return null;
  return {
    cuisines: b.food?.cuisines ?? [],
    isVegFriendly: Boolean(b.food?.isVegFriendly),
    menu: (b.food?.menu ?? []).map((sec) => ({
      section: sec.section,
      items: sec.items.map(({ name, price, isVeg }) => ({ name, price, isVeg: Boolean(isVeg) })),
    })),
  };
}

/**
 * Apply price range and food details. Food details are only for businesses
 * of kind "food"; if a business stops being food, its food details are removed.
 */
function applyFoodFields(doc, input) {
  if (input.priceRange !== undefined) doc.priceRange = input.priceRange === null ? undefined : input.priceRange;
  if (input.food !== undefined) {
    if (doc.kind !== 'food') {
      throw AppError.validation('Cuisines and menus are only for food businesses.', [
        { field: 'body.food', message: 'Only for food businesses' },
      ]);
    }
    const current = doc.food ? { cuisines: doc.food.cuisines, isVegFriendly: doc.food.isVegFriendly, menu: doc.food.menu } : {};
    doc.food = { cuisines: [], isVegFriendly: false, menu: [], ...current, ...input.food };
  }
  if (doc.kind !== 'food' && doc.food) doc.food = undefined;
}

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
    subcategory: b.subcategoryId ? (categories.get(String(b.subcategoryId)) ?? null) : null,
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
    priceRange: b.priceRange ?? null,
    food: foodSummary(b),
    updatedAt: b.updatedAt,
  };
}

/** Review trail: only for the owner (their own submission) and admins. */
function reviewFields(b) {
  return {
    status: b.status,
    submittedAt: b.submittedAt ?? null,
    reviewedAt: b.reviewedAt ?? null,
    rejectionReason: b.status === S.REJECTED ? (b.rejectionReason ?? null) : null,
  };
}

function toDetail(b, categories, user, { now = new Date(), includeReview = false } = {}) {
  const manage = isAdmin(user) || isOwnerOf(user, b);
  return {
    id: String(b._id),
    slug: b.slug,
    name: b.name,
    kind: b.kind,
    category: categories.get(String(b.categoryId)) ?? null,
    subcategory: b.subcategoryId ? (categories.get(String(b.subcategoryId)) ?? null) : null,
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
    priceRange: b.priceRange ?? null,
    food: foodDetail(b),
    isVerified: Boolean(b.isVerified),
    verifiedAt: b.verifiedAt ?? null,
    isSeed: Boolean(b.isSeed),
    ratingAvg: b.ratingAvg ?? 0,
    ratingCount: b.ratingCount ?? 0,
    updatedAt: b.updatedAt,
    createdAt: b.createdAt,
    // Management fields only for the owner or an admin.
    ...(manage ? { status: b.status, canManage: true } : { canManage: false }),
    ...(manage && includeReview ? reviewFields(b) : {}),
    ...(isAdmin(user) ? { ownerId: b.ownerId ? String(b.ownerId) : null } : {}),
  };
}

function toAdminRow(b, categories, users) {
  return {
    id: String(b._id),
    slug: b.slug,
    name: b.name,
    kind: b.kind,
    category: categories.get(String(b.categoryId)) ?? null,
    subcategory: b.subcategoryId ? (categories.get(String(b.subcategoryId)) ?? null) : null,
    area: b.address?.area ?? null,
    status: b.status,
    isVerified: Boolean(b.isVerified),
    isSeed: Boolean(b.isSeed),
    owner: b.ownerId ? (users.get(String(b.ownerId)) ?? { id: String(b.ownerId), name: null }) : null,
    submittedAt: b.submittedAt ?? null,
    reviewedAt: b.reviewedAt ?? null,
    rejectionReason: b.status === S.REJECTED ? (b.rejectionReason ?? null) : null,
    photo: b.photos?.[0] ?? null,
    updatedAt: b.updatedAt,
  };
}

async function categoryMapFor(items) {
  return categoriesService.getSummariesByIds(items.flatMap((b) => [b.categoryId, b.subcategoryId]));
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

/**
 * Duplicate guard: the same (normalised) name in the same area may exist only
 * once among listings that are live or in progress. Rejected and archived
 * listings don't block a new one.
 */
async function assertNotDuplicate(name, area, excludeId) {
  const filter = {
    nameKey: normaliseName(name),
    'address.area': area,
    status: { $nin: [S.ARCHIVED, S.REJECTED] },
  };
  if (excludeId) filter._id = { $ne: excludeId };
  if (await Business.exists(filter)) {
    throw AppError.conflict('A business with this name is already listed in this area.', [
      { field: 'body.name', message: 'Already listed in this area' },
    ]);
  }
}

async function assertPendingLimit(userId, excludeId) {
  const filter = { ownerId: userId, status: S.PENDING };
  if (excludeId) filter._id = { $ne: excludeId };
  if ((await Business.countDocuments(filter)) >= SUBMISSION_LIMITS.maxPending) {
    throw AppError.conflict(
      `You already have ${SUBMISSION_LIMITS.maxPending} businesses waiting for review. Please wait for a decision first.`,
    );
  }
}

async function loadForWrite(id) {
  const doc = await Business.findById(id);
  if (!doc) throw AppError.notFound('Business not found.');
  return doc;
}

/** Non-admins: the business must exist and be theirs; otherwise 404 (no ID probing). */
async function loadOwnForWrite(user, id) {
  const doc = await Business.findById(id);
  if (!doc || doc.status === S.ARCHIVED || !isOwnerOf(user, doc)) throw AppError.notFound('Business not found.');
  return doc;
}

/* ----------------------------- public reads ----------------------------- */

/** FR-BUS-1/2: published (approved) businesses only, with filters, distance, pagination. */
export async function listPublic(query, now = new Date()) {
  const { page, limit, skip } = getPagination(query);
  const filter = { status: S.PUBLISHED };
  if (query.categoryId) filter.categoryId = new mongoose.Types.ObjectId(query.categoryId);
  if (query.subcategoryId) filter.subcategoryId = new mongoose.Types.ObjectId(query.subcategoryId);
  if (query.kind) filter.kind = query.kind;
  if (query.area) filter['address.area'] = query.area;
  // Food filters (FR-FOOD-2) imply food businesses.
  if (query.cuisine || query.isVegFriendly !== undefined) filter.kind = 'food';
  if (query.cuisine) filter['food.cuisines'] = query.cuisine;
  if (query.isVegFriendly !== undefined) filter['food.isVegFriendly'] = query.isVegFriendly;
  if (query.priceRange) filter.priceRange = query.priceRange;
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
      { $facet: { items: [{ $skip: skip }, { $limit: limit }], total: [{ $count: 'n' }] } },
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

  const categories = await categoryMapFor(items);
  return { items: items.map((b) => toCard(b, categories, now)), meta: buildMeta({ page, limit, total }) };
}

/**
 * FR-BUS-3: detail by slug. Published is public; owners see their own
 * non-archived listing in any status; admins see everything. Everyone else
 * gets 404 (not 403) so pending/rejected listings are never revealed.
 * Review notes are not included here (see getMine / adminGetSubmission).
 */
export async function getBySlug(slug, user, now = new Date()) {
  const b = await Business.findOne({ slug }).lean();
  if (!b) throw AppError.notFound('Business not found.');
  if (b.status !== S.PUBLISHED) {
    const ownerCanSee = isOwnerOf(user, b) && b.status !== S.ARCHIVED;
    if (!isAdmin(user) && !ownerCanSee) throw AppError.notFound('Business not found.');
  }
  return toDetail(b, await categoryMapFor([b]), user, { now });
}

/* ----------------------------- my businesses ----------------------------- */

/** "My Businesses": every non-archived listing the caller owns, any status. */
export async function listMine(user) {
  const items = await Business.find({ ownerId: user.id, status: { $ne: S.ARCHIVED } })
    .sort({ updatedAt: -1 })
    .limit(100)
    .lean();
  const categories = await categoryMapFor(items);
  return items.map((b) => toAdminRow(b, categories, new Map()));
}

/** One of the caller's own listings, with status and rejection reason (for editing). */
export async function getMine(user, id) {
  const b = await Business.findOne({ _id: id, ownerId: user.id, status: { $ne: S.ARCHIVED } }).lean();
  if (!b) throw AppError.notFound('Business not found.');
  return toDetail(b, await categoryMapFor([b]), user, { includeReview: true });
}

/**
 * A signed-in user submits their own business. The server sets owner, status
 * and audit fields - nothing of that is accepted from the client.
 */
export async function submitBusiness(user, input) {
  const openCount = await Business.countDocuments({ ownerId: user.id, status: { $in: OPEN_SUBMISSION_STATUSES } });
  if (openCount >= SUBMISSION_LIMITS.maxOpen) {
    throw AppError.conflict('You have too many unfinished submissions. Finish or wait for the existing ones first.');
  }
  if (input.submit) await assertPendingLimit(user.id);
  const { category, subcategory } = await categoriesService.assertCategoryPair(input.categoryId, input.subcategoryId);
  await assertNotDuplicate(input.name, input.address.area);

  const now = new Date();
  const doc = new Business({
    name: input.name,
    slug: await slugFor(input.name),
    categoryId: input.categoryId,
    subcategoryId: input.subcategoryId,
    kind: kindFor(category, input.kind),
    description: input.description,
    tags: input.tags ? dedupe(input.tags) : [],
    address: { ...input.address, pincode: input.address.pincode || undefined },
    location: toPoint(input.location.lat, input.location.lng),
    contact: cleanContact(input.contact) ?? {},
    openingHours: input.openingHours ?? [],
    photos: assertOwnImages(input.photos ?? [], 'business_photo', { max: MAX_PHOTOS }),
    ownerId: user.id,
    createdBy: user.id,
    status: input.submit ? S.PENDING : S.DRAFT,
    submittedAt: input.submit ? now : undefined,
  });
  applyFoodFields(doc, input);
  await doc.save();
  return toDetail(doc.toObject(), new Map([[String(category.id), category], [String(subcategory.id), subcategory]]), user, {
    includeReview: true,
  });
}

/** Draft or rejected -> pending (resubmission clears the old rejection reason). */
export async function submitForReview(user, id) {
  const doc = await loadOwnForWrite(user, id);
  if (![S.DRAFT, S.REJECTED].includes(doc.status)) {
    throw AppError.conflict('Only a draft or rejected listing can be submitted for review.');
  }
  await assertPendingLimit(user.id, doc._id);
  await assertNotDuplicate(doc.name, doc.address.area, doc._id);
  doc.status = S.PENDING;
  doc.submittedAt = new Date();
  doc.rejectionReason = undefined;
  await doc.save();
  return toDetail(doc.toObject(), await categoryMapFor([doc]), user, { includeReview: true });
}

/* ----------------------------- updates ----------------------------- */

async function applyCategoryChange(doc, input) {
  if (input.categoryId === undefined && input.subcategoryId === undefined) return;
  const categoryId = input.categoryId ?? doc.categoryId;
  const subcategoryId = input.subcategoryId ?? doc.subcategoryId;
  const { category } = await categoriesService.assertCategoryPair(categoryId, subcategoryId);
  doc.categoryId = categoryId;
  doc.subcategoryId = subcategoryId;
  // Self-submitted listings follow their main category unless a kind is given.
  if (input.kind === undefined && input.categoryId !== undefined && doc.submittedAt) {
    doc.kind = kindFor(category, undefined);
  }
}

function applyCommonFields(doc, input) {
  if (input.name !== undefined) doc.name = input.name; // slug is permanent
  if (input.kind !== undefined) doc.kind = input.kind;
  if (input.description !== undefined) doc.description = input.description;
  if (input.tags !== undefined) doc.tags = dedupe(input.tags);
  if (input.address !== undefined) doc.address = { ...input.address, pincode: input.address.pincode || undefined };
  if (input.location !== undefined) doc.location = toPoint(input.location.lat, input.location.lng);
  if (input.contact !== undefined) doc.contact = cleanContact(input.contact);
  if (input.openingHours !== undefined) doc.openingHours = input.openingHours;
  if (input.photos !== undefined) doc.photos = assertOwnImages(input.photos, 'business_photo', { max: MAX_PHOTOS });
}

/**
 * FR-BUS-4/5 + submissions:
 * - admins edit anything;
 * - owners edit their own listing: everything while it is draft, pending or
 *   rejected; once approved (published/hidden) only description, tags,
 *   contact, hours and photos - material changes need an admin.
 */
export async function updateBusiness(user, id, input) {
  const admin = isAdmin(user);
  const doc = admin ? await loadForWrite(id) : await loadOwnForWrite(user, id);

  if (!admin) {
    if (!OWNER_DRAFT_STATUSES.includes(doc.status)) {
      const blocked = MATERIAL_FIELDS.filter((f) => input[f] !== undefined);
      if (blocked.length) {
        throw AppError.forbidden(`This listing is approved. Ask an admin to change: ${blocked.join(', ')}.`);
      }
    }
    // Self-submitted listings must keep a contact phone.
    if (input.contact !== undefined && !input.contact.phone && doc.submittedAt) {
      throw AppError.validation('A contact phone is required.', [{ field: 'body.contact.phone', message: 'Required' }]);
    }
  }

  await applyCategoryChange(doc, input);
  const nameOrAreaChanges =
    (input.name !== undefined && input.name !== doc.name) ||
    (input.address !== undefined && input.address.area !== doc.address.area);
  if (nameOrAreaChanges) {
    await assertNotDuplicate(input.name ?? doc.name, input.address?.area ?? doc.address.area, doc._id);
  }
  applyCommonFields(doc, input);
  applyFoodFields(doc, input);
  if (admin) {
    if (input.status !== undefined) doc.status = input.status;
    if (input.ownerId !== undefined) doc.ownerId = input.ownerId === null ? undefined : await prepareOwner(input.ownerId);
  }

  await doc.save();
  return toDetail(doc.toObject(), await categoryMapFor([doc]), user, { includeReview: !admin });
}

/* ----------------------------- admin ----------------------------- */

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
    categoryMapFor(items),
    usersService.getSummariesByIds(items.map((b) => b.ownerId).filter(Boolean)),
  ]);
  return { items: items.map((b) => toAdminRow(b, categories, owners)), meta: buildMeta({ ...p, total }) };
}

/** Admin review queue: self-submitted listings by review status (oldest pending first). */
export async function adminSubmissions({ status, q, page, limit }) {
  const p = getPagination({ page, limit });
  const filter = { submittedAt: { $exists: true }, status };
  if (q) filter.name = new RegExp(escapeRegex(q), 'i');
  const sort = status === S.PENDING ? { submittedAt: 1 } : { reviewedAt: -1, updatedAt: -1 };
  const [items, total] = await Promise.all([
    Business.find(filter).sort(sort).skip(p.skip).limit(p.limit).lean(),
    Business.countDocuments(filter),
  ]);
  const [categories, owners] = await Promise.all([
    categoryMapFor(items),
    usersService.getSummariesByIds(items.map((b) => b.ownerId).filter(Boolean)),
  ]);
  return { items: items.map((b) => toAdminRow(b, categories, owners)), meta: buildMeta({ ...p, total }) };
}

/** Admin: full submission with submitter and reviewer. */
export async function adminGetSubmission(admin, id) {
  const b = await Business.findById(id).lean();
  if (!b) throw AppError.notFound('Business not found.');
  const users = await usersService.getSummariesByIds([b.ownerId, b.reviewedBy].filter(Boolean));
  return {
    ...toDetail(b, await categoryMapFor([b]), admin),
    ...reviewFields(b),
    owner: b.ownerId ? (users.get(String(b.ownerId)) ?? null) : null,
    reviewedBy: b.reviewedBy ? (users.get(String(b.reviewedBy)) ?? { id: String(b.reviewedBy), name: null }) : null,
  };
}

/** Approve a pending submission: it goes live and the submitter becomes an owner. */
export async function approveSubmission(admin, id) {
  const doc = await loadForWrite(id);
  if (doc.status !== S.PENDING) throw AppError.conflict('Only pending submissions can be approved.');
  await categoriesService.assertCategoryPair(doc.categoryId, doc.subcategoryId);
  if (doc.ownerId) await prepareOwner(doc.ownerId);
  doc.status = S.PUBLISHED;
  doc.reviewedBy = admin.id;
  doc.reviewedAt = new Date();
  doc.rejectionReason = undefined;
  await doc.save();
  return adminGetSubmission(admin, id);
}

/** Reject a pending submission with a reason the owner can read. */
export async function rejectSubmission(admin, id, reason) {
  const doc = await loadForWrite(id);
  if (doc.status !== S.PENDING) throw AppError.conflict('Only pending submissions can be rejected.');
  doc.status = S.REJECTED;
  doc.rejectionReason = reason;
  doc.reviewedBy = admin.id;
  doc.reviewedAt = new Date();
  await doc.save();
  return adminGetSubmission(admin, id);
}

/** FR-BUS-4: admin creates a business (draft by default), optionally assigning an owner. */
export async function createBusiness(user, input) {
  const { category } = await categoriesService.assertCategoryPair(input.categoryId, input.subcategoryId);
  await assertNotDuplicate(input.name, input.address.area);
  const doc = new Business({
    name: input.name,
    slug: await slugFor(input.name),
    categoryId: input.categoryId,
    subcategoryId: input.subcategoryId,
    kind: kindFor(category, input.kind),
    description: input.description,
    tags: input.tags ? dedupe(input.tags) : [],
    address: { ...input.address, pincode: input.address.pincode || undefined },
    location: toPoint(input.location.lat, input.location.lng),
    contact: cleanContact(input.contact) ?? {},
    openingHours: input.openingHours ?? [],
    photos: assertOwnImages(input.photos ?? [], 'business_photo', { max: MAX_PHOTOS }),
    status: input.status ?? S.DRAFT,
    createdBy: user.id,
  });
  applyFoodFields(doc, input);
  if (input.ownerId) doc.ownerId = await prepareOwner(input.ownerId);
  await doc.save();
  return toDetail(doc.toObject(), await categoryMapFor([doc]), user);
}

/** DELETE = soft delete (archive). Admin only. */
export async function archiveBusiness(id) {
  const doc = await loadForWrite(id);
  doc.status = S.ARCHIVED;
  await doc.save();
  return { id: String(doc._id), status: doc.status };
}

/** FR-BUS-6: verify / unverify. Sample (seed) content can never be verified. */
export async function setVerified(id, isVerified) {
  const doc = await loadForWrite(id);
  if (isVerified && doc.isSeed) throw AppError.validation('Sample data cannot be marked verified.');
  if (isVerified && doc.status !== S.PUBLISHED) throw AppError.conflict('Only approved (published) businesses can be verified.');
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
  if (!b || b.status === S.ARCHIVED) throw AppError.notFound('Business not found.');
  if (!isAdmin(user) && !isOwnerOf(user, b)) throw AppError.forbidden('You can only manage your own business.');
  return b;
}

/**
 * Offers (Step 5), reviews (Step 9) and search (Step 8) MUST use this or
 * getPublishedIds: content of a business that is not approved/published
 * (draft, pending, rejected, hidden, archived) is never public.
 */
export async function assertPublished(businessId, field = 'body.businessId') {
  const b = await Business.findOne({ _id: businessId, status: S.PUBLISHED }).lean();
  if (!b) throw AppError.validation('The business must be published.', [{ field, message: 'Business is not published' }]);
  return b;
}

export async function getPublishedIds(ids) {
  const found = await Business.find({ _id: { $in: ids }, status: S.PUBLISHED }).select('_id').lean();
  return new Set(found.map((b) => String(b._id)));
}

/** Small summaries for cards in other modules (offers, favorites, events). */
export async function getSummariesByIds(ids, { publishedOnly = true } = {}) {
  const filter = { _id: { $in: ids } };
  if (publishedOnly) filter.status = S.PUBLISHED;
  const items = await Business.find(filter).select('name slug address.area photos isVerified isSeed').slice('photos', 1).lean();
  return new Map(
    items.map((b) => [
      String(b._id),
      { id: String(b._id), name: b.name, slug: b.slug, area: b.address?.area ?? null, photo: b.photos?.[0] ?? null, isVerified: b.isVerified, isSeed: b.isSeed },
    ]),
  );
}

export async function countBySubcategory(categoryId) {
  return Business.countDocuments({ $or: [{ categoryId }, { subcategoryId: categoryId }] });
}

/**
 * Seed sample businesses (always isSeed, never verified). Idempotent by slug.
 * `categoryIdBySlug` maps a SUBcategory slug -> { id, parentId }.
 */
export async function seedBusinesses(list, categoryIdBySlug) {
  // Defence in depth: sample data never reaches production, whatever the caller.
  if (getEnv().isProduction) throw new Error('Sample data cannot be seeded in production.');
  let created = 0;
  for (const item of list) {
    if (await Business.exists({ slug: item.slug })) continue;
    const cat = categoryIdBySlug.get(item.categorySlug);
    if (!cat) continue;
    const ids = cat.parentId ? { categoryId: cat.parentId, subcategoryId: cat.id } : { categoryId: cat.id ?? cat };
    const { categorySlug: _c, lat, lng, ...rest } = item;
    await Business.create({ ...rest, ...ids, location: toPoint(lat, lng), isSeed: true, isVerified: false, status: S.PUBLISHED });
    created += 1;
  }
  return { created, skipped: list.length - created };
}

/**
 * One-off, idempotent migration for listings created before two-level
 * categories: when categoryId points at what is now a SUBcategory, move it to
 * subcategoryId and set categoryId to its main category. Also backfills the
 * duplicate-check key. dryRun=true only counts.
 */
export async function migrateCategoryReferences({ dryRun = true } = {}) {
  const docs = await Business.find({ $or: [{ subcategoryId: { $exists: false } }, { nameKey: { $exists: false } }] })
    .select('categoryId subcategoryId name nameKey')
    .lean();
  const parents = await categoriesService.getParentMap(docs.map((d) => d.categoryId));
  let remapped = 0;
  let keyed = 0;
  for (const d of docs) {
    const set = {};
    const parent = parents.get(String(d.categoryId));
    if (!d.subcategoryId && parent) {
      set.subcategoryId = d.categoryId;
      set.categoryId = new mongoose.Types.ObjectId(parent);
      remapped += 1;
    }
    if (!d.nameKey) {
      set.nameKey = normaliseName(d.name);
      keyed += 1;
    }
    if (!dryRun && Object.keys(set).length) await Business.updateOne({ _id: d._id }, { $set: set });
  }
  return { examined: docs.length, remapped, keyed, dryRun };
}
