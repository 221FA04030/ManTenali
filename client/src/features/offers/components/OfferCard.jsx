import { Link } from 'react-router-dom';
import { MapPin, TicketPercent } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { SampleBadge } from '../../../components/ui/Badge.jsx';
import { cldUrl } from '../../../lib/cloudinary.js';
import { EndsIn } from './OfferBits.jsx';

/**
 * Offer card styled as a coupon: the deal on a green stub (or on the offer's own
 * photo), a dashed tear line, then title, business and countdown.
 */
export function OfferCard({ offer: o, showBusiness = true, compact = false }) {
  const { t } = useTranslation();
  return (
    <Link
      to={`/offers/${o.id}`}
      className="group relative flex min-h-[112px] overflow-hidden rounded-2xl bg-white shadow-soft ring-1 ring-black/[0.04] transition duration-150 hover:shadow-lift active:scale-[0.99] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
    >
      <span className="relative flex w-[104px] shrink-0 flex-col items-center justify-center gap-1 overflow-hidden bg-primary px-2 py-3 text-center text-white">
        {o.image ? (
          <>
            <img src={cldUrl(o.image.url, { w: 208, h: 240 })} alt="" loading="lazy" className="absolute inset-0 h-full w-full object-cover" />
            <span aria-hidden="true" className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
          </>
        ) : (
          <TicketPercent className="h-6 w-6 opacity-80" aria-hidden="true" />
        )}
        <span className={`relative line-clamp-3 break-words text-[15px] font-extrabold leading-tight ${o.image ? 'mt-auto' : ''}`}>{o.discountLabel}</span>
      </span>
      <span aria-hidden="true" className="my-2 w-0 border-l-2 border-dashed border-gray-200" />
      <span className="flex min-w-0 flex-1 flex-col gap-1 p-3.5">
        <span className={`${compact ? 'line-clamp-1' : 'line-clamp-2'} text-[16px] font-semibold leading-snug text-heading group-hover:text-primary-dark`}>{o.title}</span>
        {showBusiness && o.business && (
          <span className="flex min-w-0 items-center gap-1 text-[13px] text-meta">
            <MapPin className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            <span className="truncate">{[o.business.name, o.business.area].filter(Boolean).join(' • ')}</span>
          </span>
        )}
        <span className="mt-auto flex flex-wrap items-center gap-2 pt-1">
          <EndsIn validToDate={o.validToDate} />
          {o.isSeed && <SampleBadge />}
        </span>
        <span className="sr-only">{t('offers.viewOffer')}</span>
      </span>
    </Link>
  );
}
