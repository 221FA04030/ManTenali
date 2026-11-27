/**
 * Browser geolocation, requested ONLY when the user taps "Near me" (FR-UX-2).
 * Coordinates are kept in memory and sent per request; never persisted.
 */
/** True inside the Mana Tenali Android app (a Capacitor shell around this site). */
export function isNativeApp() {
  return typeof window !== 'undefined' && Boolean(window.Capacitor?.isNativePlatform?.());
}

/** In the Android app: the most time a position search may take once the request is made. */
export const APP_LOCATION_LIMIT_MS = 60_000;

export function getCurrentPosition({ timeout = 10_000, nativeApp = isNativeApp() } = {}) {
  return new Promise((resolve, reject) => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      reject(new Error('unsupported'));
      return;
    }
    // Browsers start `timeout` only after permission is granted. The Android WebView starts it
    // while its permission dialog is still open, so anyone who took longer than 10 s to tap
    // "Allow" got "Couldn't get your location" (seen on a device). In the app there is no
    // browser timeout; a longer app-level limit still ends a search that never finds a position.
    // Denied permission or location switched off are still reported straight away.
    let limit = null;
    const done = (fn) => (value) => {
      clearTimeout(limit);
      fn(value);
    };
    if (nativeApp) limit = setTimeout(() => reject(new Error('unavailable')), APP_LOCATION_LIMIT_MS);
    navigator.geolocation.getCurrentPosition(
      done((pos) =>
        resolve({
          lat: Number(pos.coords.latitude.toFixed(5)),
          lng: Number(pos.coords.longitude.toFixed(5)),
        }),
      ),
      done((err) => reject(new Error(err.code === 1 ? 'denied' : 'unavailable'))),
      { enableHighAccuracy: false, timeout: nativeApp ? Infinity : timeout, maximumAge: 5 * 60 * 1000 },
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
