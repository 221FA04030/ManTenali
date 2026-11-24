import { GEO } from '../../config/constants.js';

const EARTH_RADIUS_M = 6_371_000;

export function isValidLatLng(lat, lng) {
  return (
    Number.isFinite(lat) && Number.isFinite(lng) && lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180
  );
}

/** GeoJSON Point - note the [lng, lat] order MongoDB requires. */
export function toPoint(lat, lng) {
  if (!isValidLatLng(lat, lng)) throw new RangeError('Invalid coordinates');
  return { type: 'Point', coordinates: [lng, lat] };
}

export function fromPoint(point) {
  if (!point?.coordinates) return null;
  const [lng, lat] = point.coordinates;
  return { lat, lng };
}

export function clampRadiusKm(radiusKm) {
  const r = Number(radiusKm);
  if (!Number.isFinite(r) || r <= 0) return GEO.DEFAULT_RADIUS_KM;
  return Math.min(r, GEO.MAX_RADIUS_KM);
}

export const kmToMeters = (km) => Math.round(km * 1000);

/** Great-circle distance in metres (haversine). */
export function distanceMeters(a, b) {
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return Math.round(2 * EARTH_RADIUS_M * Math.asin(Math.sqrt(h)));
}
