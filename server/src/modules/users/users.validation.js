import { z } from 'zod';
import { ROLE_LIST } from '../../config/constants.js';
import { paginationFields } from '../../common/utils/pagination.js';
import { objectId } from '../../common/utils/validators.js';
import { ENGAGEMENT_LIMITS } from './users.model.js';

export const updateMeSchema = z
  .strictObject({
    name: z.string().trim().min(2).max(80).optional(),
    avatarUrl: z.union([z.url({ protocol: /^https$/ }).max(500), z.literal(''), z.null()]).optional(),
    preferredArea: z.union([z.string().trim().max(80), z.null()]).optional(),
    language: z.enum(['en', 'te']).optional(),
  })
  .refine((v) => Object.keys(v).length > 0, { message: 'Nothing to update' });

export const adminListUsersQuery = z.strictObject({
  q: z.string().trim().max(100).optional(),
  role: z.enum(ROLE_LIST).optional(),
  status: z.enum(['active', 'blocked']).optional(),
  ...paginationFields,
});

export const adminUpdateUserSchema = z
  .strictObject({
    role: z.enum(ROLE_LIST).optional(),
    status: z.enum(['active', 'blocked']).optional(),
  })
  .refine((v) => v.role || v.status, { message: 'Provide role or status' });

export const idParams = z.strictObject({ id: objectId });

/** Home feature engagement: decayed scores per feature key (no content, no history). */
const featureKey = z.string().regex(/^[a-zA-Z][a-zA-Z0-9]{0,31}$/, 'Invalid feature');
const engagementEntry = z.strictObject({
  score: z.number().finite().min(0).max(1_000_000),
  updatedAt: z.iso.datetime(),
  lastSession: z.union([z.string().regex(/^[A-Za-z0-9-]{1,40}$/), z.null()]).optional(),
});
export const engagementSchema = z.strictObject({
  features: z
    .record(featureKey, engagementEntry)
    .refine((v) => Object.keys(v).length <= ENGAGEMENT_LIMITS.features, { message: 'Too many features' }),
  mergeId: z.string().regex(/^[A-Za-z0-9-]{8,40}$/).optional(),
});
