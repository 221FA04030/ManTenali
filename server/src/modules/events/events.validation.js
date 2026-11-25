import { z } from 'zod';
import { paginationFields } from '../../common/utils/pagination.js';
import { imageRef, lat, lng, objectId, queryBool, slugParam } from '../../common/utils/validators.js';
import { isIsoDate, isIsoDateTime } from '../../common/utils/dates.js';
import { GEO } from '../../config/constants.js';
import { EVENT_STATUS } from './events.model.js';
import { EVIDENCE_KINDS, MAX_EVIDENCE } from './evidence.model.js';

/** "YYYY-MM-DDTHH:mm", interpreted in IST by the service. */
const dateTime = z.string().refine(isIsoDateTime, 'Use a valid date and time');
const isoDate = z.string().refine(isIsoDate, 'Use a valid date (YYYY-MM-DD)');
const httpsUrl = z.url({ protocol: /^https$/, message: 'Use a full https:// link' }).max(300);

const venue = z.strictObject({
  name: z.string().trim().min(2).max(120),
  address: z.string().trim().min(3).max(200),
  area: z.string().trim().min(2).max(80),
});
const location = z.strictObject({ lat: z.number().min(-90).max(90), lng: z.number().min(-180).max(180) });

/** Fields shared by submissions and admin events. */
const eventFields = {
  title: z.string().trim().min(3).max(120),
  description: z.string().trim().max(2000),
  categoryId: objectId,
  startAt: dateTime,
  endAt: dateTime,
  allDay: z.boolean(),
  venue,
  location: z.union([location, z.null()]),
  bookingUrl: z.union([httpsUrl, z.literal(''), z.null()]),
  priceInfo: z.string().trim().max(100),
  businessId: z.union([objectId, z.null()]),
  organizerName: z.string().trim().min(2).max(120),
};
const optionalFields = Object.fromEntries(Object.entries(eventFields).map(([k, v]) => [k, v.optional()]));
const required = ['title', 'categoryId', 'startAt', 'endAt', 'venue', 'organizerName'];
const createShape = Object.fromEntries(Object.entries(eventFields).map(([k, v]) => [k, required.includes(k) ? v : v.optional()]));

export const evidenceItem = z.strictObject({
  publicId: z.string().trim().min(1).max(200),
  kind: z.enum(EVIDENCE_KINDS),
  note: z.string().trim().max(200).optional(),
  filename: z.string().max(255).optional(),
});

/**
 * Community submission. Status, submitter, review and source are set by the
 * server; the strict schema rejects them. At least one evidence file is required.
 */
export const submissionSchema = z.strictObject({
  ...createShape,
  evidence: z.array(evidenceItem).min(1, 'Add at least one evidence file').max(MAX_EVIDENCE),
});

export const submissionUpdateSchema = z
  .strictObject(optionalFields)
  .refine((v) => Object.keys(v).length > 0, { message: 'Nothing to update' });

/** Admin-created events (no evidence; admins publish directly or keep a draft). */
export const adminCreateSchema = z.strictObject({
  ...createShape,
  bannerImage: z.union([imageRef, z.null()]).optional(),
  status: z.enum([EVENT_STATUS.DRAFT, EVENT_STATUS.PUBLISHED]).optional(),
});

/** Admin edits. Moderation of submissions uses the review endpoints, not `status` here. */
export const adminUpdateSchema = z
  .strictObject({
    ...optionalFields,
    bannerImage: z.union([imageRef, z.null()]).optional(),
    status: z.enum([EVENT_STATUS.PUBLISHED, EVENT_STATUS.CANCELLED, EVENT_STATUS.HIDDEN]).optional(),
    cancelReason: z.string().trim().max(300).optional(),
  })
  .refine((v) => Object.keys(v).length > 0, { message: 'Nothing to update' });

export const approveSchema = z.strictObject({ bannerImage: imageRef.optional() });
export const rejectSchema = z.strictObject({ reason: z.string().trim().min(5, 'Give a reason (at least 5 characters)').max(1000) });
export const requestChangesSchema = z.strictObject({ note: z.string().trim().min(5, 'Say what to change (at least 5 characters)').max(1000) });

export const listQuery = z
  .strictObject({
    from: isoDate.optional(),
    to: isoDate.optional(),
    categoryId: objectId.optional(),
    area: z.string().trim().max(80).optional(),
    lat: lat.optional(),
    lng: lng.optional(),
    radiusKm: z.coerce.number().positive().max(GEO.MAX_RADIUS_KM).optional(),
    includePast: queryBool.optional(),
    ...paginationFields,
  })
  .refine((q) => (q.lat === undefined) === (q.lng === undefined), { message: 'Give both lat and lng', path: ['lat'] })
  .refine((q) => !q.from || !q.to || q.to >= q.from, { message: '"to" must be on or after "from"', path: ['to'] });

export const adminListQuery = z.strictObject({
  status: z.enum(Object.values(EVENT_STATUS)).optional(),
  q: z.string().trim().max(100).optional(),
  ...paginationFields,
});

export const queueQuery = z.strictObject({
  status: z
    .enum([EVENT_STATUS.PENDING, EVENT_STATUS.CHANGES, EVENT_STATUS.REJECTED, EVENT_STATUS.WITHDRAWN, EVENT_STATUS.PUBLISHED])
    .default(EVENT_STATUS.PENDING),
  ...paginationFields,
});

export const slugParams = z.strictObject({ slug: slugParam });
export const idParams = z.strictObject({ id: objectId });
export const evidenceParams = z.strictObject({ id: objectId, evidenceId: objectId });
