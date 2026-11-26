import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { HomeHeader } from '../../../components/ui/Header.jsx';
import { CategoryTile } from '../../../components/ui/CategoryTile.jsx';
import { SectionHeader } from '../../../components/ui/SectionHeader.jsx';
import { Skeleton, ListSkeleton } from '../../../components/ui/Skeleton.jsx';
import { ErrorState } from '../../../components/ui/ErrorState.jsx';
import { HOME_TILES } from '../../../config/navigation.js';
import { useLocationContext } from '../../../app/providers/LocationProvider.jsx';
import { BusinessCard } from '../../businesses/components/BusinessCard.jsx';
import { PostCard } from '../../community/components/PostCard.jsx';
import { useBusinessCategoryLink } from '../../categories/api.js';
import { HeroCarousel } from '../components/HeroCarousel.jsx';
import { HappeningSection, mixHappening } from '../components/HappeningSection.jsx';
import { ExploreSection } from '../components/ExploreSection.jsx';
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
 * Home screen, laid out like the home design (DOCS/refrence.jpeg): green app
 * bar, hero carousel overlapping it, category shortcuts, "What's Happening in
 * Tenali" and "Explore Tenali". Below them: Today in Tenali notices, nearby
 * businesses, popular restaurants, verified businesses and community posts.
 * Everything comes from GET /home (real data only); empty sections are hidden.
 * The shortcuts and Explore work even if the feed fails.
 */
export default function HomePage() {
  const { t } = useTranslation();
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
  const happening = useMemo(() => (d ? mixHappening(d) : []), [d]);
  // The hero overlaps the bottom of the green bar; without one, the bar is shorter.
  const hasHero = feed.isPending || (d?.banner?.length ?? 0) > 0;

  return (
    <>
      <HomeHeader overlap={hasHero} />
      {feed.isPending ? (
        <div className="relative z-10 mx-2.5 -mt-10" aria-busy="true" aria-label={t('common.loading')}>
          <Skeleton className="aspect-[2.6/1] max-h-[200px] min-h-[152px] w-full rounded-hero" />
        </div>
      ) : (
        <HeroCarousel items={d?.banner} />
      )}

      <section aria-label={t('home.categoriesLabel')} className="cat-grid mx-auto mt-6 w-full max-w-[40rem]">
        <ul>
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

      <div className="page-wide flex flex-col gap-8 pb-6 pt-8">
        {feed.isPending ? (
          <div className="page-pad flex flex-col gap-4">
            <ListSkeleton rows={2} />
          </div>
        ) : feed.isError ? (
          <div className="page-pad">
            <ErrorState error={feed.error} onRetry={() => feed.refetch()} />
          </div>
        ) : (
          <HappeningSection items={happening} />
        )}
        {/* Explore needs no data, so it is there while the feed loads or if it fails. */}
        <ExploreSection />
        {d && (
          <>
            <TodayInTenali today={d.today} />
            <FeedSection id="home-nearby" title={nearbyTitle} to="/businesses" items={d.nearby.items} render={(b) => <BusinessCard business={b} />} />
            <FeedSection id="home-food" title={t('home.foodTitle')} to="/food?sort=rating" items={d.food} render={(b) => <BusinessCard business={b} />} />
            <FeedSection id="home-featured" title={t('home.featuredTitle')} to="/businesses?isVerified=true" items={d.featured} render={(b) => <BusinessCard business={b} />} />
            <FeedSection id="home-community" title={t('home.communityTitle')} to="/community" items={d.community} render={(p) => <PostCard post={p} />} />
          </>
        )}
      </div>
    </>
  );
}
