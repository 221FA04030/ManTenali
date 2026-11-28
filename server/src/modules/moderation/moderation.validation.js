import { z } from 'zod';
import { objectId } from '../../common/utils/validators.js';
import { paginationFields } from '../../common/utils/pagination.js';
import { MODERATION_REASON_MAX } from '../../common/utils/moderation.js';
import { MODERATION_TYPES } from './audit.model.js';

const type = z.enum(MODERATION_TYPES);
const reason = z.string().trim().max(MODERATION_REASON_MAX).optional();

export const itemParams = z.strictObject({ type, id: objectId });

export const listQuery = z.strictObject({
  type,
  status: z.enum(['published', 'archived', 'all']).default('all'),
  q: z.string().trim().max(100).optional(),
  author: z.string().trim().min(1).max(100).optional(),
  ...paginationFields,
});

export const archiveSchema = z.strictObject({ reason });
export const restoreSchema = z.strictObject({});

/** Deleting permanently must be confirmed explicitly in the request itself. */
export const deleteSchema = z.strictObject({
  confirm: z.literal(true, { error: 'Confirm the permanent deletion.' }),
  reason,
});

export const auditQuery = z.strictObject({
  contentType: type.optional(),
  contentId: objectId.optional(),
  ...paginationFields,
});
