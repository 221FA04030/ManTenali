import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../../lib/apiClient.js';

export const businessKeys = {
  all: ['businesses'],
  list: (params) => ['businesses', 'list', params],
  detail: (slug) => ['businesses', 'detail', slug],
  mine: ['businesses', 'mine'],
  mineOne: (id) => ['businesses', 'mine', id],
  submissions: (params) => ['businesses', 'submissions', params],
  submission: (id) => ['businesses', 'submission', id],
  admin: (params) => ['businesses', 'admin', params],
};

export const businessesApi = {
  list: (query) => api.get('/businesses', { query }),
  detail: (slug) => api.get(`/businesses/${encodeURIComponent(slug)}`).then((r) => r.data),
  mine: () => api.get('/businesses/mine').then((r) => r.data),
  create: (body) => api.post('/businesses', body).then((r) => r.data),
  update: (id, body) => api.patch(`/businesses/${id}`, body).then((r) => r.data),
  archive: (id) => api.delete(`/businesses/${id}`).then((r) => r.data),
  adminList: (query) => api.get('/admin/businesses', { query }),
  verify: (id, isVerified) => api.patch(`/admin/businesses/${id}/verify`, { isVerified }).then((r) => r.data),
  // self-submission
  getMine: (id) => api.get(`/businesses/mine/${id}`).then((r) => r.data),
  submit: (body) => api.post('/businesses/submissions', body).then((r) => r.data),
  submitForReview: (id) => api.post(`/businesses/${id}/submit`).then((r) => r.data),
  // admin review
  submissions: (query) => api.get('/admin/submissions', { query }),
  submission: (id) => api.get(`/admin/submissions/${id}`).then((r) => r.data),
  approve: (id) => api.post(`/admin/submissions/${id}/approve`).then((r) => r.data),
  reject: (id, reason) => api.post(`/admin/submissions/${id}/reject`, { reason }).then((r) => r.data),
};

/** Public list with "load more" pagination (FR-BUS-1/2). */
export function useBusinessList(params) {
  return useInfiniteQuery({
    queryKey: businessKeys.list(params),
    queryFn: ({ pageParam }) => businessesApi.list({ ...params, page: pageParam, limit: 20 }),
    initialPageParam: 1,
    getNextPageParam: (last) => (last.meta && last.meta.page < last.meta.totalPages ? last.meta.page + 1 : undefined),
  });
}

export function useBusiness(slug) {
  return useQuery({ queryKey: businessKeys.detail(slug), queryFn: () => businessesApi.detail(slug), enabled: Boolean(slug) });
}

export function useMyBusinesses() {
  return useQuery({ queryKey: businessKeys.mine, queryFn: businessesApi.mine });
}

export function useMyBusiness(id) {
  return useQuery({ queryKey: businessKeys.mineOne(id), queryFn: () => businessesApi.getMine(id), enabled: Boolean(id) });
}

export function useSubmissions(params) {
  return useQuery({
    queryKey: businessKeys.submissions(params),
    queryFn: () => businessesApi.submissions(params),
    placeholderData: (prev) => prev,
  });
}

export function useSubmission(id) {
  return useQuery({ queryKey: businessKeys.submission(id), queryFn: () => businessesApi.submission(id), enabled: Boolean(id) });
}

/** Status shown to owners: "published" reads as "Approved". */
export const OWNER_STATUS_KEY = {
  draft: 'status.draft',
  pending: 'status.pending',
  published: 'status.approved',
  rejected: 'status.rejected',
  hidden: 'status.hidden',
  archived: 'status.archived',
};
export const STATUS_TONE = { draft: 'gray', pending: 'amber', published: 'green', rejected: 'red', hidden: 'gray', archived: 'red' };

export function useAdminBusinesses(params) {
  return useQuery({
    queryKey: businessKeys.admin(params),
    queryFn: () => businessesApi.adminList(params),
    placeholderData: (prev) => prev,
  });
}

/** Any write invalidates every business query so lists and details refresh. */
export function useBusinessMutation(fn, options = {}) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: fn,
    ...options,
    onSuccess: async (data, vars, ctx) => {
      await qc.invalidateQueries({ queryKey: businessKeys.all });
      options.onSuccess?.(data, vars, ctx);
    },
  });
}

export const KINDS = ['shop', 'food', 'service'];
