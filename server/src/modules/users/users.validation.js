import { z } from 'zod';
import { ROLE_LIST } from '../../config/constants.js';
import { paginationFields } from '../../common/utils/pagination.js';
import { objectId } from '../../common/utils/validators.js';

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
