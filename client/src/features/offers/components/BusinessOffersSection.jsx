import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ArrowRight, Settings, TicketPercent } from 'lucide-react';
import { Card } from '../../../components/ui/Card.jsx';
import { Skeleton } from '../../../components/ui/Skeleton.jsx';
import { useBusinessOffers } from '../api.js';
import { OfferCard } from './OfferCard.jsx';

const SHOWN = 3;

/**
 * Offers section on the business page: loaded separately from
 * GET /businesses/:id/offers (never embedded in the business response).
 * Hidden entirely when there are no active offers, unless the viewer manages the business.
 */
export function BusinessOffersSection({ businessId, canManage }) {
  const { t } = useTranslation();
  const { data, isPending, isError } = useBusinessOffers(businessId, SHOWN);
  const items = data?.data ?? [];
  const total = data?.meta?.total ?? 0;

  if (isPending) return <Skeleton className="h-28 w-full rounded-card" />;
  if ((isError || items.length === 0) && !canManage) return null;

  return (
    <Card>
      <div className="mb-3 flex items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 text-base font-bold">
          <TicketPercent className="h-5 w-5 text-brand-700" aria-hidden="true" />
          {t('offers.title')}
        </h2>
        {canManage && (
          <Link to={`/manage/businesses/${businessId}/offers`} className="inline-flex min-h-tap items-center gap-1 text-sm font-semibold text-brand-700">
            <Settings className="h-4 w-4" aria-hidden="true" /> {t('offers.manage')}
          </Link>
        )}
      </div>
      {items.length === 0 ? (
        <p className="text-sm text-ink-muted">{t('offers.noneForBusiness')}</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {items.map((o) => (
            <li key={o.id}>
              <OfferCard offer={o} showBusiness={false} compact />
            </li>
          ))}
        </ul>
      )}
      {total > SHOWN && (
        <Link
          to={`/offers?businessId=${businessId}`}
          className="mt-3 inline-flex min-h-tap items-center gap-1 text-sm font-semibold text-brand-700 hover:underline"
        >
          {t('offers.viewAllCount', { count: total })}
          <ArrowRight className="h-4 w-4" aria-hidden="true" />
        </Link>
      )}
    </Card>
  );
}
