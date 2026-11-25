import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { CalendarPlus, ChevronRight } from 'lucide-react';
import { PageHeader } from '../../../components/ui/Header.jsx';
import { ListSkeleton } from '../../../components/ui/Skeleton.jsx';
import { EmptyState } from '../../../components/ui/EmptyState.jsx';
import { ErrorState } from '../../../components/ui/ErrorState.jsx';
import { useMySubmissions } from '../api.js';
import { EventStatusBadge, EventWhen } from '../components/EventBits.jsx';

/** /events/submissions - the signed-in user's own event submissions and their status. */
export default function MySubmissionsPage() {
  const { t } = useTranslation();
  const { data = [], isPending, isError, error, refetch } = useMySubmissions();
  return (
    <>
      <PageHeader title={t('events.mySubmissions')} />
      <div className="flex flex-col gap-3 p-4">
        <Link
          to="/events/submit"
          className="flex min-h-[56px] items-center justify-center gap-2 rounded-card bg-brand-700 px-4 font-semibold text-white shadow-lift hover:bg-brand-800"
        >
          <CalendarPlus className="h-5 w-5" aria-hidden="true" /> {t('events.submitTitle')}
        </Link>
        {isPending ? (
          <ListSkeleton rows={2} />
        ) : isError ? (
          <ErrorState error={error} onRetry={refetch} />
        ) : data.length === 0 ? (
          <EmptyState icon={CalendarPlus} title={t('events.noSubmissions')} body={t('events.noSubmissionsBody')} />
        ) : (
          <ul className="flex flex-col gap-3">
            {data.map((e) => (
              <li key={e.id}>
                <Link to={`/events/submissions/${e.id}`} className="block rounded-card bg-white p-4 shadow-card ring-1 ring-brand-100 hover:shadow-lift">
                  <span className="flex items-start justify-between gap-2">
                    <span className="min-w-0">
                      <span className="block font-bold leading-snug">{e.title}</span>
                      <span className="block text-sm text-ink-muted">
                        <EventWhen startLocal={e.startLocal} endLocal={e.endLocal} allDay={e.allDay} />
                      </span>
                    </span>
                    <span className="flex flex-col items-end gap-1">
                      <EventStatusBadge status={e.status} />
                      <ChevronRight className="h-5 w-5 text-ink-muted" aria-hidden="true" />
                    </span>
                  </span>
                  {e.review?.note && ['changes_requested', 'rejected'].includes(e.status) && (
                    <span className={`mt-2 block rounded-xl p-2 text-sm ${e.status === 'rejected' ? 'bg-red-50 text-red-900' : 'bg-blue-50 text-blue-900'}`}>
                      {e.review.note}
                    </span>
                  )}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </>
  );
}
