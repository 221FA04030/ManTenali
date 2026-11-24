import { lazy } from 'react';
import { Layout } from './Layout.jsx';
import { RequireAuth } from '../features/auth/components/RequireAuth.jsx';

// Route-level code splitting (spec NFR: Vite code splitting per route).
const HomePage = lazy(() => import('../features/home/pages/HomePage.jsx'));
const ExplorePage = lazy(() => import('../features/explore/pages/ExplorePage.jsx'));
const AboutPage = lazy(() => import('../features/static/pages/AboutPage.jsx'));
const NotFoundPage = lazy(() => import('../features/static/pages/NotFoundPage.jsx'));
const PlaceholderPage = lazy(() => import('../features/static/pages/PlaceholderPage.jsx'));
const LoginPage = lazy(() => import('../features/auth/pages/LoginPage.jsx'));
const ProfilePage = lazy(() => import('../features/profile/pages/ProfilePage.jsx'));

const placeholder = (titleKey) => <PlaceholderPage titleKey={titleKey} />;

/** Route table (spec section 10). Placeholders are replaced step by step. */
export const routes = [
  {
    element: <Layout />,
    children: [
      { index: true, element: <HomePage /> },
      { path: 'explore', element: <ExplorePage /> },
      { path: 'businesses', element: placeholder('pages.businesses') },
      { path: 'businesses/:slug', element: placeholder('pages.businesses') },
      { path: 'food', element: placeholder('pages.food') },
      { path: 'offers', element: placeholder('pages.offers') },
      { path: 'offers/:id', element: placeholder('pages.offers') },
      { path: 'events', element: placeholder('pages.events') },
      { path: 'events/:slug', element: placeholder('pages.events') },
      { path: 'news', element: placeholder('pages.news') },
      { path: 'news/:slug', element: placeholder('pages.news') },
      { path: 'search', element: placeholder('pages.search') },
      { path: 'saved', element: placeholder('pages.saved') },
      { path: 'suggest', element: placeholder('pages.suggest') },
      {
        path: 'profile',
        element: (
          <RequireAuth>
            <ProfilePage />
          </RequireAuth>
        ),
      },
      {
        path: 'profile/reviews',
        element: <RequireAuth>{placeholder('profile.myReviews')}</RequireAuth>,
      },
      {
        path: 'manage/*',
        element: <RequireAuth roles={['owner', 'admin']}>{placeholder('profile.myBusinesses')}</RequireAuth>,
      },
      { path: 'login', element: <LoginPage /> },
      {
        path: 'admin/*',
        element: <RequireAuth roles={['admin']}>{placeholder('pages.admin')}</RequireAuth>,
      },
      { path: 'about', element: <AboutPage /> },
      { path: '*', element: <NotFoundPage /> },
    ],
  },
];
