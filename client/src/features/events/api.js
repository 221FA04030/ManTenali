import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../../lib/apiClient.js';

export const eventKeys = {
  all: ['events'],
  list: (params) => ['events', 'list', params],
  detail: (slug) => ['events', 'detail', slug],
  mine: ['events', 'mine'],
  submission: (id) => ['events', 'submission', id],
  queue: (params) => ['events', 'queue', params],
  review: (id) => ['events', 'review', id],
  admin: (params) => ['events', 'admin', params],
};

export const eventsApi = {
  list: (query) => api.get('/events', { query }),
  detail: (slug) => api.get(`/events/${encodeURIComponent(slug)}`).then((r) => r.data),
  // submitters
  submit: (body) => api.post('/events/submissions', body).then((r) => r.data),
  mine: () => api.get('/events/submissions/mine').then((r) => r.data),
  submission: (id) => api.get(`/events/submissions/${id}`).then((r) => r.data),
  updateSubmission: (id, body) => api.patch(`/events/submissions/${id}`, body).then((r) => r.data),
  resubmit: (id) => api.post(`/events/submissions/${id}/resubmit`).then((r) => r.data),
  withdraw: (id) => api.post(`/events/submissions/${id}/withdraw`).then((r) => r.data),
  addEvidence: (id, item) => api.post(`/events/submissions/${id}/evidence`, item).then((r) => r.data),
  removeEvidence: (id, evidenceId) => api.delete(`/events/submissions/${id}/evidence/${evidenceId}`).then((r) => r.data),
  evidenceAccess: (id, evidenceId) => api.post(`/events/submissions/${id}/evidence/${evidenceId}/access`).then((r) => r.data),
  // admins
  queue: (query) => api.get('/admin/event-submissions', { query }),
  review: (id) => api.get(`/admin/event-submissions/${id}`).then((r) => r.data),
  approve: (id, body = {}) => api.post(`/admin/event-submissions/${id}/approve`, body).then((r) => r.data),
  reject: (id, reason) => api.post(`/admin/event-submissions/${id}/reject`, { reason }).then((r) => r.data),
  requestChanges: (id, note) => api.post(`/admin/event-submissions/${id}/request-changes`, { note }).then((r) => r.data),
  adminList: (query) => api.get('/admin/events', { query }),
  adminCreate: (body) => api.post('/events', body).then((r) => r.data),
  adminUpdate: (id, body) => api.patch(`/events/${id}`, body).then((r) => r.data),
  adminRemove: (id) => api.delete(`/events/${id}`).then((r) => r.data),
};

export function useEventsList(params) {
  return useInfiniteQuery({
    queryKey: eventKeys.list(params),
    queryFn: ({ pageParam }) => eventsApi.list({ ...params, page: pageParam, limit: 20 }),
    initialPageParam: 1,
    getNextPageParam: (last) => (last.meta && last.meta.page < last.meta.totalPages ? last.meta.page + 1 : undefined),
  });
}

export const useEvent = (slug) =>
  useQuery({ queryKey: eventKeys.detail(slug), queryFn: () => eventsApi.detail(slug), enabled: Boolean(slug) });
export const useMySubmissions = () => useQuery({ queryKey: eventKeys.mine, queryFn: eventsApi.mine });
export const useSubmission = (id) =>
  useQuery({ queryKey: eventKeys.submission(id), queryFn: () => eventsApi.submission(id), enabled: Boolean(id) });
export const useEventQueue = (params) =>
  useQuery({ queryKey: eventKeys.queue(params), queryFn: () => eventsApi.queue(params), placeholderData: (p) => p });
export const useEventReview = (id) =>
  useQuery({ queryKey: eventKeys.review(id), queryFn: () => eventsApi.review(id), enabled: Boolean(id) });
export const useAdminEvents = (params) =>
  useQuery({ queryKey: eventKeys.admin(params), queryFn: () => eventsApi.adminList(params), placeholderData: (p) => p });

/** Any events write refreshes every events query. */
export function useEventMutation(fn, options = {}) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: fn,
    ...options,
    onSuccess: async (data, vars, ctx) => {
      await qc.invalidateQueries({ queryKey: eventKeys.all });
      options.onSuccess?.(data, vars, ctx);
    },
  });
}

export const EVIDENCE_KINDS = ['document', 'poster', 'venue_confirmation', 'photo', 'organizer_card', 'other'];
export const MAX_EVIDENCE = 5;
export const STATUS_TONE = {
  draft: 'gray',
  pending_review: 'amber',
  changes_requested: 'blue',
  rejected: 'red',
  withdrawn: 'gray',
  published: 'green',
  cancelled: 'red',
  hidden: 'gray',
  archived: 'gray',
};
