import { z } from 'zod';
import { PURPOSE_LIST } from './media.service.js';

export const signSchema = z.strictObject({
  purpose: z.enum(PURPOSE_LIST),
});
