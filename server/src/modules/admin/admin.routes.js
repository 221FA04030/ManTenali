import { Router } from 'express';
import { asyncHandler } from '../../common/utils/asyncHandler.js';
import { authenticate, authorize } from '../../common/middleware/authenticate.js';
import { validate } from '../../common/middleware/validate.js';
import { ROLES } from '../../config/constants.js';
import { adminListUsersQuery, adminUpdateUserSchema, idParams } from '../users/users.validation.js';
import {
  adminListQuery as businessListQuery,
  verifySchema,
  rejectSchema,
  submissionsQuery,
  idParams as businessIdParams,
} from '../businesses/businesses.validation.js';
import {
  queueQuery as eventQueueQuery,
  adminListQuery as eventListQuery,
  approveSchema as eventApproveSchema,
  rejectSchema as eventRejectSchema,
  requestChangesSchema as eventChangesSchema,
  idParams as eventIdParams,
} from '../events/events.validation.js';
import { adminListQuery as newsListQuery, idParams as newsIdParams } from '../news/news.validation.js';
import { adminListQuery as reportListQuery, actionSchema as reportActionSchema, idParams as reportIdParams } from '../reports/reports.validation.js';
import { summaryQuery as analyticsSummaryQuery } from '../analytics/analytics.validation.js';
import {
  listQuery as moderationListQuery,
  itemParams as moderationItemParams,
  archiveSchema,
  restoreSchema,
  deleteSchema,
  auditQuery,
} from '../moderation/moderation.validation.js';
import * as controller from './admin.controller.js';

/** Everything under /admin requires an authenticated admin. */
export function buildAdminRoutes() {
  const router = Router();
  router.use(authenticate, authorize(ROLES.ADMIN));

  router.get('/users', validate({ query: adminListUsersQuery }), asyncHandler(controller.listUsers));
  router.patch(
    '/users/:id',
    validate({ params: idParams, body: adminUpdateUserSchema }),
    asyncHandler(controller.updateUser),
  );

  router.get('/businesses', validate({ query: businessListQuery }), asyncHandler(controller.listBusinesses));
  router.patch(
    '/businesses/:id/verify',
    validate({ params: businessIdParams, body: verifySchema }),
    asyncHandler(controller.verifyBusiness),
  );

  // Business submission review (self-submitted listings)
  router.get('/submissions', validate({ query: submissionsQuery }), asyncHandler(controller.listSubmissions));
  router.get('/submissions/:id', validate({ params: businessIdParams }), asyncHandler(controller.getSubmission));
  router.post('/submissions/:id/approve', validate({ params: businessIdParams }), asyncHandler(controller.approveSubmission));
  router.post(
    '/submissions/:id/reject',
    validate({ params: businessIdParams, body: rejectSchema }),
    asyncHandler(controller.rejectSubmission),
  );

  // Events: moderation queue for community submissions + management list
  router.get('/event-submissions', validate({ query: eventQueueQuery }), asyncHandler(controller.eventQueue));
  router.get('/event-submissions/:id', validate({ params: eventIdParams }), asyncHandler(controller.eventForReview));
  router.post(
    '/event-submissions/:id/approve',
    validate({ params: eventIdParams, body: eventApproveSchema }),
    asyncHandler(controller.approveEvent),
  );
  router.post(
    '/event-submissions/:id/reject',
    validate({ params: eventIdParams, body: eventRejectSchema }),
    asyncHandler(controller.rejectEvent),
  );
  router.post(
    '/event-submissions/:id/request-changes',
    validate({ params: eventIdParams, body: eventChangesSchema }),
    asyncHandler(controller.requestEventChanges),
  );
  router.get('/events', validate({ query: eventListQuery }), asyncHandler(controller.listEvents));

  // News management list and editing view (writes go through /news)
  router.get('/news', validate({ query: newsListQuery }), asyncHandler(controller.listNews));
  router.get('/news/:id', validate({ params: newsIdParams }), asyncHandler(controller.getNews));

  // Reports queue (FR-ADM-1) and activity summary (FR-ADM-2). Screens come with Step 10.
  router.get('/reports', validate({ query: reportListQuery }), asyncHandler(controller.listReports));
  router.patch('/reports/:id', validate({ params: reportIdParams, body: reportActionSchema }), asyncHandler(controller.actOnReport));
  router.get('/analytics/summary', validate({ query: analyticsSummaryQuery }), asyncHandler(controller.analyticsSummary));

  // Content moderation (every kind of user content): archive, restore, delete permanently, audit log.
  // Admin-only like everything here: the role comes from the database on every request, never from the client.
  router.get('/moderation', validate({ query: moderationListQuery }), asyncHandler(controller.listModeration));
  router.get('/moderation/audit', validate({ query: auditQuery }), asyncHandler(controller.moderationAudit));
  router.get('/moderation/:type/:id', validate({ params: moderationItemParams }), asyncHandler(controller.getModeration));
  router.post(
    '/moderation/:type/:id/archive',
    validate({ params: moderationItemParams, body: archiveSchema }),
    asyncHandler(controller.archiveContent),
  );
  router.post(
    '/moderation/:type/:id/restore',
    validate({ params: moderationItemParams, body: restoreSchema }),
    asyncHandler(controller.restoreContent),
  );
  router.delete('/moderation/:type/:id', validate({ params: moderationItemParams, body: deleteSchema }), asyncHandler(controller.deleteContent));
  return router;
}
