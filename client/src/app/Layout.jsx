import { Suspense } from 'react';
import { Outlet, ScrollRestoration, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { BottomNav } from '../components/ui/BottomNav.jsx';
import { SideNav } from '../components/ui/SideNav.jsx';
import { useMediaQuery } from '../lib/useMediaQuery.js';
import { MenuDrawer } from '../components/ui/MenuDrawer.jsx';
import { ListSkeleton } from '../components/ui/Skeleton.jsx';
import { OfflineBanner } from '../components/ui/OfflineBanner.jsx';
import { ErrorBoundary } from './ErrorBoundary.jsx';
import { useEngagementTracking } from '../features/home/engagement/useFeatureEngagement.js';

function PageFallback() {
  return (
    <div className="p-4">
      <ListSkeleton rows={5} />
    </div>
  );
}

/** App frame: mobile-first column, drawer, always-visible bottom navigation. */
// Pages laid out flat on white, like the reference (Home, directory, food, offers, search).
const FLAT_PAGES = /^\/($|food|businesses|offers|search)/;

export function Layout() {
  const { t } = useTranslation();
  const location = useLocation();
  const flat = FLAT_PAGES.test(location.pathname);
  useEngagementTracking(); // personalised Home shortcuts: which features this person uses
  // Wide screens get the reference's left sidebar instead of the bottom bar.
  const desktop = useMediaQuery('(min-width: 1024px)');
  return (
    <div className={`${flat ? 'min-h-dvh bg-white' : 'min-h-dvh bg-mint-page'} ${desktop ? 'pl-64' : ''}`}>
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:left-2 focus:top-2 focus:z-[70] focus:rounded-lg focus:bg-white focus:px-3 focus:py-2"
      >
        {t('app.skipToContent')}
      </a>
      <div className={`mx-auto min-h-dvh max-w-app md:max-w-shell ${desktop ? 'pb-10' : 'pb-nav'} ${flat ? 'bg-white' : 'bg-mint-page'}`}>
        <main id="main">
          <ErrorBoundary resetKey={location.pathname}>
            <Suspense fallback={<PageFallback />}>
              <Outlet />
            </Suspense>
          </ErrorBoundary>
        </main>
      </div>
      <MenuDrawer />
      <OfflineBanner />
      {desktop ? <SideNav /> : <BottomNav />}
      {/* New pages open at the top; Back returns to where you were. */}
      <ScrollRestoration />
    </div>
  );
}
