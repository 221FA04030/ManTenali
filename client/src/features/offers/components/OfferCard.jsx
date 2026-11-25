import { Link } from 'react-router-dom';
import { MapPin, TicketPercent } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { SampleBadge } from '../../../components/ui/Badge.jsx';
import { cldUrl } from '../../../lib/cloudinary.js';
import { EndsIn } from './OfferBits.jsx';

/** Offer card: discount label, title, business, countdown. */
export function OfferCard({ offer: o, showBusiness = true, compact = false }) {
  const { t } = useTranslation();
  return (
    <Link
      to={`/offers/${o.id}`}
      className="flex gap-3 rounded-card bg-white p-3 shadow-card ring-1 ring-brand-100 transition-shadow hover:shadow-lift"
    >
      <span className="relative flex h-[84px] w-[84px] shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-brand-700 text-center text-white">
        {o.image ? (
          <img src={cldUrl(o.image.url, { w: 168, h: 168 })} alt="" loading="lazy" className="h-full w-full object-cover" />
        ) : (
          <TicketPercent className="h-8 w-8 opacity-90" aria-hidden="true" />
        )}
      </span>
      <span className="flex min-w-0 flex-1 flex-col gap-1">
        <span className="w-fit max-w-full truncate rounded-full bg-amber-100 px-2.5 py-0.5 text-sm font-bold text-amber-900">
          {o.discountLabel}
        </span>
        <span className={compact ? 'line-clamp-1 font-bold leading-snug' : 'line-clamp-2 font-bold leading-snug'}>{o.title}</span>
        {showBusiness && o.business && (
          <span className="flex min-w-0 items-center gap-1 text-[13px] text-ink-muted">
            <MapPin className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            <span className="truncate">{[o.business.name, o.business.area].filter(Boolean).join(' • ')}</span>
          </span>
        )}
        <span className="flex flex-wrap items-center gap-2">
          <EndsIn validToDate={o.validToDate} />
          {o.isSeed && <SampleBadge />}
        </span>
        <span className="sr-only">{t('offers.viewOffer')}</span>
      </span>
    </Link>
  );
}
