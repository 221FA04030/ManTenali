import { useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Store } from 'lucide-react';
import { PageHeader } from '../../../components/ui/Header.jsx';
import { LocationBar } from '../../../components/ui/LocationBar.jsx';
import { ListSkeleton } from '../../../components/ui/Skeleton.jsx';
import { EmptyState } from '../../../components/ui/EmptyState.jsx';
import { ErrorState } from '../../../components/ui/ErrorState.jsx';
import { Button } from '../../../components/ui/Button.jsx';
import { useLocationContext } from '../../../app/providers/LocationProvider.jsx';
import { BusinessFilters } from '../components/BusinessFilters.jsx';
import { BusinessCard } from '../components/BusinessCard.jsx';
import { useBusinessList, KINDS } from '../api.js';

const FILTER_KEYS = ['kind', 'categoryId', 'isVerified', 'openNow', 'sort'];

/** /businesses - list with filters, near me / area, load more (FR-BUS-1/2). */
export default function BusinessListPage() {
  const { t } = useTranslation();
  const [searchParams, setSearchParams] = useSearchParams();
  const { area, coords } = useLocationContext();

  const filters = useMemo(() => {
    const f = {};
    for (const k of FILTER_KEYS) {
      const v = searchParams.get(k);
      if (v) f[k] = v;
    }
    if (f.kind && !KINDS.includes(f.kind)) delete f.kind;
    if (f.sort === 'distance' && !coords) delete f.sort;
    return f;
  }, [searchParams, coords]);

  const params = useMemo(() => {
    const p = { ...filters };
    if (coords) {
      p.lat = coords.lat;
      p.lng = coords.lng;
      p.radiusKm = 10;
      p.sort ??= 'distance';
    } else if (area) {
      p.area = area;
    }
    return p;
  }, [filters, coords, area]);

  const query = useBusinessList(params);
  const items = query.data?.pages.flatMap((p) => p.data) ?? [];
  const total = query.data?.pages[0]?.meta?.total ?? 0;

  const update = (patch) => {
    const next = new URLSearchParams(searchParams);
    for (const [k, v] of Object.entries(patch)) {
      if (v === undefined || v === '') next.delete(k);
      else next.set(k, v);
    }
    setSearchParams(next, { replace: true });
  };

  const title = filters.kind === 'service' ? t('business.servicesTitle') : t('pages.businesses');

  return (
    <>
      <PageHeader title={title} />
      <div className="flex flex-col gap-4 p-4">
        <LocationBar />
        <BusinessFilters value={filters} onChange={update} nearMe={Boolean(coords)} />

        {query.isPending ? (
          <ListSkeleton rows={4} />
        ) : query.isError ? (
          <ErrorState error={query.error} onRetry={() => query.refetch()} />
        ) : items.length === 0 ? (
          <EmptyState icon={Store} title={t('business.emptyTitle')} body={t('business.emptyBody')} />
        ) : (
          <>
            <p className="text-sm text-ink-muted" aria-live="polite">
              {t('business.count', { count: total })}
            </p>
            <ul className="flex flex-col gap-3">
              {items.map((b) => (
                <li key={b.id}>
                  <BusinessCard business={b} />
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
      </div>
    </>
  );
}
