import { Link, useParams } from 'react-router-dom';
import { AdminModerationMenu, useLeaveAfterDelete } from '../../moderation/components/AdminModerationMenu.jsx';
import { useTranslation } from 'react-i18next';
import { CalendarDays, ChevronRight, Clock, ExternalLink, MapPin, Store, Ticket, UserRound } from 'lucide-react';
import { PageHeader } from '../../../components/ui/Header.jsx';
import { Card } from '../../../components/ui/Card.jsx';
import { Badge, SampleBadge } from '../../../components/ui/Badge.jsx';
import { Skeleton, ListSkeleton } from '../../../components/ui/Skeleton.jsx';
import { ErrorState } from '../../../components/ui/ErrorState.jsx';
import { EmptyState } from '../../../components/ui/EmptyState.jsx';
import { cldUrl } from '../../../lib/cloudinary.js';
import { LocationMap } from '../../../components/ui/LocationMap.jsx';
import { categoryName } from '../../categories/api.js';
import { useEvent } from '../api.js';
import { EventStatusBadge, EventWhen } from '../components/EventBits.jsx';
import { useTrackOnce } from '../../../lib/analytics.js';
import { ItemActions } from '../../engagement/ItemActions.jsx';

/** /events/:slug - date, time, venue, map point, banner, booking link, linked business (FR-EVT-2). */
export default function EventDetailPage() {
  const { slug } = useParams();
  const { t, i18n } = useTranslation();
  const { data: e, isPending, isError, error, refetch } = useEvent(slug);
  const leave = useLeaveAfterDelete('/events');
  // Admin previews of non-public events carry a status; only public views are counted.
  useTrackOnce('view', 'event', e && !e.status ? e.id : undefined);

  if (isPending) {
    return (
      <>
        <PageHeader title={t('pages.events')} />
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
        <PageHeader title={t('pages.events')} />
        <div className="p-4">
          {error?.status === 404 ? (
            <EmptyState icon={CalendarDays} title={t('events.notFound')} body={t('events.notFoundBody')} />
          ) : (
            <ErrorState error={error} onRetry={refetch} />
          )}
        </div>
      </>
    );
  }

  return (
    <>
      <PageHeader title={e.title} />
      <div className="flex flex-col gap-4 p-4">
        {e.status && e.status !== 'published' && (
          <p className="flex items-center gap-2 rounded-xl bg-amber-50 p-3 text-sm text-amber-900">
            <EventStatusBadge status={e.status} /> {t('events.adminPreview')}
          </p>
        )}
        {e.bannerImage && (
          <img src={cldUrl(e.bannerImage.url, { w: 720, h: 405 })} alt="" className="aspect-video w-full rounded-card object-cover shadow-card" />
        )}
        {e.isCancelled && (
          <div role="status" className="rounded-card bg-red-50 p-4 text-red-900 ring-1 ring-red-200">
            <p className="font-bold">{t('events.cancelledTitle')}</p>
            {e.cancelReason && <p className="mt-1 text-sm">{e.cancelReason}</p>}
          </div>
        )}
        <Card className="flex flex-col gap-2">
          <div className="flex flex-wrap gap-1.5">
            {e.category && <Badge tone="gray">{categoryName(e.category, i18n.language)}</Badge>}
            {e.isSeed && <SampleBadge />}
          </div>
          <div className="flex items-start gap-1">
            <h2 className={`min-w-0 flex-1 text-xl font-bold leading-snug ${e.isCancelled ? 'line-through' : ''}`}>{e.title}</h2>
            <AdminModerationMenu type="event" id={e.id} title={e.title} onDone={leave} className="-mr-2 -mt-2" />
          </div>
          <p className="flex items-start gap-2 text-[15px]">
            <Clock className="mt-0.5 h-4 w-4 shrink-0 text-brand-700" aria-hidden="true" />
            <span>
              <EventWhen startLocal={e.startLocal} endLocal={e.endLocal} allDay={e.allDay} />
              <span className="block text-xs text-ink-soft">{t('events.istNote')}</span>
            </span>
          </p>
          {e.priceInfo && (
            <p className="flex items-center gap-2 text-[15px]">
              <Ticket className="h-4 w-4 shrink-0 text-brand-700" aria-hidden="true" /> {e.priceInfo}
            </p>
          )}
          <p className="flex items-center gap-2 text-sm text-ink-muted">
            <UserRound className="h-4 w-4 shrink-0" aria-hidden="true" /> {t('events.organizedBy', { name: e.organizerName })}
          </p>
          {e.bookingUrl && !e.isCancelled && (
            <a
              href={e.bookingUrl}
              target="_blank"
              rel="noopener noreferrer nofollow"
              className="mt-2 inline-flex min-h-tap items-center justify-center gap-2 rounded-full bg-brand-700 px-4 font-semibold text-white hover:bg-brand-800"
            >
              <ExternalLink className="h-4 w-4" aria-hidden="true" /> {t('events.book')}
            </a>
          )}
        </Card>

        {!e.status && <ItemActions targetType="event" targetId={e.id} title={e.title} />}

        {e.description && (
          <Card>
            <h3 className="mb-1.5 font-bold">{t('business.about')}</h3>
            <p className="whitespace-pre-line text-[15px] leading-relaxed text-ink-muted">{e.description}</p>
          </Card>
        )}

        <Card>
          <h3 className="mb-1.5 flex items-center gap-2 font-bold">
            <MapPin className="h-5 w-5 text-brand-700" aria-hidden="true" /> {t('events.venue')}
          </h3>
          <p className="text-[15px]">{e.venue.name}</p>
          <p className="text-sm text-ink-muted">{[e.venue.address, e.venue.area].join(', ')}</p>
          {e.location && (
            <div className="mt-3">
              <LocationMap location={e.location} label={e.venue.name} />
            </div>
          )}
        </Card>

        {e.business && (
          <Link to={`/businesses/${e.business.slug}`} className="flex min-h-[64px] items-center gap-3 rounded-card bg-white px-4 py-3 shadow-card ring-1 ring-brand-100 hover:shadow-lift">
            <Store className="h-6 w-6 shrink-0 text-brand-700" aria-hidden="true" />
            <span className="flex min-w-0 flex-1 flex-col">
              <span className="text-xs text-ink-soft">{t('events.linkedBusiness')}</span>
              <span className="truncate font-bold">{e.business.name}</span>
            </span>
            <ChevronRight className="h-5 w-5 text-ink-muted" aria-hidden="true" />
          </Link>
        )}
      </div>
    </>
  );
}
