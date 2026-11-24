/**
 * Browser geolocation, requested ONLY when the user taps "Near me" (FR-UX-2).
 * Coordinates are kept in memory and sent per request; never persisted.
 */
export function getCurrentPosition({ timeout = 10_000 } = {}) {
  return new Promise((resolve, reject) => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      reject(new Error('unsupported'));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) =>
        resolve({
          lat: Number(pos.coords.latitude.toFixed(5)),
          lng: Number(pos.coords.longitude.toFixed(5)),
        }),
      (err) => reject(new Error(err.code === 1 ? 'denied' : 'unavailable')),
      { enableHighAccuracy: false, timeout, maximumAge: 5 * 60 * 1000 },
    );
  });
}

/** Links for one-tap contact actions (FR-UX-1). */
export function directionsUrl({ lat, lng }) {
  return `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`;
}

export function telUrl(phone) {
  return `tel:${String(phone).replace(/[^\d+]/g, '')}`;
}

export function whatsappUrl(phone) {
  let digits = String(phone).replace(/\D/g, '');
  if (digits.length === 10) digits = `91${digits}`;
  return `https://wa.me/${digits}`;
}
