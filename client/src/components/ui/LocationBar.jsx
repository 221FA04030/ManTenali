import { LocateFixed, LoaderCircle, MapPin, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useLocationContext } from '../../app/providers/LocationProvider.jsx';
import { TENALI_AREAS } from '../../config/areas.js';
import { cn } from '../../lib/cn.js';

/**
 * "Near me" + manual area picker (FR-BUS-2, FR-UX-2). Location permission is
 * requested only when "Near me" is tapped; the area picker always works.
 */
export function LocationBar({ className }) {
  const { t } = useTranslation();
  const { area, setArea, coords, status, requestNearMe, clearNearMe } = useLocationContext();
  const nearMeOn = Boolean(coords);

  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={nearMeOn ? clearNearMe : requestNearMe}
          aria-pressed={nearMeOn}
          className={cn(
            'inline-flex min-h-tap shrink-0 items-center gap-1.5 rounded-full px-4 text-sm font-semibold ring-1 transition-colors',
            nearMeOn ? 'bg-brand-700 text-white ring-brand-700' : 'bg-white text-brand-800 ring-brand-200 hover:bg-brand-50',
          )}
        >
          {status === 'locating' ? (
            <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden="true" />
          ) : nearMeOn ? (
            <X className="h-4 w-4" aria-hidden="true" />
          ) : (
            <LocateFixed className="h-4 w-4" aria-hidden="true" />
          )}
          {t('location.nearMe')}
        </button>
        <label className="relative flex min-w-0 flex-1 items-center">
          <span className="sr-only">{t('location.area')}</span>
          <MapPin className="pointer-events-none absolute left-3 h-4 w-4 text-brand-700" aria-hidden="true" />
          <select
            value={nearMeOn ? '' : area}
            onChange={(e) => setArea(e.target.value)}
            className="min-h-tap w-full appearance-none rounded-full bg-white pl-9 pr-4 text-sm font-medium text-ink ring-1 ring-brand-200 focus:outline-none focus:ring-2 focus:ring-brand-700"
          >
            <option value="">{nearMeOn ? t('location.usingNearMe') : t('location.allAreas')}</option>
            {TENALI_AREAS.map((a) => (
              <option key={a} value={a}>
                {a}
              </option>
            ))}
          </select>
        </label>
      </div>
      {(status === 'denied' || status === 'unavailable') && (
        <p role="status" className="text-xs text-amber-800">
          {t(status === 'denied' ? 'location.denied' : 'location.unavailable')}
        </p>
      )}
    </div>
  );
}
