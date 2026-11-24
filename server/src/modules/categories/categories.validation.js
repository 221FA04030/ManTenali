import { z } from 'zod';
import { CATEGORY_TYPES } from './categories.model.js';
import { bilingual, objectId, queryBool } from '../../common/utils/validators.js';

const icon = z.string().trim().regex(/^[a-z0-9-]{1,40}$/, 'Icon key must be lowercase letters, numbers or dashes');

export const listQuery = z.strictObject({
  type: z.enum(CATEGORY_TYPES).optional(),
  includeInactive: queryBool.optional(),
});

export const createSchema = z.strictObject({
  name: bilingual(80),
  type: z.enum(CATEGORY_TYPES),
  slug: z
    .string()
    .trim()
    .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, 'Use lowercase letters, numbers and dashes')
    .max(90)
    .optional(),
  icon: icon.optional(),
  sortOrder: z.number().int().min(0).max(10_000).optional(),
});

export const updateSchema = z
  .strictObject({
    name: bilingual(80).optional(),
    icon: z.union([icon, z.null()]).optional(),
    sortOrder: z.number().int().min(0).max(10_000).optional(),
    isActive: z.boolean().optional(),
  })
  .refine((v) => Object.keys(v).length > 0, { message: 'Nothing to update' });

export const idParams = z.strictObject({ id: objectId });
