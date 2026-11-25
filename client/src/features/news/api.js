import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CloudSun, Droplets, Megaphone, Newspaper, TrafficCone, Zap } from 'lucide-react';
import { api } from '../../lib/apiClient.js';

export const newsKeys = {
  all: ['news'],
  list: (params) => ['news', 'list', params],
  detail: (slug) => ['news', 'detail', slug],
  admin: (params) => ['news', 'admin', params],
  adminItem: (id) => ['news', 'adminItem', id],
};

export const newsApi = {
  list: (query) => api.get('/news', { query }),
  detail: (slug) => api.get(`/news/${encodeURIComponent(slug)}`).then((r) => r.data),
  // admins
  adminList: (query) => api.get('/admin/news', { query }),
  adminGet: (id) => api.get(`/admin/news/${id}`).then((r) => r.data),
  create: (body) => api.post('/news', body).then((r) => r.data),
  update: (id, body) => api.patch(`/news/${id}`, body).then((r) => r.data),
  remove: (id) => api.delete(`/news/${id}`).then((r) => r.data),
};

export function useNewsList(params) {
  return useInfiniteQuery({
    queryKey: newsKeys.list(params),
    queryFn: ({ pageParam }) => newsApi.list({ ...params, page: pageParam, limit: 20 }),
    initialPageParam: 1,
    getNextPageParam: (last) => (last.meta && last.meta.page < last.meta.totalPages ? last.meta.page + 1 : undefined),
  });
}

export const useNewsItem = (slug) =>
  useQuery({ queryKey: newsKeys.detail(slug), queryFn: () => newsApi.detail(slug), enabled: Boolean(slug) });
export const useAdminNews = (params) =>
  useQuery({ queryKey: newsKeys.admin(params), queryFn: () => newsApi.adminList(params), placeholderData: (p) => p });
export const useAdminNewsItem = (id) =>
  useQuery({ queryKey: newsKeys.adminItem(id), queryFn: () => newsApi.adminGet(id), enabled: Boolean(id) });

/** Any news write refreshes every news query. */
export function useNewsMutation(fn, options = {}) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: fn,
    ...options,
    onSuccess: async (data, vars, ctx) => {
      await qc.invalidateQueries({ queryKey: newsKeys.all });
      options.onSuccess?.(data, vars, ctx);
    },
  });
}

/**
 * FR-NEWS-1 types with their icon and colours. Accent colours follow the UI
 * reference: orange for traffic, blue for weather; the rest use brand green.
 */
export const NEWS_TYPES = [
  { key: 'news', icon: Newspaper, tone: 'bg-brand-100 text-brand-800' },
  { key: 'traffic', icon: TrafficCone, tone: 'bg-status-trafficBg text-status-traffic' },
  { key: 'weather', icon: CloudSun, tone: 'bg-status-weatherBg text-status-weather' },
  { key: 'power', icon: Zap, tone: 'bg-amber-100 text-amber-800' },
  { key: 'water', icon: Droplets, tone: 'bg-sky-100 text-sky-800' },
  { key: 'announcement', icon: Megaphone, tone: 'bg-brand-100 text-brand-800' },
];
export const NEWS_TYPE_KEYS = NEWS_TYPES.map((t) => t.key);
export const typeInfo = (key) => NEWS_TYPES.find((t) => t.key === key) ?? NEWS_TYPES[0];
/** Time-sensitive notice types ("Today in Tenali"): the form suggests a "show until" time. */
export const NOTICE_TYPES = NEWS_TYPE_KEYS.filter((k) => k !== 'news');
export const MAX_PINNED = 5;

export const STATUS_TONE = { draft: 'gray', published: 'green', hidden: 'gray', archived: 'gray' };
