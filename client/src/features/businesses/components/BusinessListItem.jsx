import { Link } from 'react-router-dom';
import { BadgeCheck, MapPin, Star } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Badge, SampleBadge } from '../../../components/ui/Badge.jsx';
import { IconBubble } from '../../../components/ui/IconBubble.jsx';
import { ContactActions } from './ContactActions.jsx';
import { PriceRange, VegFriendlyBadge, useCuisineLabels } from '../../food/components/FoodBits.jsx';
import { categoryName } from '../../categories/api.js';
import { categoryIcon } from '../../../lib/categoryIcons.js';
import { cldUrl } from '../../../lib/cloudinary.js';
import { formatDistance } from '../../../lib/format.js';
import { track } from '../../../lib/analytics.js';
import { cn } from '../../../lib/cn.js';

/**
 * Business card for the inside pages (directory, food, search, saved). Built to
 * scan quickly: name first, then what and where, then rating / price / distance,
 * then small status badges, and the contact actions in one row. (Home keeps
 * its own BusinessCard.)
 */
export function BusinessListItem({ business: b }) {
  const { t, i18n } = useTranslation();
  const lang = i18n.language;
  const cuisineLabels = useCuisineLabels();
  const what = categoryName(b.subcategory ?? b.category, lang);
  const cuisines = b.food?.cuisines?.length ? cuisineLabels(b.food.cuisines) : '';
  const hasMeta = b.ratingCount > 0 || b.priceRange || b.distanceM !== undefined;

  return (
    <article className="flex h-full flex-col overflow-hidden rounded-2xl bg-white shadow-soft ring-1 ring-black/[0.04] transition-shadow hover:shadow-lift">
      <Link
        to={`/businesses/${b.slug}`}
        className="group flex flex-1 gap-3.5 p-3.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary"
      >
        {b.photo ? (
          <img
            src={cldUrl(b.photo.url, { w: 192, h: 192 })}
            alt=""
            width={96}
            height={96}
            loading="lazy"
            decoding="async"
            className="h-[84px] w-[84px] shrink-0 rounded-xl object-cover"
          />
        ) : (
          <IconBubble icon={categoryIcon(b.subcategory?.icon ?? b.category?.icon)} size="lg" className="h-[84px] w-[84px] rounded-xl" />
        )}
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <h3 className="line-clamp-2 text-[16px] font-semibold leading-snug text-heading group-hover:text-primary-dark">{b.name}</h3>
          {(what || b.area) && (
            <p className="flex min-w-0 items-center gap-1 text-[13px] text-meta">
              <span className="truncate">{[what, b.area].filter(Boolean).join(' • ')}</span>
            </p>
          )}
          {cuisines && <p className="truncate text-[13px] text-meta">{cuisines}</p>}
          {hasMeta && (
            <p className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[13px] text-label">
              {b.ratingCount > 0 && (
                <span className="inline-flex items-center gap-1 font-semibold">
                  <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" aria-hidden="true" />
                  {b.ratingAvg.toFixed(1)}
                  <span className="font-normal text-meta">({b.ratingCount})</span>
                </span>
              )}
              {b.priceRange && <PriceRange value={b.priceRange} className="text-[13px]" />}
              {b.distanceM !== undefined && (
                <span className="inline-flex items-center gap-1">
                  <MapPin className="h-3.5 w-3.5 text-primary" aria-hidden="true" />
                  {formatDistance(b.distanceM)}
                </span>
              )}
            </p>
          )}
          <div className="mt-auto flex flex-wrap gap-1.5 pt-1">
            {typeof b.isOpenNow === 'boolean' && (
              <Badge tone={b.isOpenNow ? 'green' : 'gray'} className="gap-1.5">
                <span aria-hidden="true" className={cn('h-1.5 w-1.5 rounded-full', b.isOpenNow ? 'bg-primary' : 'bg-gray-400')} />
                {t(b.isOpenNow ? 'business.openNow' : 'business.closedNow')}
              </Badge>
            )}
            {b.food?.isVegFriendly && <VegFriendlyBadge />}
            {b.isVerified && !b.isSeed && (
              <Badge tone="green" icon={BadgeCheck}>
                {t('badge.verified')}
              </Badge>
            )}
            {b.isSeed && <SampleBadge />}
          </div>
        </div>
      </Link>
      <div className="border-t border-black/[0.05] px-3.5 py-3">
        <ContactActions contact={b.contact} location={b.location} name={b.name} layout="tiles" onAction={() => track('contact_click', 'business', b.id)} />
      </div>
    </article>
  );
}
