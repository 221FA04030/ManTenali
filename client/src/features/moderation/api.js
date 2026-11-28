import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../../lib/apiClient.js';

/**
 * Admin content moderation: archive (off the website, restorable), restore and
 * delete permanently. The server checks the admin role on every call; these
 * helpers only exist so the admin screens can call it.
 */
export const MODERATION_TYPES = ['business', 'offer', 'event', 'news', 'post', 'comment', 'review'];
export const MODERATION_STATUSES = ['all', 'published', 'archived'];

export const moderationKeys = {
  list: (params) => ['admin', 'moderation', 'list', params],
  item: (type, id) => ['admin', 'moderation', 'item', type, id],
  audit: (params) => ['admin', 'moderation', 'audit', params],
};

export const moderationApi = {
  list: (query) => api.get('/admin/moderation', { query }),
  get: (type, id) => api.get(`/admin/moderation/${type}/${id}`).then((r) => r.data),
  archive: (type, id, reason) => api.post(`/admin/moderation/${type}/${id}/archive`, reason ? { reason } : {}).then((r) => r.data),
  restore: (type, id) => api.post(`/admin/moderation/${type}/${id}/restore`, {}).then((r) => r.data),
  remove: (type, id, reason) =>
    api.delete(`/admin/moderation/${type}/${id}`, { body: { confirm: true, ...(reason ? { reason } : {}) } }).then((r) => r.data),
  audit: (query) => api.get('/admin/moderation/audit', { query }),
};

export const useModerationList = (params) =>
  useQuery({ queryKey: moderationKeys.list(params), queryFn: () => moderationApi.list(params), placeholderData: (p) => p });
export const useModerationAudit = (params, { enabled = true } = {}) =>
  useQuery({ queryKey: moderationKeys.audit(params), queryFn: () => moderationApi.audit(params), placeholderData: (p) => p, enabled });
export const useModerationItem = (type, id, { enabled = true } = {}) =>
  useQuery({ queryKey: moderationKeys.item(type, id), queryFn: () => moderationApi.get(type, id), enabled, staleTime: 0 });

/**
 * Run one moderation action. Every cached query is refreshed afterwards, so an
 * archived or deleted item leaves the lists, feeds and search on screen too.
 */
export function useModerationAction(options = {}) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ action, type, id, reason }) => {
      if (action === 'archive') return moderationApi.archive(type, id, reason);
      if (action === 'restore') return moderationApi.restore(type, id);
      return moderationApi.remove(type, id, reason);
    },
    ...options,
    onSuccess: async (data, vars, ctx) => {
      await qc.invalidateQueries();
      options.onSuccess?.(data, vars, ctx);
    },
  });
}

/** Where an admin can look at an item. Admins can still open archived businesses, offers, events, news and posts. */
export function moderationLink(row) {
  if (row.type === 'business') return row.slug ? `/businesses/${row.slug}` : null;
  if (row.type === 'offer') return `/offers/${row.id}`;
  if (row.type === 'event') return `/events/${row.slug}`;
  if (row.type === 'news') return `/news/${row.slug}`;
  if (row.type === 'post') return `/community/${row.id}`;
  if (row.type === 'comment') return row.postId ? `/community/${row.postId}#comments` : null;
  if (row.type === 'review') return row.business?.slug ? `/businesses/${row.business.slug}` : null;
  return null;
}
