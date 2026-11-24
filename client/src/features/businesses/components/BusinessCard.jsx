import { Link } from 'react-router-dom';
import { MapPin, Star } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { TrustBadge, Badge } from '../../../components/ui/Badge.jsx';
import { IconBubble } from '../../../components/ui/IconBubble.jsx';
import { ContactActions } from './ContactActions.jsx';
import { categoryName } from '../../categories/api.js';
import { categoryIcon } from '../../../lib/categoryIcons.js';
import { cldUrl } from '../../../lib/cloudinary.js';
import { formatDistance, formatRelative } from '../../../lib/format.js';

/** Business card: photo, name, badges, distance, freshness and one-tap contact. */
export function BusinessCard({ business: b }) {
  const { t, i18n } = useTranslation();
  const lang = i18n.language;
  return (
    <article className="overflow-hidden rounded-card bg-white shadow-card ring-1 ring-brand-100">
      <Link to={`/businesses/${b.slug}`} className="flex gap-3 p-3 hover:bg-brand-50/60">
        {b.photo ? (
          <img
            src={cldUrl(b.photo.url, { w: 176, h: 176 })}
            alt=""
            loading="lazy"
            className="h-[88px] w-[88px] shrink-0 rounded-2xl object-cover"
          />
        ) : (
          <IconBubble icon={categoryIcon(b.category?.icon)} size="lg" className="h-[88px] w-[88px]" />
        )}
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <TrustBadge isVerified={b.isVerified} isSeed={b.isSeed} />
            {b.isOpenNow === true && <Badge tone="green">{t('business.openNow')}</Badge>}
            {b.isOpenNow === false && <Badge tone="gray">{t('business.closedNow')}</Badge>}
          </div>
          <h3 className="line-clamp-2 text-base font-bold leading-snug text-ink">{b.name}</h3>
          <p className="truncate text-[13px] text-ink-muted">
            {[categoryName(b.category, lang), b.area].filter(Boolean).join(' • ')}
          </p>
          <p className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-ink-soft">
            {b.distanceM !== undefined && (
              <span className="inline-flex items-center gap-1">
                <MapPin className="h-3.5 w-3.5" aria-hidden="true" />
                {formatDistance(b.distanceM)}
              </span>
            )}
            {b.ratingCount > 0 && (
              <span className="inline-flex items-center gap-1">
                <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" aria-hidden="true" />
                {b.ratingAvg.toFixed(1)} ({b.ratingCount})
              </span>
            )}
            <span>{t('common.updated', { time: formatRelative(b.updatedAt, lang) })}</span>
          </p>
        </div>
      </Link>
      <div className="border-t border-brand-100 px-3 py-2.5">
        <ContactActions contact={b.contact} location={b.location} name={b.name} size="sm" />
      </div>
    </article>
  );
}
