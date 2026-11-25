import { z } from 'zod';
import { objectId } from '../../common/utils/validators.js';
import { paginationFields } from '../../common/utils/pagination.js';
import { CONTENT_TARGETS, CONTENT_REASONS, SUGGESTION_REASONS, REPORT_STATUS, REPORT_TARGETS, REPORT_ACTIONS } from './reports.model.js';

const details = z.string().trim().max(1000);

/** Report a piece of content. "other" needs a few words of explanation. */
const contentReport = z
  .strictObject({
    targetType: z.enum(CONTENT_TARGETS),
    targetId: objectId,
    reason: z.enum(CONTENT_REASONS),
    details: details.optional(),
  })
  .refine((v) => v.reason !== 'other' || (v.details ?? '').length >= 10, {
    message: 'Tell us what is wrong (at least 10 characters)',
    path: ['details'],
  });

/** A suggestion from the Suggest button: no target, details required. */
const suggestion = z.strictObject({
  targetType: z.literal('suggestion'),
  reason: z.enum(SUGGESTION_REASONS),
  details: details.min(10, 'Tell us a little more (at least 10 characters)'),
});

/** reporterId, status and handling fields are set by the server. */
export const createSchema = z.union([contentReport, suggestion]);

export const adminListQuery = z.strictObject({
  status: z.enum(Object.values(REPORT_STATUS)).default(REPORT_STATUS.OPEN),
  targetType: z.enum(REPORT_TARGETS).optional(),
  ...paginationFields,
});

export const actionSchema = z.strictObject({
  action: z.enum(REPORT_ACTIONS),
  note: z.string().trim().max(500).optional(),
});

export const idParams = z.strictObject({ id: objectId });
