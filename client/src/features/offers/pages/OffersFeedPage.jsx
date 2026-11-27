import { useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { TicketPercent, X } from 'lucide-react';
import { PageHeader } from '../../../components/ui/Header.jsx';
import { LocationBar } from '../../../components/ui/LocationBar.jsx';
import { ListSkeleton } from '../../../components/ui/Skeleton.jsx';
import { EmptyState } from '../../../components/ui/EmptyState.jsx';
import { ErrorState } from '../../../components/ui/ErrorState.jsx';
import { Button } from '../../../components/ui/Button.jsx';
import { useLocationContext } from '../../../app/providers/LocationProvider.jsx';
import { OffersFilters } from '../components/OffersFilters.jsx';
import { OfferCard } from '../components/OfferCard.jsx';
import { useOffersFeed } from '../api.js';

const FILTER_KEYS = ['categoryId', 'subcategoryId', 'sort', 'businessId'];

/** /offers - currently valid offers of published businesses (FR-OFF-1/2). */
export default function OffersFeedPage() {
  const { t } = useTranslation();
  const [searchParams, setSearchParams] = useSearchParams();
  const { area, coords } = useLocationContext();

  const filters = useMemo(() => {
    const f = {};
    for (const k of FILTER_KEYS) {
      const v = searchParams.get(k);
      if (v) f[k] = v;
    }
    return f;
  }, [searchParams]);

  const params = useMemo(() => {
    const p = { ...filters };
    if (coords) {
      p.lat = coords.lat;
      p.lng = coords.lng;
      p.radiusKm = 10;
    } else if (area) {
      p.area = area;
    }
    return p;
  }, [filters, coords, area]);

  const query = useOffersFeed(params);
  const items = query.data?.pages.flatMap((pg) => pg.data) ?? [];
  const total = query.data?.pages[0]?.meta?.total ?? 0;
  const businessName = filters.businessId ? items[0]?.business?.name : null;

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
      <PageHeader title={t('pages.offers')} subtitle={t('intro.offers')} />
      <div className="page-wide flex flex-col gap-4 p-4">
        <LocationBar />
        {filters.businessId && (
          <button
            type="button"
            onClick={() => update({ businessId: undefined })}
            className="inline-flex min-h-[40px] w-fit items-center gap-2 rounded-full bg-brand-700 px-3.5 text-sm font-medium text-white"
          >
            {businessName ? t('offers.fromBusiness', { name: businessName }) : t('offers.oneBusiness')}
            <X className="h-4 w-4" aria-hidden="true" />
            <span className="sr-only">{t('offers.clearBusiness')}</span>
          </button>
        )}
        <OffersFilters value={filters} onChange={update} />

        {query.isPending ? (
          <ListSkeleton rows={4} />
        ) : query.isError ? (
          <ErrorState error={query.error} onRetry={() => query.refetch()} />
        ) : items.length === 0 ? (
          <EmptyState icon={TicketPercent} title={t('offers.emptyTitle')} body={t('offers.emptyBody')} />
        ) : (
          <>
            <p className="text-sm text-ink-muted" aria-live="polite">
              {t('offers.count', { count: total })}
            </p>
            <ul className="card-list">
              {items.map((o) => (
                <li key={o.id}>
                  <OfferCard offer={o} />
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
