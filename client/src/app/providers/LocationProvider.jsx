import { createContext, useCallback, useContext, useMemo, useState } from 'react';
import { getCurrentPosition } from '../../lib/geo.js';
import { storage, STORAGE_KEYS } from '../../lib/storage.js';

const LocationContext = createContext(null);

/**
 * Chosen location: either a manual area (saved locally) or "near me" coords
 * (memory only; permission requested only when the user asks).
 */
export function LocationProvider({ children }) {
  const [area, setAreaState] = useState(() => storage.get(STORAGE_KEYS.AREA, ''));
  const [coords, setCoords] = useState(null);
  const [status, setStatus] = useState('idle'); // idle | locating | ready | denied | unavailable

  const setArea = useCallback((next) => {
    setAreaState(next || '');
    if (next) storage.set(STORAGE_KEYS.AREA, next);
    else storage.remove(STORAGE_KEYS.AREA);
    setCoords(null);
    setStatus('idle');
  }, []);

  const requestNearMe = useCallback(async () => {
    setStatus('locating');
    try {
      const position = await getCurrentPosition();
      setCoords(position);
      setStatus('ready');
      return position;
    } catch (err) {
      setStatus(err.message === 'denied' ? 'denied' : 'unavailable');
      return null;
    }
  }, []);

  const clearNearMe = useCallback(() => {
    setCoords(null);
    setStatus('idle');
  }, []);

  const value = useMemo(
    () => ({ area, setArea, coords, status, requestNearMe, clearNearMe }),
    [area, setArea, coords, status, requestNearMe, clearNearMe],
  );
  return <LocationContext.Provider value={value}>{children}</LocationContext.Provider>;
}

export function useLocationContext() {
  const ctx = useContext(LocationContext);
  if (!ctx) throw new Error('useLocationContext must be used inside LocationProvider');
  return ctx;
}
