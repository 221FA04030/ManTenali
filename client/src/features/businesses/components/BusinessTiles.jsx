import { useState } from 'react';
import { Link } from 'react-router-dom';
import { BadgeCheck, MapPin, Star } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { SampleBadge } from '../../../components/ui/Badge.jsx';
import { ContactActions } from './ContactActions.jsx';
import { PriceRange, useCuisineLabels } from '../../food/components/FoodBits.jsx';
import { categoryName } from '../../categories/api.js';
import { categoryIcon } from '../../../lib/categoryIcons.js';
import { cldUrl } from '../../../lib/cloudinary.js';
import { formatDistance } from '../../../lib/format.js';
import { track } from '../../../lib/analytics.js';
import { cn } from '../../../lib/cn.js';

/**
 * A business photo at a fixed size and crop. Without a photo (or if it fails
 * to load) it shows the business's category icon on a light green tile, so the
 * layout never jumps and no stand-in picture is shown.
 */
export function BusinessPhoto({ business: b, size, className, round = false }) {
  const [failed, setFailed] = useState(false);
  const Icon = categoryIcon(b.subcategory?.icon ?? b.category?.icon);
  const shape = round ? 'rounded-full' : 'rounded-xl';
  if (b.photo?.url && !failed) {
    return (
      <img
        src={cldUrl(b.photo.url, { w: size * 2, h: size * 2 })}
        alt=""
        width={size}
        height={size}
        loading="lazy"
        decoding="async"
        onError={() => setFailed(true)}
        className={cn('shrink-0 bg-gray-100 object-cover', shape, className)}
      />
    );
  }
  return (
    <span aria-hidden="true" className={cn('flex shrink-0 items-center justify-center bg-gradient-to-br from-primary-light to-[#d3ebdb] text-primary', shape, className)}>
      <Icon className="h-[38%] w-[38%]" strokeWidth={1.8} />
    </span>
  );
}

/** "Category • cuisines" line used under business names. */
function useWhat(b) {
  const { i18n } = useTranslation();
  const cuisineLabels = useCuisineLabels();
  const what = categoryName(b.subcategory ?? b.category, i18n.language);
  return b.food?.cuisines?.length ? cuisineLabels(b.food.cuisines) : what;
}

/** "★ 4.5 • ₹₹ • 1.2 km" meta line; only the parts that exist. */
function MetaLine({ business: b }) {
  const parts = [];
  if (b.ratingCount > 0)
    parts.push(
      <span key="r" className="inline-flex items-center gap-0.5 font-semibold text-label">
        <Star className="h-3.5 w-3.5 fill-current text-label" aria-hidden="true" />
        {b.ratingAvg.toFixed(1)}
      </span>,
    );
  if (b.priceRange) parts.push(<PriceRange key="p" value={b.priceRange} />);
  if (b.distanceM !== undefined) parts.push(<span key="d">{formatDistance(b.distanceM)}</span>);
  if (!parts.length) return null;
  return (
    <p className="flex min-w-0 items-center gap-1.5 text-[13px] text-meta">
      {parts.flatMap((p, i) => (i ? [<span key={`s${i}`} aria-hidden="true">•</span>, p] : [p]))}
    </p>
  );
}

/**
 * The reference's restaurant row: photo on the left, then name, what they
 * offer, area, status and the rating / price / distance line. Contact actions
 * (Call, WhatsApp, Directions) sit below in a compact row when `actions`.
 */
export function BusinessRow({ business: b, actions = true }) {
  const { t } = useTranslation();
  const what = useWhat(b);
  return (
    <article className="flex flex-col gap-3 py-4">
      <Link to={`/businesses/${b.slug}`} className="group flex gap-4 rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-4">
        <BusinessPhoto business={b} size={92} className="h-[92px] w-[92px] shadow-sm" />
        <div className="flex min-w-0 flex-1 flex-col gap-0.5 pt-0.5">
          <h3 className="line-clamp-2 text-[16px] font-bold leading-snug text-heading group-hover:text-primary-dark">
            {b.name}
            {b.isVerified && !b.isSeed && <BadgeCheck className="ml-1 inline h-4 w-4 align-[-2px] text-primary" aria-label={t('badge.verified')} />}
          </h3>
          {what && <p className="truncate text-[13px] text-meta">{what}</p>}
          {b.area && b.distanceM === undefined && (
            <p className="flex min-w-0 items-center gap-1 text-[13px] text-meta">
              <MapPin className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
              <span className="truncate">{b.area}</span>
            </p>
          )}
          {typeof b.isOpenNow === 'boolean' && (
            <p className={cn('text-[13px] font-semibold', b.isOpenNow ? 'text-primary' : 'text-meta')}>
              {t(b.isOpenNow ? 'business.openNow' : 'business.closedNow')}
            </p>
          )}
          <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1">
            <MetaLine business={b} />
            {b.food?.isVegFriendly && (
              <span className="inline-flex items-center gap-1 text-[12px] font-semibold text-primary">
                <span aria-hidden="true" className="flex h-3 w-3 items-center justify-center rounded-[2px] border border-primary">
                  <span className="h-1.5 w-1.5 rounded-full bg-primary" />
                </span>
                {t('food.vegFriendly')}
              </span>
            )}
            {b.isSeed && <SampleBadge />}
          </div>
        </div>
      </Link>
      {actions && (
        <div>
          <ContactActions contact={b.contact} location={b.location} name={b.name} layout="compact" onAction={() => track('contact_click', 'business', b.id)} />
        </div>
      )}
    </article>
  );
}

/** The reference's "Top Picks" tile: a square photo with the name and area under it. */
export function BusinessPickTile({ business: b }) {
  return (
    <Link to={`/businesses/${b.slug}`} className="group flex w-[112px] flex-col gap-1.5 rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2">
      <BusinessPhoto business={b} size={112} className="h-[112px] w-[112px] shadow-sm transition-transform group-hover:scale-[1.02]" />
      <span className="line-clamp-2 text-[13px] font-semibold leading-tight text-heading">{b.name}</span>
      {b.area && <span className="-mt-1 truncate text-[12px] text-meta">{b.area}</span>}
    </Link>
  );
}

/** The reference's "Popular Brands" tile: a round photo with the name under it. */
export function BusinessRoundTile({ business: b }) {
  const what = useWhat(b);
  return (
    <Link to={`/businesses/${b.slug}`} className="group flex w-[84px] flex-col items-center gap-1.5 rounded-xl text-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2">
      <BusinessPhoto business={b} size={76} round className="h-[76px] w-[76px] ring-2 ring-white shadow-md transition-transform group-hover:scale-[1.04]" />
      <span className="line-clamp-2 text-[13px] font-semibold leading-tight text-heading">{b.name}</span>
      {what && <span className="-mt-1 line-clamp-1 text-[11px] text-meta">{what}</span>}
    </Link>
  );
}
