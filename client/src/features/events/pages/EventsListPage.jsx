import { useMemo } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { CalendarDays, Plus } from 'lucide-react';
import { PageHeader } from '../../../components/ui/Header.jsx';
import { LocationBar } from '../../../components/ui/LocationBar.jsx';
import { ListSkeleton } from '../../../components/ui/Skeleton.jsx';
import { EmptyState } from '../../../components/ui/EmptyState.jsx';
import { ErrorState } from '../../../components/ui/ErrorState.jsx';
import { Button } from '../../../components/ui/Button.jsx';
import { useLocationContext } from '../../../app/providers/LocationProvider.jsx';
import { EventFilters } from '../components/EventFilters.jsx';
import { EventCard } from '../components/EventCard.jsx';
import { useEventsList } from '../api.js';

const FILTER_KEYS = ['categoryId', 'from', 'to', 'includePast'];

/** /events - upcoming events with date range, category and area filters (FR-EVT-1). */
export default function EventsListPage() {
  const { t } = useTranslation();
  const [searchParams, setSearchParams] = useSearchParams();
  const { area, coords } = useLocationContext();

  const filters = useMemo(() => Object.fromEntries(FILTER_KEYS.map((k) => [k, searchParams.get(k) ?? undefined]).filter(([, v]) => v)), [searchParams]);
  const params = useMemo(() => {
    const p = { ...filters };
    if (coords) Object.assign(p, { lat: coords.lat, lng: coords.lng, radiusKm: 10 });
    else if (area) p.area = area;
    return p;
  }, [filters, coords, area]);

  const query = useEventsList(params);
  const items = query.data?.pages.flatMap((pg) => pg.data) ?? [];
  const total = query.data?.pages[0]?.meta?.total ?? 0;

  const update = (patch) => {
    const next = new URLSearchParams(searchParams);
    for (const [k, v] of Object.entries(patch)) {
      if (v === undefined || v === '') next.delete(k);
      else next.set(k, v);
    }
    setSearchParams(next, { replace: true });
  };

  return (
    <>
      <PageHeader title={t('pages.events')} />
      <div className="page-wide flex flex-col gap-4 p-4">
        <LocationBar />
        <EventFilters value={filters} onChange={update} />
        {query.isPending ? (
          <ListSkeleton rows={4} />
        ) : query.isError ? (
          <ErrorState error={query.error} onRetry={() => query.refetch()} />
        ) : items.length === 0 ? (
          <EmptyState icon={CalendarDays} title={t('events.emptyTitle')} body={t('events.emptyBody')} />
        ) : (
          <>
            <p className="text-sm text-ink-muted" aria-live="polite">
              {t('events.count', { count: total })}
            </p>
            <ul className="card-list">
              {items.map((e) => (
                <li key={e.id}>
                  <EventCard event={e} />
                </li>
              ))}
            </ul>
            {query.hasNextPage && (
              <Button variant="secondary" onClick={() => query.fetchNextPage()} loading={query.isFetchingNextPage} fullWidth>
                {t('common.loadMore')}
              </Button>
            )}
          </>
        )}
        <Link to="/events/submit" className="mt-2 flex items-center gap-3 rounded-card bg-brand-50 p-4 ring-1 ring-brand-200 hover:bg-brand-100">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-brand-700 text-white">
            <Plus className="h-5 w-5" aria-hidden="true" />
          </span>
          <span className="flex flex-col">
            <span className="font-bold text-ink">{t('events.ctaTitle')}</span>
            <span className="text-sm text-ink-muted">{t('events.ctaBody')}</span>
          </span>
        </Link>
      </div>
    </>
  );
}
