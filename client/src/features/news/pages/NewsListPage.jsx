import { useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Newspaper } from 'lucide-react';
import { PageHeader } from '../../../components/ui/Header.jsx';
import { ListSkeleton } from '../../../components/ui/Skeleton.jsx';
import { EmptyState } from '../../../components/ui/EmptyState.jsx';
import { ErrorState } from '../../../components/ui/ErrorState.jsx';
import { Button } from '../../../components/ui/Button.jsx';
import { chip } from '../../businesses/components/BusinessFilters.jsx';
import { NewsCard } from '../components/NewsCard.jsx';
import { NEWS_TYPES, useNewsList } from '../api.js';

/** /news - news and notices by type, pinned first, newest next (FR-NEWS-1, FR-NEWS-2). */
export default function NewsListPage() {
  const { t } = useTranslation();
  const [searchParams, setSearchParams] = useSearchParams();
  const rawType = searchParams.get('type');
  const type = NEWS_TYPES.some((x) => x.key === rawType) ? rawType : undefined;
  const params = useMemo(() => (type ? { type } : {}), [type]);

  const query = useNewsList(params);
  const items = query.data?.pages.flatMap((pg) => pg.data) ?? [];
  const total = query.data?.pages[0]?.meta?.total ?? 0;

  const setType = (value) => {
    const next = new URLSearchParams(searchParams);
    if (value) next.set('type', value);
    else next.delete('type');
    setSearchParams(next, { replace: true });
  };

  return (
    <>
      <PageHeader title={t('pages.news')} />
      <div className="page-wide flex flex-col gap-4 p-4">
        <div role="group" aria-label={t('news.type')} className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4">
          <button type="button" className={chip(!type)} aria-pressed={!type} onClick={() => setType(undefined)}>
            {t('news.allTypes')}
          </button>
          {NEWS_TYPES.map(({ key, icon: Icon }) => (
            <button key={key} type="button" className={`${chip(type === key)} gap-1.5`} aria-pressed={type === key} onClick={() => setType(key)}>
              <Icon className="h-4 w-4" aria-hidden="true" />
              {t(`news.types.${key}`)}
            </button>
          ))}
        </div>

        {query.isPending ? (
          <ListSkeleton rows={4} />
        ) : query.isError ? (
          <ErrorState error={query.error} onRetry={() => query.refetch()} />
        ) : items.length === 0 ? (
          <EmptyState icon={Newspaper} title={t('news.emptyTitle')} body={type ? t('news.emptyTypeBody') : t('news.emptyBody')} />
        ) : (
          <>
            <p className="text-sm text-ink-muted" aria-live="polite">
              {t('news.count', { count: total })}
            </p>
            <ul className="card-list">
              {items.map((n) => (
                <li key={n.id}>
                  <NewsCard item={n} />
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
