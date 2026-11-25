import { z } from 'zod';
import { lat, lng } from '../../common/utils/validators.js';
import { GEO, PAGINATION } from '../../config/constants.js';

export const SEARCH_TYPES = Object.freeze(['all', 'business', 'offer', 'event', 'news']);

const q = z.string().trim().min(2, 'Type at least 2 characters').max(100);

/** GET /search (spec section 8, plus radiusKm and sort). */
export const searchQuery = z
  .strictObject({
    q,
    type: z.enum(SEARCH_TYPES).default('all'),
    area: z.string().trim().max(80).optional(),
    lat: lat.optional(),
    lng: lng.optional(),
    radiusKm: z.coerce.number().positive().max(GEO.MAX_RADIUS_KM).optional(),
    sort: z.enum(['relevance', 'distance']).default('relevance'),
    page: z.coerce.number().int().min(1).max(10).default(PAGINATION.DEFAULT_PAGE),
    limit: z.coerce.number().int().min(1).max(PAGINATION.MAX_LIMIT).default(PAGINATION.DEFAULT_LIMIT),
  })
  .refine((v) => (v.lat === undefined) === (v.lng === undefined), { message: 'Give both lat and lng', path: ['lat'] })
  .refine((v) => v.sort !== 'distance' || v.lat !== undefined, { message: 'Distance sorting needs your location', path: ['sort'] });

/** GET /search/suggest (FR-SRCH-3). */
export const suggestQuery = z.strictObject({ q });
