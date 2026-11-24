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
const BusinessListPage = lazy(() => import('../features/businesses/pages/BusinessListPage.jsx'));
const BusinessDetailPage = lazy(() => import('../features/businesses/pages/BusinessDetailPage.jsx'));
const ManageHomePage = lazy(() => import('../features/manage/pages/ManageHomePage.jsx'));
const ManageBusinessPage = lazy(() => import('../features/manage/pages/ManageBusinessPage.jsx'));
const AdminHomePage = lazy(() => import('../features/admin/pages/AdminHomePage.jsx'));
const AdminBusinessesPage = lazy(() => import('../features/admin/pages/AdminBusinessesPage.jsx'));
const AdminBusinessFormPage = lazy(() => import('../features/admin/pages/AdminBusinessFormPage.jsx'));

const placeholder = (titleKey) => <PlaceholderPage titleKey={titleKey} />;
const ownerOrAdmin = (el) => <RequireAuth roles={['owner', 'admin']}>{el}</RequireAuth>;
const adminOnly = (el) => <RequireAuth roles={['admin']}>{el}</RequireAuth>;

/** Route table (spec section 10). Placeholders are replaced step by step. */
export const routes = [
  {
    element: <Layout />,
    children: [
      { index: true, element: <HomePage /> },
      { path: 'explore', element: <ExplorePage /> },
      { path: 'businesses', element: <BusinessListPage /> },
      { path: 'businesses/:slug', element: <BusinessDetailPage /> },
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
      { path: 'manage', element: ownerOrAdmin(<ManageHomePage />) },
      { path: 'manage/businesses/:slug', element: ownerOrAdmin(<ManageBusinessPage />) },
      { path: 'login', element: <LoginPage /> },
      { path: 'admin', element: adminOnly(<AdminHomePage />) },
      { path: 'admin/businesses', element: adminOnly(<AdminBusinessesPage />) },
      { path: 'admin/businesses/new', element: adminOnly(<AdminBusinessFormPage />) },
      { path: 'admin/businesses/:slug/edit', element: adminOnly(<AdminBusinessFormPage />) },
      { path: 'about', element: <AboutPage /> },
      { path: '*', element: <NotFoundPage /> },
    ],
  },
];
