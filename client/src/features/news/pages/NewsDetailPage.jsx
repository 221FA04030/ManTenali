import { useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Clock, ExternalLink, Newspaper, Pin } from 'lucide-react';
import { PageHeader } from '../../../components/ui/Header.jsx';
import { Card } from '../../../components/ui/Card.jsx';
import { Badge, SampleBadge } from '../../../components/ui/Badge.jsx';
import { Skeleton, ListSkeleton } from '../../../components/ui/Skeleton.jsx';
import { ErrorState } from '../../../components/ui/ErrorState.jsx';
import { EmptyState } from '../../../components/ui/EmptyState.jsx';
import { cldUrl } from '../../../lib/cloudinary.js';
import { categoryName } from '../../categories/api.js';
import { useNewsItem } from '../api.js';
import { NewsMeta, NewsStatusBadge, NewsTypeBadge, formatUntil } from '../components/NewsBits.jsx';
import { useTrackOnce } from '../../../lib/analytics.js';
import { ItemActions } from '../../engagement/ItemActions.jsx';

/** /news/:slug - full item with source, published and updated times (FR-NEWS-2). */
export default function NewsDetailPage() {
  const { slug } = useParams();
  const { t, i18n } = useTranslation();
  const { data: n, isPending, isError, error, refetch } = useNewsItem(slug);
  useTrackOnce('view', 'news', n && !n.status ? n.id : undefined);

  if (isPending) {
    return (
      <>
        <PageHeader title={t('pages.news')} />
        <div className="flex flex-col gap-3 p-4">
          <Skeleton className="aspect-video w-full rounded-card" />
          <ListSkeleton rows={2} />
        </div>
      </>
    );
  }
  if (isError) {
    return (
      <>
        <PageHeader title={t('pages.news')} />
        <div className="p-4">
          {error?.status === 404 ? (
            <EmptyState icon={Newspaper} title={t('news.notFound')} body={t('news.notFoundBody')} />
          ) : (
            <ErrorState error={error} onRetry={refetch} />
          )}
        </div>
      </>
    );
  }

  return (
    <>
      <PageHeader title={t('pages.news')} />
      <article className="flex flex-col gap-4 p-4">
        {n.status && n.status !== 'published' && (
          <p className="flex items-center gap-2 rounded-xl bg-amber-50 p-3 text-sm text-amber-900">
            <NewsStatusBadge status={n.status} /> {t('news.adminPreview')}
          </p>
        )}
        {n.isExpired && (
          <div role="status" className="rounded-card bg-gray-100 p-4 text-gray-800 ring-1 ring-gray-200">
            <p className="font-bold">{t('news.expiredTitle')}</p>
            <p className="mt-1 text-sm">{t('news.expiredBody', { time: formatUntil(n.validUntilLocal, i18n.language) })}</p>
          </div>
        )}
        {n.coverImage && (
          <img src={cldUrl(n.coverImage.url, { w: 720, h: 405 })} alt="" className="aspect-video w-full rounded-card object-cover shadow-card" />
        )}
        <Card className="flex flex-col gap-2">
          <div className="flex flex-wrap gap-1.5">
            {n.isPinned && (
              <Badge tone="solid" icon={Pin}>
                {t('news.pinned')}
              </Badge>
            )}
            <NewsTypeBadge type={n.type} />
            {n.category && <Badge tone="gray">{categoryName(n.category, i18n.language)}</Badge>}
            {n.isSeed && <SampleBadge />}
          </div>
          <h2 className="text-xl font-bold leading-snug">{n.title}</h2>
          <p className="text-[15px] font-medium leading-relaxed text-ink">{n.summary}</p>
          {n.validUntilLocal && !n.isExpired && (
            <p className="flex items-center gap-2 text-[15px]">
              <Clock className="h-4 w-4 shrink-0 text-brand-700" aria-hidden="true" />
              <span>
                {t('news.until', { time: formatUntil(n.validUntilLocal, i18n.language) })}
                <span className="block text-xs text-ink-soft">{t('events.istNote')}</span>
              </span>
            </p>
          )}
          <NewsMeta item={n} detailed className="border-t border-brand-100 pt-2" />
          {n.sourceUrl && (
            <a
              href={n.sourceUrl}
              target="_blank"
              rel="noopener noreferrer nofollow"
              className="inline-flex min-h-tap items-center gap-1.5 self-start text-sm font-semibold text-brand-700 hover:underline"
            >
              <ExternalLink className="h-4 w-4" aria-hidden="true" /> {t('news.openSource')}
            </a>
          )}
        </Card>

        {!n.status && <ItemActions targetType="news" targetId={n.id} title={n.title} canSave={false} />}

        {n.body && (
          <Card>
            {/* Plain text only (never HTML): line breaks are kept. */}
            <p className="whitespace-pre-line text-[15px] leading-relaxed text-ink-muted">{n.body}</p>
          </Card>
        )}
      </article>
    </>
  );
}
