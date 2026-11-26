import { useMemo } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { MessagesSquare, PenLine } from 'lucide-react';
import { PageHeader } from '../../../components/ui/Header.jsx';
import { ListSkeleton } from '../../../components/ui/Skeleton.jsx';
import { EmptyState } from '../../../components/ui/EmptyState.jsx';
import { ErrorState } from '../../../components/ui/ErrorState.jsx';
import { Button } from '../../../components/ui/Button.jsx';
import { chip } from '../../businesses/components/BusinessFilters.jsx';
import { PostCard } from '../components/PostCard.jsx';
import { POST_KINDS, usePostFeed } from '../api.js';

/** /community - local recommendations, questions and updates, newest first. */
export default function CommunityPage() {
  const { t } = useTranslation();
  const [searchParams, setSearchParams] = useSearchParams();
  const rawKind = searchParams.get('kind');
  const kind = POST_KINDS.some((k) => k.key === rawKind) ? rawKind : undefined;
  const params = useMemo(() => (kind ? { kind } : {}), [kind]);
  const query = usePostFeed(params);
  const items = query.data?.pages.flatMap((pg) => pg.data) ?? [];

  const setKind = (value) => {
    const next = new URLSearchParams(searchParams);
    if (value) next.set('kind', value);
    else next.delete('kind');
    setSearchParams(next, { replace: true });
  };

  return (
    <>
      <PageHeader title={t('pages.community')} subtitle={t('community.tagline')} />
      <div className="page-wide flex flex-col gap-4 p-4">
        <Link
          to="/community/new"
          className="flex min-h-[56px] items-center gap-3 rounded-card bg-white px-4 text-[15px] text-ink-muted shadow-card ring-1 ring-brand-100 hover:ring-brand-300"
        >
          <PenLine className="h-5 w-5 text-brand-700" aria-hidden="true" />
          <span className="flex-1">{t('community.prompt')}</span>
          <span className="rounded-full bg-brand-700 px-3 py-1.5 text-sm font-semibold text-white">{t('community.write')}</span>
        </Link>
        <div role="group" aria-label={t('community.kindLabel')} className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4">
          <button type="button" className={chip(!kind)} aria-pressed={!kind} onClick={() => setKind(undefined)}>
            {t('community.all')}
          </button>
          {POST_KINDS.map(({ key, icon: Icon }) => (
            <button key={key} type="button" className={`${chip(kind === key)} gap-1.5`} aria-pressed={kind === key} onClick={() => setKind(key)}>
              <Icon className="h-4 w-4" aria-hidden="true" />
              {t(`community.kindsPlural.${key}`)}
            </button>
          ))}
        </div>
        {query.isPending ? (
          <ListSkeleton rows={3} />
        ) : query.isError ? (
          <ErrorState error={query.error} onRetry={() => query.refetch()} />
        ) : items.length === 0 ? (
          <EmptyState icon={MessagesSquare} title={t('community.emptyTitle')} body={t('community.emptyBody')} />
        ) : (
          <>
            <h2 className="sr-only">{t('community.latest')}</h2>
            <ul className="card-list">
              {items.map((p) => (
                <li key={p.id}>
                  <PostCard post={p} />
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
