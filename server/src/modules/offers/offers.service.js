import { Offer, OFFER_STATUS, OFFER_LIMIT_PER_BUSINESS } from './offers.model.js';
import * as businessesService from '../businesses/businesses.service.js';
import { assertOwnImage } from '../media/media.service.js';
import { AppError } from '../../common/errors/index.js';
import { getPagination, buildMeta } from '../../common/utils/pagination.js';
import { addOneYear, istEndOfDay, istStartOfDay, istToday, toIstDate } from '../../common/utils/dates.js';
import { matchFilter, relevance, rankPage, CANDIDATE_LIMIT } from '../../common/utils/textSearch.js';
import { getEnv } from '../../config/env.js';
import { ROLES } from '../../config/constants.js';

const O = OFFER_STATUS;

/* ----------------------------- helpers ----------------------------- */

/** "live" | "scheduled" | "expired" for published offers, else the stored status. */
export function displayStatus(offer, now = new Date()) {
  if (offer.status !== O.PUBLISHED) return offer.status;
  if (offer.validFrom > now) return 'scheduled';
  if (offer.validTo < now) return 'expired';
  return 'live';
}

/** Mongo filter for offers that are publicly valid right now (business status checked separately). */
const validNow = (now) => ({ status: O.PUBLISHED, validFrom: { $lte: now }, validTo: { $gte: now } });

/**
 * The business the caller may manage. Owners asking about someone else's
 * business get 404 (not 403) so business/offer ids can't be probed.
 */
async function manageableBusiness(user, businessId) {
  try {
    return await businessesService.assertCanManage(user, businessId);
  } catch (err) {
    if (err?.code === 'FORBIDDEN') throw AppError.notFound('Business not found.');
    throw err;
  }
}

async function canManage(user, businessId) {
  if (!user) return false;
  if (user.role === ROLES.ADMIN) return true;
  try {
    await manageableBusiness(user, businessId);
    return true;
  } catch {
    return false;
  }
}

function toDTO(o, business, { manage = false, now = new Date() } = {}) {
  return {
    id: String(o._id),
    businessId: String(o.businessId),
    business: business ?? null,
    title: o.title,
    description: o.description ?? '',
    discountLabel: o.discountLabel,
    couponCode: o.couponCode ?? null,
    terms: o.terms,
    redemptionInstructions: o.redemptionInstructions ?? '',
    image: o.image ?? null,
    validFrom: o.validFrom,
    validTo: o.validTo,
    // Date-only values as shown to users (IST).
    validFromDate: toIstDate(o.validFrom),
    validToDate: toIstDate(o.validTo),
    isSeed: Boolean(o.isSeed),
    createdAt: o.createdAt,
    updatedAt: o.updatedAt,
    ...(manage ? { status: o.status, displayStatus: displayStatus(o, now), canManage: true } : { canManage: false }),
  };
}

function businessInfo(b) {
  return { id: String(b._id), name: b.name, slug: b.slug, area: b.address?.area ?? null, status: b.status };
}

/**
 * Date rules (IST, date-only): end on or after start (a one-day offer is
 * 00:00-23:59 IST), at most one year, and a new/changed end date can't
 * already be in the past.
 */
function resolveDates(validFromDate, validToDate, { checkPast }) {
  const details = [];
  if (validToDate < validFromDate) details.push({ field: 'body.validTo', message: 'End date must be on or after the start date' });
  else if (validToDate >= addOneYear(validFromDate)) {
    details.push({ field: 'body.validTo', message: 'An offer can run for at most one year' });
  }
  if (checkPast && validToDate < istToday()) details.push({ field: 'body.validTo', message: 'End date is already in the past' });
  if (details.length) throw AppError.validation('Check the offer dates.', details);
  return { validFrom: istStartOfDay(validFromDate), validTo: istEndOfDay(validToDate) };
}

function blank(v) {
  return v === undefined || v === null || v === '';
}

/** Live + scheduled offers of a business (drafts, hidden and expired don't count). */
async function countActiveOrScheduled(businessId, now = new Date()) {
  return Offer.countDocuments({ businessId, status: O.PUBLISHED, validTo: { $gte: now } });
}

const limitError = () =>
  AppError.conflict(`A business can have at most ${OFFER_LIMIT_PER_BUSINESS} live or scheduled offers. Hide or end one first.`);

/* ----------------------------- public reads ----------------------------- */

/**
 * FR-OFF-1: currently valid offers of PUBLISHED businesses. Business filters
 * (category, area, near me) are resolved by the businesses module into ids,
 * so hiding/archiving a business hides its offers immediately.
 */
