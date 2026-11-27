import { useMemo } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Plus, Store } from 'lucide-react';
import { PageHeader } from '../../../components/ui/Header.jsx';
import { LocationBar } from '../../../components/ui/LocationBar.jsx';
import { ListSkeleton } from '../../../components/ui/Skeleton.jsx';
import { EmptyState } from '../../../components/ui/EmptyState.jsx';
import { ErrorState } from '../../../components/ui/ErrorState.jsx';
import { Button } from '../../../components/ui/Button.jsx';
import { useLocationContext } from '../../../app/providers/LocationProvider.jsx';
import { BusinessFilters } from '../components/BusinessFilters.jsx';
import { BusinessListItem } from '../components/BusinessListItem.jsx';
import { useBusinessList, KINDS } from '../api.js';
import { useCategoryTree, categoryName } from '../../categories/api.js';

const FILTER_KEYS = ['kind', 'categoryId', 'subcategoryId', 'isVerified', 'openNow', 'sort', 'cuisine', 'priceRange', 'isVegFriendly'];

/**
 * Business directory: list with filters, near me / area, load more (FR-BUS-1/2).
 * `fixedKind` locks the kind (e.g. "food" for /food). `renderPrimary(value, onChange)`
 * replaces the category chips with the page's own main choice (cuisines on /food);
 * `sheetExtras` adds page-specific filters to the Filters sheet (price, veg-friendly).
 */
export function BusinessDirectory({ fixedKind, title: fixedTitle, intro: fixedIntro, renderPrimary, sheetExtras, emptyIcon = Store }) {
  const { t, i18n } = useTranslation();
  const { tree } = useCategoryTree('business');
  const [searchParams, setSearchParams] = useSearchParams();
  const { area, coords } = useLocationContext();

  const filters = useMemo(() => {
    const f = {};
    for (const k of FILTER_KEYS) {
      const v = searchParams.get(k);
      if (v) f[k] = v;
    }
    if (f.kind && !KINDS.includes(f.kind)) delete f.kind;
    if (fixedKind) delete f.kind;
    if (f.sort === 'distance' && !coords) delete f.sort;
    return f;
  }, [searchParams, coords, fixedKind]);

  const params = useMemo(() => {
    const p = { ...filters };
    if (fixedKind) p.kind = fixedKind;
    if (coords) {
      p.lat = coords.lat;
      p.lng = coords.lng;
      p.radiusKm = 10;
      p.sort ??= 'distance';
    } else if (area) {
      p.area = area;
    }
    return p;
  }, [filters, coords, area, fixedKind]);

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

  // Name the page after what was chosen (e.g. "Shopping" from the Home tile).
  const main = tree.find((m) => m.id === filters.categoryId);
  const sub = main?.children.find((c) => c.id === filters.subcategoryId);
  const title =
    fixedTitle ??
    (main ? categoryName(main, i18n.language) : filters.kind === 'service' ? t('business.servicesTitle') : t('pages.businesses'));
  const intro =
    fixedIntro ??
    (main
      ? t('intro.category', { name: categoryName(sub ?? main, i18n.language) })
      : filters.kind === 'service'
        ? t('intro.services')
        : t('intro.businesses'));
  const loading = query.isPending;

  return (
    <>
      <PageHeader title={title} subtitle={intro} />
      <div className="page-wide flex flex-col gap-3 p-4">
        <LocationBar />
        <BusinessFilters
          value={filters}
          onChange={update}
          nearMe={Boolean(coords)}
          fixedKind={fixedKind}
          primary={renderPrimary?.(filters, update)}
          sheetExtras={sheetExtras}
          total={query.isError ? undefined : total}
          loading={loading}
        />

        {loading ? (
          <ListSkeleton rows={4} />
        ) : query.isError ? (
          <ErrorState error={query.error} onRetry={() => query.refetch()} />
        ) : items.length === 0 ? (
          <EmptyState icon={emptyIcon} title={t('business.emptyTitle')} body={t('business.emptyBody')} />
        ) : (
          <>
            <ul className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
              {items.map((b) => (
                <li key={b.id} className="min-w-0">
                  <BusinessListItem business={b} />
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

        <Link
          to="/manage/new"
          className="mt-2 flex items-center gap-3 rounded-card bg-brand-50 p-4 ring-1 ring-brand-200 hover:bg-brand-100"
        >
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-brand-700 text-white">
            <Plus className="h-5 w-5" aria-hidden="true" />
          </span>
          <span className="flex flex-col">
            <span className="font-bold text-ink">{t('submit.ctaTitle')}</span>
            <span className="text-sm text-ink-muted">{t('submit.ctaBody')}</span>
          </span>
        </Link>
      </div>
    </>
  );
}

/** /businesses */
export default function BusinessListPage() {
  return <BusinessDirectory />;
}
