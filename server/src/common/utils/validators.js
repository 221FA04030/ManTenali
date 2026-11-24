import { z } from 'zod';

/** Shared Zod building blocks used by every module's *.validation.js. */
export const objectId = z.string().regex(/^[a-f\d]{24}$/i, 'Invalid id');

export const slugParam = z.string().regex(/^[a-z0-9-]{1,90}$/, 'Invalid slug');

export const lat = z.coerce.number().min(-90).max(90);
export const lng = z.coerce.number().min(-180).max(180);

/** Query-string boolean: accepts true/false/1/0. */
export const queryBool = z
  .enum(['true', 'false', '1', '0'])
  .transform((v) => v === 'true' || v === '1');

export const trimmed = (max) => z.string().trim().max(max);
export const optionalText = (max) => z.string().trim().max(max).optional();

/** Strip characters that could break regexes before building a search pattern. */
export const escapeRegex = (s) => String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