export async function listPublic(query, now = new Date()) {
  const { page, limit, skip } = getPagination(query);
  const base = validNow(now);
  if (query.businessId) base.businessId = query.businessId;

  // Only businesses that currently have a valid offer can matter.
  const candidates = await Offer.distinct('businessId', base);
  const publishedIds = candidates.length
    ? await businessesService.findPublishedIds({
        ids: candidates,
        categoryId: query.categoryId,
        subcategoryId: query.subcategoryId,
        area: query.area,
        lat: query.lat,
        lng: query.lng,
        radiusKm: query.radiusKm,
      })
    : [];

  const filter = { ...base, businessId: { $in: publishedIds } };
  const sort = query.sort === 'newest' ? { createdAt: -1, _id: -1 } : { validTo: 1, _id: 1 };
  const [items, total] = await Promise.all([
    publishedIds.length ? Offer.find(filter).sort(sort).skip(skip).limit(limit).lean() : [],
    publishedIds.length ? Offer.countDocuments(filter) : 0,
  ]);
  const businesses = await businessesService.getSummariesByIds([...new Set(items.map((o) => String(o.businessId)))]);
  return {
    items: items.map((o) => toDTO(o, businesses.get(String(o.businessId)), { now })),
    meta: buildMeta({ page, limit, total }),
  };
}

/**
 * FR-SRCH-1/2 (Step 8): currently valid offers of PUBLISHED businesses whose
 * title, discount label or description matches every query word. Area and
 * near-me filters apply through the offer's business. Relevance order, then
 * ending soonest (offers have no location of their own, so no distance sort).
 */
export async function searchPublic({ tokens, fuzzy = false, query = '', area, lat, lng, radiusKm, page = 1, limit = 20 }, now = new Date()) {
  const filter = { ...validNow(now), ...matchFilter(tokens, ['title', 'discountLabel', 'description'], { fuzzy }) };
  const candidates = await Offer.find(filter).sort({ validTo: 1, _id: 1 }).limit(CANDIDATE_LIMIT).lean();
  const businessIds = [...new Set(candidates.map((o) => String(o.businessId)))];
  const published = businessIds.length
    ? new Set((await businessesService.findPublishedIds({ ids: businessIds, area, lat, lng, radiusKm })).map(String))
    : new Set();
  const rows = candidates
    .filter((o) => published.has(String(o.businessId)))
    .map((o, order) => ({ o, order, score: relevance(tokens, { primary: o.title, secondary: [o.discountLabel, o.description] }, { fuzzy, query }) }));
  const ranked = rankPage(rows, { page, limit });
  const items = ranked.page.map((r) => r.o);
  const businesses = await businessesService.getSummariesByIds([...new Set(items.map((o) => String(o.businessId)))]);
  return { items: items.map((o) => toDTO(o, businesses.get(String(o.businessId)), { now })), total: ranked.total, capped: ranked.capped };
}

/** GET /businesses/:id/offers - a published business's currently valid offers (ending soonest first). */
export async function listForBusiness(businessId, { limit }, now = new Date()) {
  const published = await businessesService.getPublishedIds([businessId]);
  if (!published.has(String(businessId))) throw AppError.notFound('Business not found.');
  const filter = { ...validNow(now), businessId };
  const [items, total] = await Promise.all([
    Offer.find(filter).sort({ validTo: 1, _id: 1 }).limit(limit).lean(),
    Offer.countDocuments(filter),
  ]);
  const businesses = await businessesService.getSummariesByIds([businessId]);
  const business = businesses.get(String(businessId));
  return { items: items.map((o) => toDTO(o, business, { now })), meta: { total, limit } };
}

/**
 * Offer detail. Public only while valid and its business is published.
 * Owners/admins can open their own offers in any state (management fields).
 * Everyone else gets 404.
 */
export async function getOffer(id, user, now = new Date()) {
  const o = await Offer.findById(id).lean();
  if (!o) throw AppError.notFound('Offer not found.');
  const manage = await canManage(user, o.businessId);
  if (!manage) {
    const isValid = o.status === O.PUBLISHED && o.validFrom <= now && o.validTo >= now;
    const published = isValid ? await businessesService.getPublishedIds([o.businessId]) : new Set();
    if (!published.has(String(o.businessId))) throw AppError.notFound('Offer not found.');
  }
  const businesses = await businessesService.getSummariesByIds([o.businessId], { publishedOnly: !manage });
  return toDTO(o, businesses.get(String(o.businessId)), { manage, now });
}

/* ----------------------------- management ----------------------------- */

/** Every offer of one business the caller manages, with derived status. */
export async function listForManagement(user, businessId, now = new Date()) {
  const business = await manageableBusiness(user, businessId);
  const items = await Offer.find({ businessId }).sort({ updatedAt: -1 }).limit(200).lean();
  const summary = { id: String(business._id), name: business.name, slug: business.slug };
  return {
    business: businessInfo(business),
    canCreate: business.status === 'published',
    limit: OFFER_LIMIT_PER_BUSINESS,
    activeOrScheduled: items.filter((o) => ['live', 'scheduled'].includes(displayStatus(o, now))).length,
    items: items.map((o) => toDTO(o, summary, { manage: true, now })),
  };
}

