/**
 * Later-phase features shown as dimmed "Coming soon" entries (spec section 11).
 * Enabling a feature in a later phase is a one-line change: remove it here.
 */
export const COMING_SOON = new Set([
  'busTracking',
  'jobs',
  'transport',
  'publicServices',
  'health',
  'education',
  'realEstate',
]);

export const isComingSoon = (feature) => COMING_SOON.has(feature);
