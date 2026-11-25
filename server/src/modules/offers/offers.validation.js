import { z } from 'zod';
import { paginationFields } from '../../common/utils/pagination.js';
import { imageRef, lat, lng, objectId } from '../../common/utils/validators.js';
import { isIsoDate } from '../../common/utils/dates.js';
import { GEO } from '../../config/constants.js';
import { OFFER_STATUS } from './offers.model.js';

/** Date-only (YYYY-MM-DD), interpreted in IST by the service. */
const isoDate = z.string().refine(isIsoDate, 'Use a valid date (YYYY-MM-DD)');
const couponCode = z
  .string()
  .trim()
  .regex(/^[A-Za-z0-9][A-Za-z0-9-]{1,28}[A-Za-z0-9]$/, 'Use 3-30 letters, numbers or dashes');

const offerFields = {
  title: z.string().trim().min(3).max(120),
  description: z.string().trim().max(1000),
  discountLabel: z.string().trim().min(1).max(40),
  couponCode: z.union([couponCode, z.literal(''), z.null()]),
  terms: z.string().trim().min(10, 'Terms must be at least 10 characters').max(1000),
  redemptionInstructions: z.string().trim().max(500),
  image: z.union([imageRef, z.null()]),
  validFrom: isoDate,
  validTo: isoDate,
};

/** Owners publish directly ("published") or save a draft. Hiding uses DELETE or status "hidden". */
export const createSchema = z.strictObject({
  businessId: objectId,
  title: offerFields.title,
  description: offerFields.description.optional(),
  discountLabel: offerFields.discountLabel,
  couponCode: offerFields.couponCode.optional(),
  terms: offerFields.terms,
  redemptionInstructions: offerFields.redemptionInstructions.optional(),
  image: offerFields.image.optional(),
  validFrom: offerFields.validFrom,
  validTo: offerFields.validTo,
  status: z.enum([OFFER_STATUS.DRAFT, OFFER_STATUS.PUBLISHED]).optional(),
});

/** businessId can't change: an offer always belongs to the business it was created for. */
export const updateSchema = z
  .strictObject({
    ...Object.fromEntries(Object.entries(offerFields).map(([k, v]) => [k, v.optional()])),
    status: z.enum(Object.values(OFFER_STATUS)).optional(),
  })
  .refine((v) => Object.keys(v).length > 0, { message: 'Nothing to update' });

export const listQuery = z
  .strictObject({
    businessId: objectId.optional(),
    categoryId: objectId.optional(),
    subcategoryId: objectId.optional(),
    area: z.string().trim().max(80).optional(),
    lat: lat.optional(),
    lng: lng.optional(),
    radiusKm: z.coerce.number().positive().max(GEO.MAX_RADIUS_KM).optional(),
    sort: z.enum(['endingSoon', 'newest']).default('endingSoon'),
    ...paginationFields,
  })
  .refine((q) => (q.lat === undefined) === (q.lng === undefined), { message: 'Give both lat and lng', path: ['lat'] });

export const businessOffersQuery = z.strictObject({
  limit: z.coerce.number().int().min(1).max(20).default(5),
});

export const manageQuery = z.strictObject({ businessId: objectId });

export const idParams = z.strictObject({ id: objectId });
