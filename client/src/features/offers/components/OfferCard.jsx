import { useState } from 'react';
import { Link } from 'react-router-dom';
import { TicketPercent } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { SampleBadge } from '../../../components/ui/Badge.jsx';
import { cldUrl } from '../../../lib/cloudinary.js';
import { EndsIn } from './OfferBits.jsx';

/** The offer's own image, else its business's photo, else a ticket icon tile. */
function OfferPhoto({ offer: o }) {
  const [failed, setFailed] = useState(false);
  const url = o.image?.url ?? o.business?.photo?.url;
  if (url && !failed) {
    return (
      <img
        src={cldUrl(url, { w: 184, h: 184 })}
        alt=""
        width={92}
        height={92}
        loading="lazy"
        decoding="async"
        onError={() => setFailed(true)}
        className="h-[92px] w-[92px] shrink-0 rounded-xl bg-gray-100 object-cover shadow-sm"
      />
    );
  }
  return (
    <span aria-hidden="true" className="flex h-[92px] w-[92px] shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-primary-light to-[#d3ebdb] text-primary shadow-sm">
      <TicketPercent className="h-9 w-9" strokeWidth={1.8} />
    </span>
  );
}

/**
 * Offer row in the reference's offers layout: photo on the left, the business
 * name, the offer, the deal line in the offer colour (with the coupon code if
 * there is one) and how long it runs.
 */
export function OfferCard({ offer: o, showBusiness = true, compact = false }) {
  const { t } = useTranslation();
  return (
    <Link
      to={`/offers/${o.id}`}
      className="group flex gap-4 rounded-xl py-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
    >
      <OfferPhoto offer={o} />
      <span className="flex min-w-0 flex-1 flex-col gap-0.5 pt-0.5">
        {showBusiness && o.business && (
          <span className="truncate text-[16px] font-bold leading-snug text-heading group-hover:text-primary-dark">{o.business.name}</span>
        )}
        <span className={`${compact || showBusiness ? 'line-clamp-1' : 'line-clamp-2 font-semibold text-heading'} text-[13px] text-meta`}>{o.title}</span>
        <span className="truncate text-[13px] font-semibold text-offer-text">
          {o.discountLabel}
          {o.couponCode && ` | ${t('offers.useCode', { code: o.couponCode })}`}
        </span>
        <span className="mt-1 flex flex-wrap items-center gap-2">
          <EndsIn validToDate={o.validToDate} />
          {o.isSeed && <SampleBadge />}
        </span>
        {showBusiness && o.business?.area && <span className="text-[12px] text-meta">{o.business.area}</span>}
        <span className="sr-only">{t('offers.viewOffer')}</span>
      </span>
    </Link>
  );
}
