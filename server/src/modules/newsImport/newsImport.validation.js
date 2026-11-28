import { z } from 'zod';
import { paginationFields } from '../../common/utils/pagination.js';
import { objectId } from '../../common/utils/validators.js';
import { IMPORT_STATUS } from './newsImport.model.js';

export const idParams = z.strictObject({ id: objectId });

export const listQuery = z.strictObject({
  status: z.enum(Object.values(IMPORT_STATUS)).optional(),
  ...paginationFields,
});

/** Same limits as the news editor (news.validation.js). */
const reviewFields = {
  title: z.string().trim().min(3, 'Write a headline').max(140),
  summary: z.string().trim().min(10, 'Write a short summary (at least 10 characters)').max(300),
};
export const draftSchema = z.strictObject(reviewFields);
export const publishSchema = z.strictObject(reviewFields);
export const rejectSchema = z.strictObject({ reason: z.string().trim().max(300).optional() });

/**
 * Apify webhook payload (default template). Only the fields we use are
 * checked; Apify adds others, which are ignored.
 */
export const webhookBody = z.object({
  eventType: z.string().max(60),
  resource: z
    .object({
      status: z.string().max(30).optional(),
      defaultDatasetId: z.string().regex(/^[A-Za-z0-9]{1,40}$/, 'Invalid dataset id').optional(),
    })
    .optional(),
});
