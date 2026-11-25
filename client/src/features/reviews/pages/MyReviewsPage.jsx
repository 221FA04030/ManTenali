import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Star } from 'lucide-react';
import { PageHeader } from '../../../components/ui/Header.jsx';
import { ListSkeleton } from '../../../components/ui/Skeleton.jsx';
import { EmptyState } from '../../../components/ui/EmptyState.jsx';
import { ErrorState } from '../../../components/ui/ErrorState.jsx';
import { Badge } from '../../../components/ui/Badge.jsx';
import { formatDate } from '../../../lib/format.js';
import { useMyReviews } from '../api.js';
import { Stars } from '../components/Stars.jsx';

/** /profile/reviews - FR-PRO-2: every review I wrote; tap to open the business and edit there. */
export default function MyReviewsPage() {
  const { t, i18n } = useTranslation();
  const { data, isPending, isError, error, refetch } = useMyReviews();
  return (
    <>
      <PageHeader title={t('profile.myReviews')} />
      <div className="flex flex-col gap-3 p-4">
        {isPending ? (
          <ListSkeleton rows={3} />
        ) : isError ? (
          <ErrorState error={error} onRetry={refetch} />
        ) : data.length === 0 ? (
          <EmptyState icon={Star} title={t('reviews.mineEmptyTitle')} body={t('reviews.mineEmptyBody')} />
        ) : (
          <ul className="flex flex-col gap-3">
            {data.map((r) => {
              const body = (
                <>
                  <span className="flex flex-wrap items-center gap-2">
                    <span className="font-bold">{r.business?.name ?? t('reviews.businessUnavailable')}</span>
                    {r.status === 'hidden' && <Badge tone="gray">{t('reviews.hiddenBadge')}</Badge>}
                  </span>
                  <Stars value={r.rating} />
                  {r.comment && <span className="line-clamp-3 text-[15px] text-ink-muted">{r.comment}</span>}
                  <span className="text-xs text-ink-soft">{formatDate(r.createdAt, i18n.language)}</span>
                </>
              );
              const cls = 'flex flex-col gap-1 rounded-card bg-white p-4 shadow-card ring-1 ring-brand-100';
              return (
                <li key={r.id}>
                  {r.business ? (
                    <Link to={`/businesses/${r.business.slug}`} className={`${cls} hover:shadow-lift`}>
                      {body}
                    </Link>
                  ) : (
                    <div className={cls}>{body}</div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </>
  );
}
