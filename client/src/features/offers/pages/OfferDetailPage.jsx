import { Link, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { CalendarDays, ChevronRight, ClipboardList, Pencil, Store, TicketPercent } from 'lucide-react';
import { PageHeader } from '../../../components/ui/Header.jsx';
import { Card } from '../../../components/ui/Card.jsx';
import { SampleBadge } from '../../../components/ui/Badge.jsx';
import { Skeleton, ListSkeleton } from '../../../components/ui/Skeleton.jsx';
import { ErrorState } from '../../../components/ui/ErrorState.jsx';
import { EmptyState } from '../../../components/ui/EmptyState.jsx';
import { cldUrl } from '../../../lib/cloudinary.js';
import { useOffer } from '../api.js';
import { useTrackOnce } from '../../../lib/analytics.js';
import { ItemActions } from '../../engagement/ItemActions.jsx';
import { CouponCode, EndsIn, OfferStatusBadge, ValidityDates } from '../components/OfferBits.jsx';

/** /offers/:id - full offer (FR-OFF-2): terms, redemption, IST validity, coupon, business. */
export default function OfferDetailPage() {
  const { id } = useParams();
  const { t } = useTranslation();
  const { data: o, isPending, isError, error, refetch } = useOffer(id);
  // offer_view counts public views only (not owners previewing drafts or scheduled offers).
  useTrackOnce('offer_view', 'offer', o && (!o.canManage || o.displayStatus === 'live') ? o.id : undefined);

  if (isPending) {
    return (
      <>
        <PageHeader title={t('pages.offers')} />
        <div className="flex flex-col gap-3 p-4">
          <Skeleton className="h-32 w-full rounded-card" />
          <ListSkeleton rows={2} />
        </div>
      </>
    );
  }
  if (isError) {
    return (
      <>
        <PageHeader title={t('pages.offers')} />
        <div className="p-4">
          {error?.status === 404 ? (
            <EmptyState icon={TicketPercent} title={t('offers.notFound')} body={t('offers.notFoundBody')} />
          ) : (
            <ErrorState error={error} onRetry={refetch} />
          )}
        </div>
      </>
    );
  }

  const live = !o.canManage || o.displayStatus === 'live';

  return (
    <>
      <PageHeader
        title={o.discountLabel}
        actions={
          o.canManage && (
            <Link
              to={`/manage/offers/${o.id}/edit`}
              aria-label={t('offers.edit')}
              className="flex min-h-tap min-w-tap items-center justify-center rounded-full text-white hover:bg-white/15"
            >
              <Pencil className="h-5 w-5" aria-hidden="true" />
            </Link>
          )
        }
      />
      <div className="flex flex-col gap-4 p-4">
        {o.image && (
          <img src={cldUrl(o.image.url, { w: 720, h: 405 })} alt="" className="aspect-video w-full rounded-card object-cover shadow-card" />
        )}

        {live && <ItemActions targetType="offer" targetId={o.id} title={o.title} />}

        <Card className="flex flex-col gap-2">
          <div className="flex flex-wrap items-center gap-1.5">
            {o.canManage && <OfferStatusBadge status={o.displayStatus} />}
            {o.isSeed && <SampleBadge />}
          </div>
          <p className="w-fit rounded-full bg-amber-100 px-3 py-1 text-lg font-bold text-amber-900">{o.discountLabel}</p>
          <h2 className="text-xl font-bold leading-snug">{o.title}</h2>
          {o.description && <p className="whitespace-pre-line text-[15px] text-ink-muted">{o.description}</p>}
          <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-ink-muted">
            <span className="inline-flex items-center gap-1">
              <CalendarDays className="h-4 w-4" aria-hidden="true" />
              <ValidityDates from={o.validFromDate} to={o.validToDate} />
            </span>
            {live && <EndsIn validToDate={o.validToDate} />}
          </p>
        </Card>

        {o.couponCode && <CouponCode code={o.couponCode} />}

        {o.redemptionInstructions && (
          <Card>
            <h3 className="mb-1.5 flex items-center gap-2 font-bold">
              <ClipboardList className="h-5 w-5 text-brand-700" aria-hidden="true" />
              {t('offers.howToRedeem')}
            </h3>
            <p className="whitespace-pre-line text-[15px] text-ink-muted">{o.redemptionInstructions}</p>
          </Card>
        )}

        <Card>
          <h3 className="mb-1.5 font-bold">{t('offers.terms')}</h3>
          <p className="whitespace-pre-line text-sm leading-relaxed text-ink-muted">{o.terms}</p>
        </Card>

        {o.business && (
          <Link
            to={`/businesses/${o.business.slug}`}
            className="flex min-h-[64px] items-center gap-3 rounded-card bg-white px-4 py-3 shadow-card ring-1 ring-brand-100 hover:shadow-lift"
          >
            <Store className="h-6 w-6 shrink-0 text-brand-700" aria-hidden="true" />
            <span className="flex min-w-0 flex-1 flex-col">
              <span className="text-xs text-ink-soft">{t('offers.offeredBy')}</span>
              <span className="truncate font-bold">{o.business.name}</span>
              {o.business.area && <span className="text-sm text-ink-muted">{o.business.area}</span>}
            </span>
            <ChevronRight className="h-5 w-5 text-ink-muted" aria-hidden="true" />
          </Link>
        )}
      </div>
    </>
  );
}
