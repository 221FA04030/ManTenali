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
const AddBusinessPage = lazy(() => import('../features/manage/pages/AddBusinessPage.jsx'));
const AdminSubmissionsPage = lazy(() => import('../features/admin/pages/AdminSubmissionsPage.jsx'));
const AdminSubmissionDetailPage = lazy(() => import('../features/admin/pages/AdminSubmissionDetailPage.jsx'));
const AdminCategoriesPage = lazy(() => import('../features/admin/pages/AdminCategoriesPage.jsx'));
const FoodListPage = lazy(() => import('../features/food/pages/FoodListPage.jsx'));
const OffersFeedPage = lazy(() => import('../features/offers/pages/OffersFeedPage.jsx'));
const OfferDetailPage = lazy(() => import('../features/offers/pages/OfferDetailPage.jsx'));
const ManageOffersPage = lazy(() => import('../features/offers/pages/ManageOffersPage.jsx'));
const OfferEditorPage = lazy(() => import('../features/offers/pages/OfferEditorPage.jsx'));

const placeholder = (titleKey) => <PlaceholderPage titleKey={titleKey} />;
const signedIn = (el) => <RequireAuth>{el}</RequireAuth>;
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
      { path: 'food', element: <FoodListPage /> },
      { path: 'offers', element: <OffersFeedPage /> },
      { path: 'offers/:id', element: <OfferDetailPage /> },
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
      { path: 'manage', element: signedIn(<ManageHomePage />) },
      { path: 'manage/new', element: signedIn(<AddBusinessPage />) },
      { path: 'manage/businesses/:id', element: signedIn(<ManageBusinessPage />) },
      // Offers management: owners (own businesses) and admins (any); the server enforces ownership.
      { path: 'manage/businesses/:businessId/offers', element: ownerOrAdmin(<ManageOffersPage />) },
      { path: 'manage/businesses/:businessId/offers/new', element: ownerOrAdmin(<OfferEditorPage />) },
      { path: 'manage/offers/:offerId/edit', element: ownerOrAdmin(<OfferEditorPage />) },
      { path: 'login', element: <LoginPage /> },
      { path: 'admin', element: adminOnly(<AdminHomePage />) },
      { path: 'admin/businesses', element: adminOnly(<AdminBusinessesPage />) },
      { path: 'admin/businesses/new', element: adminOnly(<AdminBusinessFormPage />) },
      { path: 'admin/businesses/:slug/edit', element: adminOnly(<AdminBusinessFormPage />) },
      { path: 'admin/submissions', element: adminOnly(<AdminSubmissionsPage />) },
      { path: 'admin/submissions/:id', element: adminOnly(<AdminSubmissionDetailPage />) },
      { path: 'admin/categories', element: adminOnly(<AdminCategoriesPage />) },
      { path: 'about', element: <AboutPage /> },
      { path: '*', element: <NotFoundPage /> },
    ],
  },
];
