import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../../lib/apiClient.js';

export const businessKeys = {
  all: ['businesses'],
  list: (params) => ['businesses', 'list', params],
  detail: (slug) => ['businesses', 'detail', slug],
  mine: ['businesses', 'mine'],
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
