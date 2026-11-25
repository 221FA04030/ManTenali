import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { CalendarCheck, ChevronRight } from 'lucide-react';
import { PageHeader } from '../../../components/ui/Header.jsx';
import { Pagination } from '../../../components/ui/Pagination.jsx';
import { ListSkeleton } from '../../../components/ui/Skeleton.jsx';
import { EmptyState } from '../../../components/ui/EmptyState.jsx';
import { ErrorState } from '../../../components/ui/ErrorState.jsx';
import { formatRelative } from '../../../lib/format.js';
import { cn } from '../../../lib/cn.js';
import { useEventQueue } from '../../events/api.js';
import { EventStatusBadge } from '../../events/components/EventBits.jsx';
import { formatIsoDate } from '../../../lib/dates.js';

const TABS = ['pending_review', 'changes_requested', 'rejected', 'withdrawn', 'published'];

/** /admin/event-submissions - moderation queue for community event submissions. */
export default function AdminEventSubmissionsPage() {
  const { t, i18n } = useTranslation();
  const [status, setStatus] = useState('pending_review');
  const [page, setPage] = useState(1);
  const { data, isPending, isError, error, refetch } = useEventQueue({ status, page });
  const items = data?.data ?? [];

  return (
    <>
      <PageHeader title={t('eventReview.title')} />
      <div className="flex flex-col gap-3 p-4">
        <div role="tablist" aria-label={t('eventReview.title')} className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4">
          {TABS.map((s) => (
            <button
              key={s}
              role="tab"
              type="button"
              aria-selected={status === s}
              onClick={() => {
                setStatus(s);
                setPage(1);
              }}
              className={cn(
                'min-h-[40px] shrink-0 rounded-full px-3.5 text-sm font-semibold ring-1',
                status === s ? 'bg-brand-700 text-white ring-brand-700' : 'bg-white text-ink ring-brand-200',
              )}
            >
              {t(`events.status.${s}`)}
            </button>
          ))}
        </div>
        {isPending ? (
          <ListSkeleton rows={3} />
        ) : isError ? (
          <ErrorState error={error} onRetry={refetch} />
        ) : items.length === 0 ? (
          <EmptyState icon={CalendarCheck} title={t('eventReview.emptyTitle')} body={t('eventReview.emptyBody')} />
        ) : (
          <ul className="flex flex-col gap-3">
            {items.map((e) => (
              <li key={e.id}>
                <Link to={`/admin/event-submissions/${e.id}`} className="flex items-center gap-3 rounded-card bg-white p-4 shadow-card ring-1 ring-brand-100 hover:shadow-lift">
                  <span className="min-w-0 flex-1">
                    <span className="block font-bold leading-snug">{e.title}</span>
                    <span className="block text-sm text-ink-muted">
                      {[formatIsoDate(e.startLocal.slice(0, 10), i18n.language), e.area].filter(Boolean).join(' • ')}
                    </span>
                    <span className="block text-xs text-ink-soft">
                      {[
                        e.submitter?.name && t('review.by', { name: e.submitter.name }),
                        e.submittedAt && t('review.submitted', { time: formatRelative(e.submittedAt, i18n.language) }),
                        e.revision > 1 && t('events.revision', { n: e.revision }),
                      ]
                        .filter(Boolean)
                        .join(' • ')}
                    </span>
                  </span>
                  <span className="flex flex-col items-end gap-1">
                    <EventStatusBadge status={e.status} />
                    <ChevronRight className="h-5 w-5 text-ink-muted" aria-hidden="true" />
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
        {data?.meta && <Pagination page={data.meta.page} totalPages={data.meta.totalPages} onChange={setPage} />}
      </div>
    </>
  );
}
