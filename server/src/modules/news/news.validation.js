import { z } from 'zod';
import { paginationFields } from '../../common/utils/pagination.js';
import { imageRef, objectId, slugParam } from '../../common/utils/validators.js';
import { isIsoDateTime } from '../../common/utils/dates.js';
import { NEWS_STATUS, NEWS_TYPES } from './news.model.js';

/** "YYYY-MM-DDTHH:mm" in IST (converted by the service). */
const dateTime = z.string().refine(isIsoDateTime, 'Use a valid date and time');
const httpsUrl = z.url({ protocol: /^https$/, message: 'Use a full https:// link' }).max(300);

const fields = {
  title: z.string().trim().min(3).max(140),
  summary: z.string().trim().min(10, 'Write a short summary (at least 10 characters)').max(300),
  body: z.string().trim().max(5000),
  type: z.enum(NEWS_TYPES),
  categoryId: z.union([objectId, z.null()]),
  coverImage: z.union([imageRef, z.null()]),
  sourceName: z.string().trim().min(2, 'Name the source').max(100),
  sourceUrl: z.union([httpsUrl, z.literal(''), z.null()]),
  validUntil: z.union([dateTime, z.null()]),
  isPinned: z.boolean(),
};
const required = ['title', 'summary', 'type', 'sourceName'];

/** Admin create (FR-NEWS-3). Slug, publishedAt, createdBy and isSeed are set by the server. */
export const createSchema = z.strictObject({
  ...Object.fromEntries(Object.entries(fields).map(([k, v]) => [k, required.includes(k) ? v : v.optional()])),
  status: z.enum([NEWS_STATUS.DRAFT, NEWS_STATUS.PUBLISHED]).optional(),
});

/** Admin edit / publish / pin / hide. Removing uses DELETE. */
export const updateSchema = z
  .strictObject({
    ...Object.fromEntries(Object.entries(fields).map(([k, v]) => [k, v.optional()])),
    status: z.enum([NEWS_STATUS.DRAFT, NEWS_STATUS.PUBLISHED, NEWS_STATUS.HIDDEN]).optional(),
  })
  .refine((v) => Object.keys(v).length > 0, { message: 'Nothing to update' });

export const listQuery = z.strictObject({
  type: z.enum(NEWS_TYPES).optional(),
  categoryId: objectId.optional(),
  ...paginationFields,
});

export const adminListQuery = z.strictObject({
  status: z.enum(Object.values(NEWS_STATUS)).optional(),
  type: z.enum(NEWS_TYPES).optional(),
  q: z.string().trim().max(100).optional(),
  ...paginationFields,
});

export const slugParams = z.strictObject({ slug: slugParam });
export const idParams = z.strictObject({ id: objectId });
