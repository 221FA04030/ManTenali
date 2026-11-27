import { describe, it, expect, vi, afterEach } from 'vitest';
import { APP_LOCATION_LIMIT_MS, getCurrentPosition, isNativeApp } from './geo.js';

const stubGeolocation = (impl) => {
  const getCurrentPositionMock = vi.fn(impl);
  vi.stubGlobal('navigator', { ...navigator, geolocation: { getCurrentPosition: getCurrentPositionMock } });
  return getCurrentPositionMock;
};

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  delete window.Capacitor;
});

describe('getCurrentPosition', () => {
  it('in a browser: 10 s timeout (browsers start it after permission is granted)', async () => {
    const geo = stubGeolocation((ok) => ok({ coords: { latitude: 16.237912, longitude: 80.644456 } }));
    await expect(getCurrentPosition({ nativeApp: false })).resolves.toEqual({ lat: 16.23791, lng: 80.64446 });
    expect(geo.mock.calls[0][2]).toMatchObject({ timeout: 10_000, enableHighAccuracy: false });
  });

  it('in the Android app: no browser timeout, so a slow answer to the permission dialog still works', async () => {
    vi.useFakeTimers();
    let deliver;
    const geo = stubGeolocation((ok) => {
      deliver = ok;
    });
    const result = getCurrentPosition({ nativeApp: true });
    expect(geo.mock.calls[0][2].timeout).toBe(Infinity);
    await vi.advanceTimersByTimeAsync(25_000); // the person takes 25 s to tap "Allow"
    deliver({ coords: { latitude: 16.2379, longitude: 80.6444 } });
    await expect(result).resolves.toEqual({ lat: 16.2379, lng: 80.6444 });
  });

  it('in the Android app: a search that never finds a position still ends (app-level limit)', async () => {
    vi.useFakeTimers();
    stubGeolocation(() => {});
    const result = getCurrentPosition({ nativeApp: true });
    const check = expect(result).rejects.toThrow('unavailable');
    await vi.advanceTimersByTimeAsync(APP_LOCATION_LIMIT_MS);
    await check;
  });

  it('denied permission and location switched off are reported straight away, in the app too', async () => {
    stubGeolocation((_ok, fail) => fail({ code: 1 }));
    await expect(getCurrentPosition({ nativeApp: true })).rejects.toThrow('denied');
    stubGeolocation((_ok, fail) => fail({ code: 2 }));
    await expect(getCurrentPosition({ nativeApp: true })).rejects.toThrow('unavailable');
  });

  it('detects the Android app through the Capacitor bridge', () => {
    expect(isNativeApp()).toBe(false);
    window.Capacitor = { isNativePlatform: () => true };
    expect(isNativeApp()).toBe(true);
  });
});
