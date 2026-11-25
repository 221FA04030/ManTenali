import { z } from 'zod';
import { lat, lng } from '../../common/utils/validators.js';
import { GEO } from '../../config/constants.js';

/** GET /home: optional location context for "nearby businesses". */
export const homeQuery = z
  .strictObject({
    lat: lat.optional(),
    lng: lng.optional(),
    radiusKm: z.coerce.number().positive().max(GEO.MAX_RADIUS_KM).optional(),
    area: z.string().trim().max(80).optional(),
  })
  .refine((v) => (v.lat === undefined) === (v.lng === undefined), { message: 'Give both lat and lng', path: ['lat'] });
