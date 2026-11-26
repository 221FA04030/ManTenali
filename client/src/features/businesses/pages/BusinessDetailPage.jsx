import { Link, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../auth/AuthContext.jsx';
import { BookOpen, Clock, Globe, ImagePlus, Mail, MapPin, MessageSquarePlus, Pencil, Star, Store } from 'lucide-react';
import { PageHeader } from '../../../components/ui/Header.jsx';
import { Card } from '../../../components/ui/Card.jsx';
import { Badge, TrustBadge } from '../../../components/ui/Badge.jsx';
import { Skeleton, ListSkeleton } from '../../../components/ui/Skeleton.jsx';
import { ErrorState } from '../../../components/ui/ErrorState.jsx';
import { EmptyState } from '../../../components/ui/EmptyState.jsx';
import { IconBubble } from '../../../components/ui/IconBubble.jsx';
import { categoryIcon } from '../../../lib/categoryIcons.js';
import { ContactActions } from '../components/ContactActions.jsx';
import { HoursTable } from '../components/HoursTable.jsx';
import { MenuView } from '../../food/components/MenuView.jsx';
import { BusinessOffersSection } from '../../offers/components/BusinessOffersSection.jsx';
import { PriceRange, VegFriendlyBadge } from '../../food/components/FoodBits.jsx';
import { useBusiness } from '../api.js';
import { categoryName } from '../../categories/api.js';
import { cldUrl } from '../../../lib/cloudinary.js';
import { formatDateTime, formatRelative } from '../../../lib/format.js';
import { LocationMap } from '../../../components/ui/LocationMap.jsx';
import { track, useTrackOnce } from '../../../lib/analytics.js';
import { ItemActions } from '../../engagement/ItemActions.jsx';
import { ReviewsSection } from '../../reviews/components/ReviewsSection.jsx';

/**
 * Shown instead of the gallery when a listing has no photos yet: the category
 * icon on a plain brand background (never a stock photo standing in for the
 * real place). Owners and admins get a prompt to add photos.
 */
function NoPhotosCover({ icon, manageTo }) {
  const { t } = useTranslation();
  return (
    <div className="flex aspect-[21/9] w-full flex-col items-center justify-center gap-2 rounded-card bg-gradient-to-br from-brand-100 to-brand-50 ring-1 ring-brand-100">
      <IconBubble icon={icon} size="lg" />
      <p className="text-sm font-medium text-ink-muted">{t('business.noPhotos')}</p>
      {manageTo && (
        <Link to={manageTo} className="inline-flex min-h-tap items-center gap-1.5 rounded-full bg-white px-4 text-sm font-semibold text-brand-800 ring-1 ring-brand-200 hover:bg-brand-50">
          <ImagePlus className="h-4 w-4" aria-hidden="true" /> {t('business.addPhotos')}
        </Link>
      )}
    </div>
  );
}

function Gallery({ photos, name }) {
  if (!photos?.length) return null;
  return (
    <div className="no-scrollbar -mx-4 flex snap-x snap-mandatory gap-2 overflow-x-auto px-4" aria-label={name}>
      {photos.map((p, i) => (
        <img
          key={p.publicId}
          src={cldUrl(p.url, { w: 720, h: 405 })}
          alt={`${name} - ${i + 1}`}
          loading={i === 0 ? 'eager' : 'lazy'}
          className="aspect-video w-[88%] shrink-0 snap-center rounded-card object-cover shadow-card sm:w-[70%]"
        />
      ))}
    </div>
  );
}

/** /businesses/:slug - full business detail (FR-BUS-3, FR-UX-1). */
export default function BusinessDetailPage() {
  const { slug } = useParams();
  const { t, i18n } = useTranslation();
  const lang = i18n.language;
  const { data: b, isPending, isError, error, refetch } = useBusiness(slug);
  const { user } = useAuth();
  // Count public views only (not owner or admin previews of an unpublished listing).
  const isPublic = Boolean(b) && (!b.status || b.status === 'published');
  useTrackOnce('view', 'business', isPublic ? b.id : undefined);

  if (isPending) {
    return (
      <>
        <PageHeader title={t('pages.businesses')} />
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
        <PageHeader title={t('pages.businesses')} />
        <div className="p-4">
          {error?.status === 404 ? (
            <EmptyState icon={Store} title={t('business.notFound')} body={t('states.notFoundBody')} />
          ) : (
            <ErrorState error={error} onRetry={refetch} />
          )}
        </div>
      </>
    );
  }

  return (
    <>
      <PageHeader
        title={b.name}
        actions={
          b.canManage && (
            <Link
              to={user?.role === 'admin' ? `/admin/businesses/${b.slug}/edit` : `/manage/businesses/${b.id}`}
              aria-label={t('business.edit')}
              className="flex min-h-tap min-w-tap items-center justify-center rounded-full text-white hover:bg-white/15"
            >
              <Pencil className="h-5 w-5" aria-hidden="true" />
            </Link>
          )
        }
      />
      <div className="flex flex-col gap-4 p-4">
        {b.photos?.length ? (
          <Gallery photos={b.photos} name={b.name} />
        ) : (
          <NoPhotosCover
            icon={categoryIcon(b.subcategory?.icon ?? b.category?.icon)}
            manageTo={b.canManage ? (user?.role === 'admin' ? `/admin/businesses/${b.slug}/edit` : `/manage/businesses/${b.id}`) : null}
          />
        )}

        <Card className="flex flex-col gap-2">
          <div className="flex flex-wrap items-center gap-1.5">
            <TrustBadge isVerified={b.isVerified} isSeed={b.isSeed} />
            {b.isOpenNow === true && <Badge tone="green">{t('business.openNow')}</Badge>}
            {b.isOpenNow === false && <Badge tone="gray">{t('business.closedNow')}</Badge>}
            {b.status && b.status !== 'published' && <Badge tone="amber">{t(`status.${b.status}`)}</Badge>}
          </div>
          <h2 className="text-xl font-bold leading-snug">{b.name}</h2>
          <p className="text-sm text-ink-muted">
            {[categoryName(b.category, lang), categoryName(b.subcategory, lang)].filter(Boolean).join(' › ')}
          </p>
          {b.ratingCount > 0 && (
            <p className="inline-flex items-center gap-1 text-sm">
              <Star className="h-4 w-4 fill-amber-400 text-amber-400" aria-hidden="true" />
              <span className="font-semibold">{b.ratingAvg.toFixed(1)}</span>
              <span className="text-ink-muted">({t('business.ratings', { count: b.ratingCount })})</span>
            </p>
          )}
          <div className="mt-1">
            <ContactActions contact={b.contact} location={b.location} name={b.name} onAction={() => isPublic && track('contact_click', 'business', b.id)} />
          </div>
          <p className="text-xs text-ink-soft">
            {t('common.updated', { time: formatRelative(b.updatedAt, lang) })}
            {b.isVerified && b.verifiedAt && ` • ${t('business.verifiedOn', { date: formatDateTime(b.verifiedAt, lang) })}`}
          </p>
        </Card>

        {isPublic && <ItemActions targetType="business" targetId={b.id} title={b.name} />}
        {isPublic && (
          <Link
            to={`/community/new?business=${encodeURIComponent(b.slug)}`}
            className="flex min-h-tap items-center justify-center gap-2 rounded-full bg-brand-50 px-4 text-sm font-semibold text-brand-800 ring-1 ring-brand-200 hover:bg-brand-100"
          >
            <MessageSquarePlus className="h-4 w-4" aria-hidden="true" /> {t('business.recommend')}
          </Link>
        )}

        <BusinessOffersSection businessId={b.id} canManage={b.canManage && b.status === 'published'} />

        {b.food && (
          <Card className="flex flex-col gap-3">
            <div className="flex flex-wrap items-center gap-2">
              {b.priceRange && (
                <span className="rounded-full bg-brand-50 px-3 py-1 text-sm">
                  <PriceRange value={b.priceRange} /> <span className="text-ink-muted">{t(`food.price.${b.priceRange}`)}</span>
                </span>
              )}
              {b.food.isVegFriendly && <VegFriendlyBadge />}
            </div>
            {b.food.cuisines.length > 0 && (
              <ul className="flex flex-wrap gap-1.5" aria-label={t('food.cuisine')}>
                {b.food.cuisines.map((c) => (
                  <li key={c}>
                    <Badge tone="gray">{t(`cuisines.${c}`)}</Badge>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        )}

        {b.food && (
          <Card>
            <h2 className="mb-3 flex items-center gap-2 text-base font-bold">
              <BookOpen className="h-5 w-5 text-brand-700" aria-hidden="true" />
              {t('food.menu')}
            </h2>
            <MenuView menu={b.food.menu} />
          </Card>
        )}

        {b.description && (
          <Card>
            <h2 className="mb-2 text-base font-bold">{t('business.about')}</h2>
            <p className="whitespace-pre-line text-[15px] leading-relaxed text-ink-muted">{b.description}</p>
            {b.tags.length > 0 && (
              <ul className="mt-3 flex flex-wrap gap-1.5">
                {b.tags.map((tag) => (
                  <li key={tag}>
                    <Badge tone="gray">{tag}</Badge>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        )}

        <Card>
          <h2 className="mb-2 flex items-center gap-2 text-base font-bold">
            <MapPin className="h-5 w-5 text-brand-700" aria-hidden="true" />
            {t('business.address')}
          </h2>
          <p className="text-[15px]">{b.address.line}</p>
          <p className="text-sm text-ink-muted">
            {[b.address.area, 'Tenali', b.address.pincode].filter(Boolean).join(', ')}
          </p>
          {b.location && (
            <div className="mt-3">
              <LocationMap location={b.location} label={b.name} />
            </div>
          )}
          {(b.contact.email || b.contact.website) && (
            <div className="mt-2 flex flex-col gap-1 border-t border-brand-50 pt-2 text-sm">
              {b.contact.email && (
                <a href={`mailto:${b.contact.email}`} className="inline-flex min-h-tap items-center gap-2 text-brand-800">
                  <Mail className="h-4 w-4" aria-hidden="true" /> {b.contact.email}
                </a>
              )}
              {b.contact.website && (
                <a href={b.contact.website} target="_blank" rel="noopener noreferrer nofollow" className="inline-flex min-h-tap items-center gap-2 text-brand-800">
                  <Globe className="h-4 w-4" aria-hidden="true" /> {b.contact.website.replace(/^https?:\/\//, '')}
                </a>
              )}
            </div>
          )}
        </Card>

        <Card>
          <h2 className="mb-2 flex items-center gap-2 text-base font-bold">
            <Clock className="h-5 w-5 text-brand-700" aria-hidden="true" />
            {t('business.hours')}
          </h2>
          <HoursTable hours={b.openingHours} />
        </Card>

        {isPublic && <ReviewsSection business={b} />}
      </div>
    </>
  );
}
