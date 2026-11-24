import { z } from 'zod';
import { BUSINESS_KINDS, BUSINESS_STATUS, MAX_PHOTOS } from './businesses.model.js';
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

const contact = z.strictObject({
  phone: z.union([phone, z.literal('')]).optional(),
  whatsapp: z.union([phone, z.literal('')]).optional(),
  email: z.union([z.email().max(254), z.literal('')]).optional(),
  website: z.union([z.url({ protocol: /^https?$/ }).max(300), z.literal('')]).optional(),
});

const address = z.strictObject({
  line: z.string().trim().min(3).max(200),
  area: z.string().trim().min(2).max(80),
  pincode: z.union([z.string().regex(/^\d{6}$/, '6-digit PIN code'), z.literal('')]).optional(),
});

const location = z.strictObject({ lat: z.number().min(-90).max(90), lng: z.number().min(-180).max(180) });

/** Fields an owner may edit on their own business (FR-BUS-5). */
const ownerEditable = {
  description: z.string().trim().max(2000).optional(),
  tags: z.array(z.string().trim().min(1).max(40)).max(15).optional(),
  contact: contact.optional(),
  openingHours: z.array(hoursSlot).max(21).optional(),
  photos: z.array(imageRef).max(MAX_PHOTOS).optional(),
};

/** Admin-only fields (FR-BUS-4/6): identity, placement, status and ownership. */
const adminEditable = {
  name: z.string().trim().min(2).max(120),
  categoryId: objectId,
  kind: z.enum(BUSINESS_KINDS),
  address,
  location,
  status: z.enum([BUSINESS_STATUS.DRAFT, BUSINESS_STATUS.PUBLISHED, BUSINESS_STATUS.HIDDEN]),
  ownerId: z.union([objectId, z.null()]),
};

export const createSchema = z.strictObject({
  ...ownerEditable,
  ...adminEditable,
  status: adminEditable.status.optional(),
  ownerId: objectId.optional(),
});

export const adminUpdateSchema = z
  .strictObject({
    ...ownerEditable,
    ...Object.fromEntries(Object.entries(adminEditable).map(([k, v]) => [k, v.optional()])),
  })
  .refine((v) => Object.keys(v).length > 0, { message: 'Nothing to update' });

export const ownerUpdateSchema = z
  .strictObject(ownerEditable)
  .refine((v) => Object.keys(v).length > 0, { message: 'Nothing to update' });

export const listQuery = z
  .strictObject({
    categoryId: objectId.optional(),
    kind: z.enum(BUSINESS_KINDS).optional(),
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

export const verifySchema = z.strictObject({ isVerified: z.boolean() });

export const slugParams = z.strictObject({ slug: slugParam });
export const idParams = z.strictObject({ id: objectId });
