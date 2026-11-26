import { Suspense, lazy, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Navigation } from 'lucide-react';
import { directionsUrl } from '../../lib/geo.js';

const LocationMapInner = lazy(() => import('./LocationMapInner.jsx'));

/** True once the element is near the screen (always true without IntersectionObserver). */
function useNearScreen(ref) {
  const [near, setNear] = useState(() => typeof IntersectionObserver === 'undefined');
  useEffect(() => {
    if (near || !ref.current) return undefined;
    const io = new IntersectionObserver((entries) => entries.some((e) => e.isIntersecting) && setNear(true), { rootMargin: '200px' });
    io.observe(ref.current);
    return () => io.disconnect();
  }, [near, ref]);
  return near;
}

/**
 * Small embedded map (OpenStreetMap) for a business or event location, with a
 * "Get directions" link as the accessible alternative. The map code and tiles
 * load only when the map scrolls near the screen.
 */
export function LocationMap({ location, label }) {
  const { t } = useTranslation();
  const ref = useRef(null);
  const near = useNearScreen(ref);
  if (!location || !Number.isFinite(location.lat) || !Number.isFinite(location.lng)) return null;
  return (
    <div className="flex flex-col gap-2">
      <div
        ref={ref}
        role="region"
        aria-label={t('map.label', { name: label })}
        className="relative z-0 aspect-[16/9] w-full overflow-hidden rounded-xl bg-brand-50 ring-1 ring-brand-100"
      >
        {near && (
          <Suspense fallback={null}>
            <LocationMapInner lat={location.lat} lng={location.lng} label={label} />
          </Suspense>
        )}
      </div>
      <a
        href={directionsUrl(location)}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex min-h-tap items-center gap-1.5 self-start text-sm font-semibold text-brand-700 hover:underline"
      >
        <Navigation className="h-4 w-4" aria-hidden="true" />
        {t('map.directions')}
      </a>
    </div>
  );
}
