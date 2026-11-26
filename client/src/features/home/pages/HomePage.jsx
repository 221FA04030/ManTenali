import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { HomeHeader } from '../../../components/ui/Header.jsx';
import { SearchBar } from '../../../components/ui/SearchBar.jsx';
import { CategoryTile } from '../../../components/ui/CategoryTile.jsx';
import { SectionHeader } from '../../../components/ui/SectionHeader.jsx';
import { Skeleton, ListSkeleton } from '../../../components/ui/Skeleton.jsx';
import { ErrorState } from '../../../components/ui/ErrorState.jsx';
import { HOME_TILES } from '../../../config/navigation.js';
import { useLocationContext } from '../../../app/providers/LocationProvider.jsx';
import { BusinessCard } from '../../businesses/components/BusinessCard.jsx';
import { OfferCard } from '../../offers/components/OfferCard.jsx';
import { EventCard } from '../../events/components/EventCard.jsx';
import { NewsCard } from '../../news/components/NewsCard.jsx';
import { PostCard } from '../../community/components/PostCard.jsx';
import { useBusinessCategoryLink } from '../../categories/api.js';
import { HomeBanner } from '../components/HomeBanner.jsx';
import { TodayInTenali } from '../components/TodayInTenali.jsx';
import { useHomeFeed } from '../api.js';

const NEAR_ME_KM = 10;

/** A titled list of cards; hidden when empty. */
function FeedSection({ id, title, to, items, render }) {
  if (!items?.length) return null;
  return (
    <section aria-labelledby={id} className="page-pad">
      <div id={id}>
        <SectionHeader title={title} to={to} />
      </div>
      <ul className="card-list">
        {items.map((item) => (
          <li key={item.id}>{render(item)}</li>
        ))}
      </ul>
    </section>
  );
}

/**
 * Home screen (spec section 11): header with search, category tiles, then the
 * GET /home feed - banner, Today in Tenali, nearby businesses, active offers,
 * popular food places, upcoming events, verified businesses, community posts
 * and latest news. Empty sections are hidden. Tiles and search work even if the feed fails.
 */
export default function HomePage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { area, coords } = useLocationContext();
  const params = useMemo(
    () => (coords ? { lat: coords.lat, lng: coords.lng, radiusKm: NEAR_ME_KM } : area ? { area } : {}),
    [coords, area],
  );
  const feed = useHomeFeed(params);
  const categoryLink = useBusinessCategoryLink();
  const d = feed.data;
  const nearbyTitle =
    d?.nearby.mode === 'near' ? t('home.nearbyTitle') : d?.nearby.mode === 'area' ? t('home.nearbyArea', { area: d.nearby.area }) : t('home.popularTitle');

  return (
    <>
      <HomeHeader>
        <SearchBar onSubmit={(q) => navigate(q ? `/search?q=${encodeURIComponent(q)}` : '/search')} />
      </HomeHeader>

      <section aria-label={t('home.categoriesLabel')} className="page-pad pt-2">
        <ul className="grid grid-cols-4 gap-2.5 sm:gap-3 md:grid-cols-6">
          {HOME_TILES.map((tile) => {
            const link = tile.categorySlug ? categoryLink(tile.categorySlug) : { to: tile.to };
            return (
              <li key={tile.key}>
                <CategoryTile icon={tile.icon} label={t(tile.labelKey)} to={link.to} comingSoon={tile.comingSoon || link.missing} />
              </li>
            );
          })}
        </ul>
      </section>

      <div className="page-wide flex flex-col gap-6 pb-6 pt-5">
        {feed.isPending ? (
          <div className="page-pad flex flex-col gap-4" aria-busy="true" aria-label={t('common.loading')}>
            <Skeleton className="h-[150px] w-full rounded-card" />
            <ListSkeleton rows={3} />
          </div>
        ) : feed.isError ? (
          <div className="page-pad">
            <ErrorState error={feed.error} onRetry={() => feed.refetch()} />
          </div>
        ) : (
          <>
            <HomeBanner items={d.banner} />
            <TodayInTenali today={d.today} />
            <FeedSection id="home-nearby" title={nearbyTitle} to="/businesses" items={d.nearby.items} render={(b) => <BusinessCard business={b} />} />
            <FeedSection id="home-offers" title={t('home.offersTitle')} to="/offers" items={d.offers} render={(o) => <OfferCard offer={o} />} />
            <FeedSection id="home-food" title={t('home.foodTitle')} to="/food?sort=rating" items={d.food} render={(b) => <BusinessCard business={b} />} />
            <FeedSection id="home-events" title={t('home.eventsTitle')} to="/events" items={d.events} render={(e) => <EventCard event={e} />} />
            <FeedSection id="home-featured" title={t('home.featuredTitle')} to="/businesses?isVerified=true" items={d.featured} render={(b) => <BusinessCard business={b} />} />
            <FeedSection id="home-community" title={t('home.communityTitle')} to="/community" items={d.community} render={(p) => <PostCard post={p} />} />
            <FeedSection id="home-news" title={t('home.newsTitle')} to="/news?type=news" items={d.news} render={(n) => <NewsCard item={n} />} />
          </>
        )}
      </div>
    </>
  );
}
