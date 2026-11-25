import { z } from 'zod';
import { objectId } from '../../common/utils/validators.js';
import { paginationFields } from '../../common/utils/pagination.js';

const rating = z.number().int('Choose 1 to 5 stars').min(1, 'Choose 1 to 5 stars').max(5, 'Choose 1 to 5 stars');
const comment = z.string().trim().max(1000);

/** userId, status and businessId come from the session and the URL, never the body. */
export const createSchema = z.strictObject({ rating, comment: comment.optional() });
export const updateSchema = z
  .strictObject({ rating: rating.optional(), comment: comment.optional() })
  .refine((v) => Object.keys(v).length > 0, { message: 'Nothing to update' });

export const listQuery = z.strictObject({ ...paginationFields });
export const businessParams = z.strictObject({ id: objectId });
export const idParams = z.strictObject({ id: objectId });
