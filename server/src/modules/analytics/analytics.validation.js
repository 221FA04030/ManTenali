import { z } from 'zod';
import { objectId } from '../../common/utils/validators.js';
import { isIsoDate } from '../../common/utils/dates.js';
import { ACTIVITY_TARGETS, ACTIVITY_TYPES } from './analytics.model.js';

const isoDate = z.string().refine(isIsoDate, 'Use a valid date (YYYY-MM-DD)');

/** One activity event. The target must fit the type (e.g. contact_click -> business). */
export const eventSchema = z
  .strictObject({
    type: z.enum(ACTIVITY_TYPES),
    targetType: z.enum(['business', 'offer', 'event', 'news']).optional(),
    targetId: objectId.optional(),
    sessionId: z.string().regex(/^[A-Za-z0-9-]{8,64}$/, 'Invalid session id'),
  })
  .superRefine((v, ctx) => {
    const allowed = ACTIVITY_TARGETS[v.type];
    if (!allowed.length) {
      if (v.targetType || v.targetId) ctx.addIssue({ code: 'custom', path: ['targetType'], message: 'This event has no target' });
      return;
    }
    if (!v.targetType || !allowed.includes(v.targetType)) ctx.addIssue({ code: 'custom', path: ['targetType'], message: `Use one of: ${allowed.join(', ')}` });
    if (!v.targetId) ctx.addIssue({ code: 'custom', path: ['targetId'], message: 'Required' });
  });

export const summaryQuery = z
  .strictObject({ from: isoDate.optional(), to: isoDate.optional() })
  .refine((q) => !q.from || !q.to || q.to >= q.from, { message: '"to" must be on or after "from"', path: ['to'] });
