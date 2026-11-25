import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../../lib/apiClient.js';

export const offerKeys = {
  all: ['offers'],
  feed: (params) => ['offers', 'feed', params],
  detail: (id) => ['offers', 'detail', id],
  business: (businessId, limit) => ['offers', 'business', businessId, limit],
  manage: (businessId) => ['offers', 'manage', businessId],
};

export const offersApi = {
  list: (query) => api.get('/offers', { query }),
  detail: (id) => api.get(`/offers/${id}`).then((r) => r.data),
  forBusiness: (businessId, limit) => api.get(`/businesses/${businessId}/offers`, { query: { limit } }),
  manage: (businessId) => api.get('/offers/mine', { query: { businessId } }).then((r) => r.data),
  create: (body) => api.post('/offers', body).then((r) => r.data),
  update: (id, body) => api.patch(`/offers/${id}`, body).then((r) => r.data),
  hide: (id) => api.delete(`/offers/${id}`).then((r) => r.data),
};

/** Public feed with "load more" (FR-OFF-1). */
export function useOffersFeed(params) {
  return useInfiniteQuery({
    queryKey: offerKeys.feed(params),
    queryFn: ({ pageParam }) => offersApi.list({ ...params, page: pageParam, limit: 20 }),
    initialPageParam: 1,
    getNextPageParam: (last) => (last.meta && last.meta.page < last.meta.totalPages ? last.meta.page + 1 : undefined),
  });
}

export function useOffer(id) {
  return useQuery({ queryKey: offerKeys.detail(id), queryFn: () => offersApi.detail(id), enabled: Boolean(id) });
}

/** A business's active offers for its detail page (kept small). */
export function useBusinessOffers(businessId, limit = 3) {
  return useQuery({
    queryKey: offerKeys.business(businessId, limit),
    queryFn: () => offersApi.forBusiness(businessId, limit),
    enabled: Boolean(businessId),
  });
}

export function useManagedOffers(businessId) {
  return useQuery({ queryKey: offerKeys.manage(businessId), queryFn: () => offersApi.manage(businessId), enabled: Boolean(businessId) });
}

/** Any offer write refreshes every offers query (feed, details, business sections, management). */
export function useOfferMutation(fn, options = {}) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: fn,
    ...options,
    onSuccess: async (data, vars, ctx) => {
      await qc.invalidateQueries({ queryKey: offerKeys.all });
      options.onSuccess?.(data, vars, ctx);
    },
  });
}

/** Management order requested by the owner workspace. */
export const OFFER_GROUPS = ['draft', 'live', 'scheduled', 'expired', 'hidden'];
export const OFFER_STATUS_TONE = { draft: 'gray', live: 'green', scheduled: 'blue', expired: 'amber', hidden: 'red' };
export const OFFER_LIMIT = 10;
