import { z } from 'zod';
import { imageRef, objectId } from '../../common/utils/validators.js';
import { paginationFields } from '../../common/utils/pagination.js';
import { POST_KINDS, POST_LIMITS } from './community.model.js';

const text = z.string().trim().min(3, 'Write at least a few words').max(POST_LIMITS.textMax);
const fields = {
  kind: z.enum(POST_KINDS),
  text,
  photo: z.union([imageRef, z.null()]),
  area: z.union([z.string().trim().min(2).max(80), z.literal(''), z.null()]),
  businessId: z.union([objectId, z.null()]),
};

/** authorId, status and counts are set by the server; the strict schema rejects them. */
export const createSchema = z.strictObject({
  kind: fields.kind,
  text: fields.text,
  photo: fields.photo.optional(),
  area: fields.area.optional(),
  businessId: fields.businessId.optional(),
});
export const updateSchema = z
  .strictObject(Object.fromEntries(Object.entries(fields).map(([k, v]) => [k, v.optional()])))
  .refine((v) => Object.keys(v).length > 0, { message: 'Nothing to update' });

export const feedQuery = z.strictObject({
  kind: z.enum(POST_KINDS).optional(),
  area: z.string().trim().max(80).optional(),
  withPhoto: z.enum(['true']).optional(), // Home's Community Posts: only posts with a photo
  ...paginationFields,
});
export const commentSchema = z.strictObject({ text: z.string().trim().min(1, 'Write a comment').max(POST_LIMITS.commentMax) });
export const commentsQuery = z.strictObject({ ...paginationFields });
export const idParams = z.strictObject({ id: objectId });