/** FR-OFF-3: owner (own business) or admin creates an offer. Owners may publish directly. */
export async function createOffer(user, input) {
  const business = await manageableBusiness(user, input.businessId);
  if (business.status !== 'published') {
    throw AppError.validation('Offers can only be added to an approved, published business.', [
      { field: 'body.businessId', message: 'Business is not published' },
    ]);
  }
  const dates = resolveDates(input.validFrom, input.validTo, { checkPast: true });
  const status = input.status ?? O.DRAFT;
  const doc = new Offer({
    businessId: business._id,
    title: input.title,
    description: input.description || undefined,
    discountLabel: input.discountLabel,
    couponCode: blank(input.couponCode) ? undefined : input.couponCode.toUpperCase(),
    terms: input.terms,
    redemptionInstructions: input.redemptionInstructions || undefined,
    image: input.image ? assertOwnImage(input.image, 'offer_image') : undefined,
    ...dates,
    status,
    createdBy: user.id,
    updatedBy: user.id,
  });

  if (status === O.PUBLISHED && (await countActiveOrScheduled(business._id)) >= OFFER_LIMIT_PER_BUSINESS) throw limitError();
  await doc.save();
  // Re-check after writing so two simultaneous requests can't both slip past the limit.
  if (status === O.PUBLISHED && (await countActiveOrScheduled(business._id)) > OFFER_LIMIT_PER_BUSINESS) {
    await Offer.deleteOne({ _id: doc._id }); // the offer was never accepted
    throw limitError();
  }
  return toDTO(doc.toObject(), { id: String(business._id), name: business.name, slug: business.slug }, { manage: true });
}

/** Edit, publish, unpublish (draft) or hide an offer of a business the caller manages. */
export async function updateOffer(user, id, input, now = new Date()) {
  const doc = await Offer.findById(id);
  if (!doc) throw AppError.notFound('Offer not found.');
  const business = await manageableBusiness(user, doc.businessId);
  const before = doc.toObject();

  const nextStatus = input.status ?? doc.status;
  if (nextStatus === O.PUBLISHED && business.status !== 'published') {
    throw AppError.validation('Offers can only be published for an approved, published business.', [
      { field: 'body.status', message: 'Business is not published' },
    ]);
  }

  if (input.validFrom !== undefined || input.validTo !== undefined) {
    const currentTo = toIstDate(doc.validTo);
    const fromDate = input.validFrom ?? toIstDate(doc.validFrom);
    const toDate = input.validTo ?? currentTo;
    // Only a CHANGED end date may not be in the past: an expired offer can still be
    // edited (e.g. a typo) when the form re-sends its unchanged end date.
    Object.assign(doc, resolveDates(fromDate, toDate, { checkPast: toDate !== currentTo }));
  }
  if (input.title !== undefined) doc.title = input.title;
  if (input.description !== undefined) doc.description = input.description || undefined;
  if (input.discountLabel !== undefined) doc.discountLabel = input.discountLabel;
  if (input.couponCode !== undefined) doc.couponCode = blank(input.couponCode) ? undefined : input.couponCode.toUpperCase();
  if (input.terms !== undefined) doc.terms = input.terms;
  if (input.redemptionInstructions !== undefined) doc.redemptionInstructions = input.redemptionInstructions || undefined;
  if (input.image !== undefined) doc.image = input.image ? assertOwnImage(input.image, 'offer_image', 'body.image') : undefined;
  doc.status = nextStatus;
  doc.updatedBy = user.id;

  const willCount = doc.status === O.PUBLISHED && doc.validTo >= now;
  const countedBefore = before.status === O.PUBLISHED && before.validTo >= now;
  if (willCount && !countedBefore && (await countActiveOrScheduled(doc.businessId, now)) >= OFFER_LIMIT_PER_BUSINESS) {
    throw limitError();
  }
  await doc.save();
  if (willCount && !countedBefore && (await countActiveOrScheduled(doc.businessId, now)) > OFFER_LIMIT_PER_BUSINESS) {
    await Offer.replaceOne({ _id: doc._id }, before); // undo: restore the previous version
    throw limitError();
  }
  return toDTO(doc.toObject(), { id: String(business._id), name: business.name, slug: business.slug }, { manage: true, now });
}

/** DELETE = hide. The record is kept for administration and reporting. */
export async function hideOffer(user, id) {
  const doc = await Offer.findById(id);
  if (!doc) throw AppError.notFound('Offer not found.');
  await manageableBusiness(user, doc.businessId);
  doc.status = O.HIDDEN;
  doc.updatedBy = user.id;
  await doc.save();
  return { id: String(doc._id), status: doc.status };
}

/* ----------------------------- development seed ----------------------------- */

/** Sample offers for local development only - always refused in production. */
export async function seedOffers(list, businessIdBySlug, now = new Date()) {
  if (getEnv().isProduction) throw new Error('Sample data cannot be seeded in production.');
  let created = 0;
  for (const item of list) {
    const businessId = businessIdBySlug.get(item.businessSlug);
    if (!businessId || (await Offer.exists({ businessId, title: item.title }))) continue;
    const start = toIstDate(new Date(now.getTime() + item.startsInDays * 86_400_000));
    const end = toIstDate(new Date(now.getTime() + item.endsInDays * 86_400_000));
    const { businessSlug: _s, startsInDays: _a, endsInDays: _b, ...rest } = item;
    await Offer.create({ ...rest, businessId, validFrom: istStartOfDay(start), validTo: istEndOfDay(end), status: O.PUBLISHED, isSeed: true });
    created += 1;
  }
  return { created, skipped: list.length - created };
}
