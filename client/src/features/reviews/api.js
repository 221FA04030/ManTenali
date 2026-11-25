import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../../lib/apiClient.js';
import { useAuth } from '../auth/AuthContext.jsx';
import { businessKeys } from '../businesses/api.js';

export const reviewKeys = {
  all: ['reviews'],
  list: (businessId) => ['reviews', 'list', businessId],
  mineFor: (businessId) => ['reviews', 'mineFor', businessId],
  mine: ['reviews', 'mine'],
};

export const reviewsApi = {
  list: (businessId, query) => api.get(`/businesses/${businessId}/reviews`, { query }),
  mineFor: (businessId) => api.get(`/businesses/${businessId}/reviews/mine`).then((r) => r.data),
  mine: () => api.get('/reviews/mine').then((r) => r.data),
  create: (businessId, body) => api.post(`/businesses/${businessId}/reviews`, body).then((r) => r.data),
  update: (id, body) => api.patch(`/reviews/${id}`, body).then((r) => r.data),
  remove: (id) => api.delete(`/reviews/${id}`).then((r) => r.data),
};

export function useBusinessReviews(businessId) {
  return useInfiniteQuery({
    queryKey: reviewKeys.list(businessId),
    queryFn: ({ pageParam }) => reviewsApi.list(businessId, { page: pageParam, limit: 10 }),
    initialPageParam: 1,
    getNextPageParam: (last) => (last.meta && last.meta.page < last.meta.totalPages ? last.meta.page + 1 : undefined),
    enabled: Boolean(businessId),
  });
}

export function useMyReviewFor(businessId) {
  const { user } = useAuth();
  return useQuery({ queryKey: reviewKeys.mineFor(businessId), queryFn: () => reviewsApi.mineFor(businessId), enabled: Boolean(user && businessId) });
}

export const useMyReviews = () => useQuery({ queryKey: reviewKeys.mine, queryFn: reviewsApi.mine });

/** Any review write refreshes reviews and the business (its average rating changed). */
export function useReviewMutation(fn, options = {}) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: fn,
    ...options,
    onSuccess: async (data, vars, ctx) => {
      await Promise.all([qc.invalidateQueries({ queryKey: reviewKeys.all }), qc.invalidateQueries({ queryKey: businessKeys.all })]);
      options.onSuccess?.(data, vars, ctx);
    },
  });
}
