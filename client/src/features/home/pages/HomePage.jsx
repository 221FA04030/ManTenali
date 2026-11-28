import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { HomeHeader } from '../../../components/ui/Header.jsx';
import { Section, Rail } from '../../../components/ui/Section.jsx';
import { ListSkeleton } from '../../../components/ui/Skeleton.jsx';
import { ErrorState } from '../../../components/ui/ErrorState.jsx';
import { useLocationContext } from '../../../app/providers/LocationProvider.jsx';
import { BusinessPickTile, BusinessRoundTile, BusinessRow } from '../../businesses/components/BusinessTiles.jsx';
import { HeroCarousel } from '../components/HeroCarousel.jsx';
import { TenaliBannerCarousel } from '../components/TenaliBannerCarousel.jsx';
import { HappeningSection, mixHappening } from '../components/HappeningSection.jsx';
import { PersonalizedFeatureGrid } from '../components/PersonalizedFeatureGrid.jsx';
import { CommunityPostsFeed } from '../components/CommunityPostsFeed.jsx';
import { TodayInTenali } from '../components/TodayInTenali.jsx';
import { useHomeFeed } from '../api.js';
import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';

const NEAR_ME_KM = 10;

/**
 * Home screen: light app bar, the Tenali banners, this person's 8 most used
 * features (+ More Features) and Community Posts (real photo posts drifting
 * slowly). Below them: highlights, What's Happening, Today in Tenali, nearby
 * businesses, popular restaurants and verified businesses, from GET /home
 * (real data only; empty sections are hidden). The shortcuts and Community
 * Posts work even if the Home feed fails.
 */
export default function HomePage() {
  const { t } = useTranslation();
  const { area, coords } = useLocationContext();
  const params = useMemo(
    () => (coords ? { lat: coords.lat, lng: coords.lng, radiusKm: NEAR_ME_KM } : area ? { area } : {}),
    [coords, area],
  );
  const feed = useHomeFeed(params);
  const d = feed.data;
  const nearbyTitle =
    d?.nearby.mode === 'near' ? t('home.nearbyTitle') : d?.nearby.mode === 'area' ? t('home.nearbyArea', { area: d.nearby.area }) : t('home.popularTitle');
  const happening = useMemo(() => (d ? mixHappening(d) : []), [d]);

  return (
    <>
      {/* The Tenali banners overlap the bottom of the app bar. */}
      <HomeHeader />
      <TenaliBannerCarousel />
      <PersonalizedFeatureGrid />

      <div className="page-wide mt-5 flex flex-col">
        {/* Community Posts has its own request, so it shows while the Home feed loads or if it fails. */}
        <CommunityPostsFeed />
        {d?.banner?.length > 0 && (
          <div className="border-t border-line pb-5 pt-5">
            <HeroCarousel items={d.banner} className="mt-0" />
          </div>
        )}
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
            <div className="border-t border-line pb-5 pt-5">
              <HappeningSection items={happening} />
            </div>
          )
        )}
        {d && (
          <>
            <div className="border-t border-line pb-5 pt-5">
              <TodayInTenali today={d.today} />
            </div>

            {d.nearby?.items?.length > 0 && (
              <Section band="line" id="home-nearby" title={nearbyTitle} subtitle={t('home.nearbySubtitle')} to="/businesses">
                <ul className="divide-y divide-line px-4">
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
              <Section band="line" id="home-food" title={t('home.foodTitle')} subtitle={t('home.foodSubtitle')} to="/food?sort=rating">
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
              <Section band="line" id="home-featured" title={t('home.featuredTitle')} subtitle={t('home.featuredSubtitle')} to="/businesses?isVerified=true">
                <Rail label={t('home.featuredTitle')}>
                  {d.featured.map((b) => (
                    <li key={b.id} className="snap-start">
                      <BusinessRoundTile business={b} />
                    </li>
                  ))}
                </Rail>
              </Section>
            )}

          </>
        )}

        {/* Sign-off, as at the end of the reference home screen. */}
        <div className="border-t border-line bg-surface-soft px-6 pb-8 pt-10">
          <p aria-hidden="true" className="text-[44px] font-extrabold uppercase leading-[0.95] tracking-tight text-[#CFE3D5] sm:text-[56px]">
            {t('app.name')
              .split(' ')
              .map((word) => (
                <span key={word} className="block">
                  {word}
                </span>
              ))}
          </p>
          <p className="mt-4 text-[13px] font-semibold uppercase tracking-wide text-meta">{t('app.tagline')}</p>
          <p className="mt-1 text-[12px] uppercase tracking-wide text-meta">{t('home.signoffMade')}</p>
        </div>
      </div>
    </>
  );
}
