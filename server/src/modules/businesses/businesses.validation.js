import { z } from 'zod';
import { BUSINESS_KINDS, BUSINESS_STATUS, MAX_PHOTOS, FOOD_CUISINES, MENU_LIMITS } from './businesses.model.js';
import { paginationFields } from '../../common/utils/pagination.js';
import { GEO } from '../../config/constants.js';
import { imageRef, lat, lng, objectId, queryBool, slugParam } from '../../common/utils/validators.js';

const time = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Use 24h HH:MM');
const phone = z
  .string()
  .trim()
  .regex(/^\+?[\d\s-]{7,20}$/, 'Enter a valid phone number')
  .refine((v) => v.replace(/\D/g, '').length >= 7, 'Enter a valid phone number');

const hoursSlot = z
  .strictObject({
    day: z.number().int().min(0).max(6),
    open: time.optional(),
    close: time.optional(),
    closed: z.boolean().optional(),
  })
  .refine((s) => s.closed || (s.open && s.close), { message: 'Give open and close times, or mark the day closed' })
  .refine((s) => s.closed || s.open !== s.close, { message: 'Open and close times must differ' });

const contactShape = {
  phone: z.union([phone, z.literal('')]).optional(),
  whatsapp: z.union([phone, z.literal('')]).optional(),
  email: z.union([z.email().max(254), z.literal('')]).optional(),
  website: z.union([z.url({ protocol: /^https?$/ }).max(300), z.literal('')]).optional(),
};
const contact = z.strictObject(contactShape);
/** Self-submitted listings must give a phone number people can call. */
const submissionContact = z.strictObject({ ...contactShape, phone });

const address = z.strictObject({
  line: z.string().trim().min(3).max(200),
  area: z.string().trim().min(2).max(80),
  pincode: z.union([z.string().regex(/^\d{6}$/, '6-digit PIN code'), z.literal('')]).optional(),
});

const location = z.strictObject({ lat: z.number().min(-90).max(90), lng: z.number().min(-180).max(180) });

const menuItem = z.strictObject({
  name: z.string().trim().min(1, 'Item name is required').max(80),
  price: z.number().min(0).max(MENU_LIMITS.maxPrice),
  isVeg: z.boolean().optional(),
});
const menuSection = z.strictObject({
  section: z.string().trim().min(1, 'Section name is required').max(60),
  items: z.array(menuItem).min(1, 'Add at least one item').max(MENU_LIMITS.itemsPerSection),
});

/** Food details (FR-FOOD-1). Only accepted for businesses of kind "food". */
const food = z.strictObject({
  cuisines: z
    .array(z.enum(FOOD_CUISINES))
    .max(5)
    .refine((v) => new Set(v).size === v.length, 'Each cuisine only once')
    .optional(),
  isVegFriendly: z.boolean().optional(),
  menu: z
    .array(menuSection)
    .max(MENU_LIMITS.sections)
    .refine((m) => m.reduce((n, s) => n + s.items.length, 0) <= MENU_LIMITS.totalItems, {
      message: `At most ${MENU_LIMITS.totalItems} menu items`,
    })
    .optional(),
});

/** Fields an owner may edit on an APPROVED (published/hidden) business (FR-BUS-5). */
const ownerEditable = {
  description: z.string().trim().max(2000).optional(),
  tags: z.array(z.string().trim().min(1).max(40)).max(15).optional(),
  contact: contact.optional(),
  openingHours: z.array(hoursSlot).max(21).optional(),
  photos: z.array(imageRef).max(MAX_PHOTOS).optional(),
  // Food details and menu are "details" too: owners keep them up to date.
  priceRange: z.union([z.number().int().min(1).max(3), z.null()]).optional(),
  food: food.optional(),
};

/** Identity and placement fields ("material" fields). */
const listingFields = {
  name: z.string().trim().min(2).max(120),
  categoryId: objectId,
  subcategoryId: objectId,
  kind: z.enum(BUSINESS_KINDS),
  address,
  location,
};

const optionalAll = (shape) => Object.fromEntries(Object.entries(shape).map(([k, v]) => [k, v.optional()]));

/* ---------- admin ---------- */

export const createSchema = z.strictObject({
  ...ownerEditable,
  ...listingFields,
  status: z.enum([BUSINESS_STATUS.DRAFT, BUSINESS_STATUS.PUBLISHED, BUSINESS_STATUS.HIDDEN]).optional(),
  ownerId: objectId.optional(),
});

export const adminUpdateSchema = z
  .strictObject({
    ...ownerEditable,
    ...optionalAll(listingFields),
    status: z.enum([BUSINESS_STATUS.DRAFT, BUSINESS_STATUS.PUBLISHED, BUSINESS_STATUS.HIDDEN]).optional(),
    ownerId: z.union([objectId, z.null()]).optional(),
  })
  .refine((v) => Object.keys(v).length > 0, { message: 'Nothing to update' });

/* ---------- self-submission (any signed-in user) ---------- */

/**
 * New submission. Owner, status and review fields are NEVER accepted from the
 * client (strict schema); the server sets them. `submit: true` sends it for
 * review, otherwise it is saved as a draft.
 */
export const submissionCreateSchema = z.strictObject({
  ...ownerEditable,
  ...listingFields,
  kind: listingFields.kind.optional(),
  contact: submissionContact,
  submit: z.boolean().optional(),
});

/**
 * Non-admin edit. The service decides which of these the caller may change,
 * based on the listing's status (material fields only before approval).
 */
export const ownerUpdateSchema = z
  .strictObject({ ...ownerEditable, ...optionalAll(listingFields) })
  .refine((v) => Object.keys(v).length > 0, { message: 'Nothing to update' });

export const rejectSchema = z.strictObject({
  reason: z.string().trim().min(5, 'Give a short reason (at least 5 characters)').max(500),
});

/* ---------- queries ---------- */

export const listQuery = z
  .strictObject({
    categoryId: objectId.optional(),
    subcategoryId: objectId.optional(),
    kind: z.enum(BUSINESS_KINDS).optional(),
    cuisine: z.enum(FOOD_CUISINES).optional(),
    priceRange: z.coerce.number().int().min(1).max(3).optional(),
    isVegFriendly: queryBool.optional(),
    area: z.string().trim().max(80).optional(),
    isVerified: queryBool.optional(),
    openNow: queryBool.optional(),
    lat: lat.optional(),
    lng: lng.optional(),
    radiusKm: z.coerce.number().positive().max(GEO.MAX_RADIUS_KM).optional(),
    sort: z.enum(['distance', 'rating', 'newest']).optional(),
    ...paginationFields,
  })
  .refine((q) => (q.lat === undefined) === (q.lng === undefined), { message: 'Give both lat and lng', path: ['lat'] })
  .refine((q) => q.sort !== 'distance' || q.lat !== undefined, {
    message: 'Distance sorting needs your location',
    path: ['sort'],
  });

export const adminListQuery = z.strictObject({
  q: z.string().trim().max(100).optional(),
  status: z.enum(Object.values(BUSINESS_STATUS)).optional(),
  ownerId: objectId.optional(),
  ...paginationFields,
});

export const submissionsQuery = z.strictObject({
  status: z.enum([BUSINESS_STATUS.PENDING, BUSINESS_STATUS.PUBLISHED, BUSINESS_STATUS.REJECTED]).default(BUSINESS_STATUS.PENDING),
  q: z.string().trim().max(100).optional(),
  ...paginationFields,
});

export const verifySchema = z.strictObject({ isVerified: z.boolean() });

export const slugParams = z.strictObject({ slug: slugParam });
export const idParams = z.strictObject({ id: objectId });
