export const API_PREFIX = '/api/v1';

export const ROLES = Object.freeze({ USER: 'user', OWNER: 'owner', ADMIN: 'admin' });
export const ROLE_LIST = Object.freeze(Object.values(ROLES));

export const PAGINATION = Object.freeze({ DEFAULT_PAGE: 1, DEFAULT_LIMIT: 20, MAX_LIMIT: 50 });

export const GEO = Object.freeze({
  DEFAULT_RADIUS_KM: 5,
  MAX_RADIUS_KM: 25,
  // Approximate centre of Tenali, Andhra Pradesh (used only as a map default).
  TENALI_CENTER: Object.freeze({ lat: 16.2379, lng: 80.6444 }),
});

export const BODY_LIMIT = '100kb';

export const TIMEZONE = 'Asia/Kolkata';
