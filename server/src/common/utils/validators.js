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

/**
 * Shape of an uploaded image reference. Services additionally call
 * media.service.assertOwnImage() to make sure it is from our Cloudinary account.
 */
export const imageRef = z.strictObject({
  url: z.url({ protocol: /^https$/ }).max(500),
  publicId: z.string().min(1).max(200),
});

/** Bilingual label { en, te }; English required, Telugu optional. */
export const bilingual = (max = 80) =>
  z.strictObject({
    en: z.string().trim().min(1).max(max),
    te: z.string().trim().max(max).optional(),
  });

/** Strip characters that could break regexes before building a search pattern. */
export const escapeRegex = (s) => String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
