import { lazy } from 'react';
import { Navigate } from 'react-router-dom';
import { Layout } from './Layout.jsx';
import { RequireAuth } from '../features/auth/components/RequireAuth.jsx';

// Route-level code splitting (spec NFR: Vite code splitting per route).
const HomePage = lazy(() => import('../features/home/pages/HomePage.jsx'));
const ExplorePage = lazy(() => import('../features/explore/pages/ExplorePage.jsx'));
const AboutPage = lazy(() => import('../features/static/pages/AboutPage.jsx'));
const NotFoundPage = lazy(() => import('../features/static/pages/NotFoundPage.jsx'));
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
const EventsListPage = lazy(() => import('../features/events/pages/EventsListPage.jsx'));
const EventDetailPage = lazy(() => import('../features/events/pages/EventDetailPage.jsx'));
const SubmitEventPage = lazy(() => import('../features/events/pages/SubmitEventPage.jsx'));
const MySubmissionsPage = lazy(() => import('../features/events/pages/MySubmissionsPage.jsx'));
const SubmissionPage = lazy(() => import('../features/events/pages/SubmissionPage.jsx'));
const AdminEventSubmissionsPage = lazy(() => import('../features/admin/pages/AdminEventSubmissionsPage.jsx'));
const AdminEventReviewPage = lazy(() => import('../features/admin/pages/AdminEventReviewPage.jsx'));
const AdminEventsPage = lazy(() => import('../features/admin/pages/AdminEventsPage.jsx'));
const AdminEventFormPage = lazy(() => import('../features/admin/pages/AdminEventFormPage.jsx'));
const NewsListPage = lazy(() => import('../features/news/pages/NewsListPage.jsx'));
const NewsDetailPage = lazy(() => import('../features/news/pages/NewsDetailPage.jsx'));
const AdminNewsPage = lazy(() => import('../features/admin/pages/AdminNewsPage.jsx'));
const AdminNewsFormPage = lazy(() => import('../features/admin/pages/AdminNewsFormPage.jsx'));
const AdminNewsImportsPage = lazy(() => import('../features/admin/pages/AdminNewsImportsPage.jsx'));
const SearchPage = lazy(() => import('../features/search/pages/SearchPage.jsx'));
const CommunityPage = lazy(() => import('../features/community/pages/CommunityPage.jsx'));
const PostDetailPage = lazy(() => import('../features/community/pages/PostDetailPage.jsx'));
const PostEditorPage = lazy(() => import('../features/community/pages/PostEditorPage.jsx'));
const SavedPage = lazy(() => import('../features/favorites/pages/SavedPage.jsx'));
const SuggestPage = lazy(() => import('../features/reports/pages/SuggestPage.jsx'));
const MyReviewsPage = lazy(() => import('../features/reviews/pages/MyReviewsPage.jsx'));
const AdminReportsPage = lazy(() => import('../features/admin/pages/AdminReportsPage.jsx'));
const AdminUsersPage = lazy(() => import('../features/admin/pages/AdminUsersPage.jsx'));
const AdminMetricsPage = lazy(() => import('../features/admin/pages/AdminMetricsPage.jsx'));
const AdminModerationPage = lazy(() => import('../features/admin/pages/AdminModerationPage.jsx'));

const signedIn = (el) => <RequireAuth>{el}</RequireAuth>;
const ownerOrAdmin = (el) => <RequireAuth roles={['owner', 'admin']}>{el}</RequireAuth>;
const adminOnly = (el) => <RequireAuth roles={['admin']}>{el}</RequireAuth>;

/** Route table (spec section 10). Placeholders are replaced step by step. */
export const routes = [
  {
    element: <Layout />,
    children: [
      { index: true, element: <HomePage /> },
      { path: 'discover', element: <ExplorePage /> },
      { path: 'explore', element: <Navigate to="/discover" replace /> }, // old address
      { path: 'businesses', element: <BusinessListPage /> },
      { path: 'businesses/:slug', element: <BusinessDetailPage /> },
      { path: 'food', element: <FoodListPage /> },
      { path: 'offers', element: <OffersFeedPage /> },
      { path: 'offers/:id', element: <OfferDetailPage /> },
      { path: 'events', element: <EventsListPage /> },
      { path: 'events/submit', element: signedIn(<SubmitEventPage />) },
      { path: 'events/submissions', element: signedIn(<MySubmissionsPage />) },
      { path: 'events/submissions/:id', element: signedIn(<SubmissionPage />) },
      { path: 'events/:slug', element: <EventDetailPage /> },
      { path: 'news', element: <NewsListPage /> },
      { path: 'news/:slug', element: <NewsDetailPage /> },
      { path: 'community', element: <CommunityPage /> },
      { path: 'community/new', element: signedIn(<PostEditorPage />) },
      { path: 'community/:id/edit', element: signedIn(<PostEditorPage />) },
      { path: 'community/:id', element: <PostDetailPage /> },
      { path: 'search', element: <SearchPage /> },
      { path: 'saved', element: signedIn(<SavedPage />) },
      { path: 'suggest', element: <SuggestPage /> },
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
        element: <RequireAuth><MyReviewsPage /></RequireAuth>,
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
      { path: 'admin/event-submissions', element: adminOnly(<AdminEventSubmissionsPage />) },
      { path: 'admin/event-submissions/:id', element: adminOnly(<AdminEventReviewPage />) },
      { path: 'admin/events', element: adminOnly(<AdminEventsPage />) },
      { path: 'admin/events/new', element: adminOnly(<AdminEventFormPage />) },
      { path: 'admin/events/:id/edit', element: adminOnly(<AdminEventFormPage />) },
      { path: 'admin/news', element: adminOnly(<AdminNewsPage />) },
      { path: 'admin/reports', element: adminOnly(<AdminReportsPage />) },
      { path: 'admin/moderation', element: adminOnly(<AdminModerationPage />) },
      { path: 'admin/users', element: adminOnly(<AdminUsersPage />) },
      { path: 'admin/metrics', element: adminOnly(<AdminMetricsPage />) },
      { path: 'admin/news/new', element: adminOnly(<AdminNewsFormPage />) },
      { path: 'admin/news/imports', element: adminOnly(<AdminNewsImportsPage />) },
      { path: 'admin/news/:id/edit', element: adminOnly(<AdminNewsFormPage />) },
      { path: 'about', element: <AboutPage /> },
      { path: '*', element: <NotFoundPage /> },
    ],
  },
];
