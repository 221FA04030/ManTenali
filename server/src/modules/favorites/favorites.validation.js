import { z } from 'zod';
import { objectId } from '../../common/utils/validators.js';
import { FAVORITE_TYPES } from './favorites.model.js';

/** userId comes from the session, never the body. */
export const createSchema = z.strictObject({ targetType: z.enum(FAVORITE_TYPES), targetId: objectId });
export const idParams = z.strictObject({ id: objectId });
