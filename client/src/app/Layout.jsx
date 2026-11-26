import { Suspense } from 'react';
import { Outlet, ScrollRestoration, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { BottomNav } from '../components/ui/BottomNav.jsx';
import { MenuDrawer } from '../components/ui/MenuDrawer.jsx';
import { ListSkeleton } from '../components/ui/Skeleton.jsx';
import { OfflineBanner } from '../components/ui/OfflineBanner.jsx';
import { ErrorBoundary } from './ErrorBoundary.jsx';

function PageFallback() {
  return (
    <div className="p-4">
      <ListSkeleton rows={5} />
    </div>
  );
}

/** App frame: mobile-first column, drawer, always-visible bottom navigation. */
export function Layout() {
  const { t } = useTranslation();
  const location = useLocation();
  return (
    <div className="min-h-dvh bg-mint-page">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:left-2 focus:top-2 focus:z-[70] focus:rounded-lg focus:bg-white focus:px-3 focus:py-2"
      >
        {t('app.skipToContent')}
      </a>
      <div className="mx-auto min-h-dvh max-w-app bg-mint-page pb-nav md:max-w-shell">
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
      <BottomNav />
      {/* New pages open at the top; Back returns to where you were. */}
      <ScrollRestoration />
    </div>
  );
}
