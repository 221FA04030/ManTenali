import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { HomeHeader } from '../../../components/ui/Header.jsx';
import { CategoryTile } from '../../../components/ui/CategoryTile.jsx';
import { Section, Rail } from '../../../components/ui/Section.jsx';
import { Skeleton, ListSkeleton } from '../../../components/ui/Skeleton.jsx';
import { ErrorState } from '../../../components/ui/ErrorState.jsx';
import { HOME_TILES } from '../../../config/navigation.js';
import { useLocationContext } from '../../../app/providers/LocationProvider.jsx';
import { BusinessPickTile, BusinessRoundTile, BusinessRow } from '../../businesses/components/BusinessTiles.jsx';
import { PostCard } from '../../community/components/PostCard.jsx';
import { useBusinessCategoryLink } from '../../categories/api.js';
import { HeroCarousel } from '../components/HeroCarousel.jsx';
import { HappeningSection, mixHappening } from '../components/HappeningSection.jsx';
import { ExploreSection } from '../components/ExploreSection.jsx';
import { TodayInTenali } from '../components/TodayInTenali.jsx';
import { useHomeFeed } from '../api.js';
import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';

const NEAR_ME_KM = 10;

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

      <div className="page-wide mt-7 flex flex-col">
        {feed.isPending ? (
          <div className="page-pad flex flex-col gap-4">
            <ListSkeleton rows={2} />
          </div>
        ) : feed.isError ? (
          <div className="page-pad">
            <ErrorState error={feed.error} onRetry={() => feed.refetch()} />
          </div>
        ) : (
          happening.length > 0 && (
            <div className="border-t-8 border-gray-100 pb-5 pt-5">
              <HappeningSection items={happening} />
            </div>
          )
        )}
        {/* Explore needs no data, so it is there while the feed loads or if it fails. */}
        <div className="border-t-8 border-gray-100 pb-5 pt-5">
          <ExploreSection />
        </div>
        {d && (
          <>
            <div className="border-t-8 border-gray-100 pb-5 pt-5">
              <TodayInTenali today={d.today} />
            </div>

            {d.nearby?.items?.length > 0 && (
              <Section id="home-nearby" title={nearbyTitle} subtitle={t('home.nearbySubtitle')} to="/businesses">
                <ul className="divide-y divide-gray-100 px-4">
                  {d.nearby.items.map((b) => (
                    <li key={b.id}>
                      <BusinessRow business={b} />
                    </li>
                  ))}
                </ul>
                <div className="px-4 pb-2 pt-2">
                  <Link
                    to="/businesses"
                    className="flex min-h-[48px] w-full items-center justify-center gap-2 rounded-lg bg-primary text-[15px] font-bold text-white shadow-sm transition hover:bg-primary-dark active:scale-[0.99] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
                  >
                    {t('home.seeAllBusinesses')}
                    <ArrowRight className="h-4 w-4" aria-hidden="true" />
                  </Link>
                </div>
              </Section>
            )}

            {d.food?.length > 0 && (
              <Section id="home-food" title={t('home.foodTitle')} subtitle={t('home.foodSubtitle')} to="/food?sort=rating">
                <Rail label={t('home.foodTitle')}>
                  {d.food.map((b) => (
                    <li key={b.id} className="snap-start">
                      <BusinessPickTile business={b} />
                    </li>
                  ))}
                </Rail>
              </Section>
            )}

            {d.featured?.length > 0 && (
              <Section id="home-featured" title={t('home.featuredTitle')} subtitle={t('home.featuredSubtitle')} to="/businesses?isVerified=true">
                <Rail label={t('home.featuredTitle')}>
                  {d.featured.map((b) => (
                    <li key={b.id} className="snap-start">
                      <BusinessRoundTile business={b} />
                    </li>
                  ))}
                </Rail>
              </Section>
            )}

            {d.community?.length > 0 && (
              <Section id="home-community" title={t('home.communityTitle')} subtitle={t('home.communitySubtitle')} to="/community">
                <ul className="card-list px-4">
                  {d.community.map((p) => (
                    <li key={p.id}>
                      <PostCard post={p} />
                    </li>
                  ))}
                </ul>
              </Section>
            )}
          </>
        )}

        {/* Sign-off, as at the end of the reference home screen. */}
        <div className="border-t-8 border-gray-100 bg-gray-50 px-6 pb-8 pt-10">
          <p aria-hidden="true" className="text-[44px] font-extrabold uppercase leading-[0.95] tracking-tight text-gray-300 sm:text-[56px]">
            {t('app.name')
              .split(' ')
              .map((word) => (
                <span key={word} className="block">
                  {word}
                </span>
              ))}
          </p>
          <p className="mt-4 text-[13px] font-semibold uppercase tracking-wide text-gray-400">{t('app.tagline')}</p>
          <p className="mt-1 text-[12px] uppercase tracking-wide text-gray-400">{t('home.signoffMade')}</p>
        </div>
      </div>
    </>
  );
}
