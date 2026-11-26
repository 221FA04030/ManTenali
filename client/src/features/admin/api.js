import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../../lib/apiClient.js';

/** Step 10 admin tools: users, reports queue, metrics. */
export const adminKeys = {
  users: (params) => ['admin', 'users', params],
  reports: (params) => ['admin', 'reports', params],
  metrics: (params) => ['admin', 'metrics', params],
};

export const adminApi = {
  users: (query) => api.get('/admin/users', { query }),
  updateUser: (id, body) => api.patch(`/admin/users/${id}`, body).then((r) => r.data),
  reports: (query) => api.get('/admin/reports', { query }),
  actOnReport: (id, body) => api.patch(`/admin/reports/${id}`, body).then((r) => r.data),
  metrics: (query) => api.get('/admin/analytics/summary', { query }).then((r) => r.data),
};

export const useAdminUsers = (params) =>
  useQuery({ queryKey: adminKeys.users(params), queryFn: () => adminApi.users(params), placeholderData: (p) => p });
export const useAdminReports = (params) =>
  useQuery({ queryKey: adminKeys.reports(params), queryFn: () => adminApi.reports(params), placeholderData: (p) => p });
export const useAdminMetrics = (params) =>
  useQuery({ queryKey: adminKeys.metrics(params), queryFn: () => adminApi.metrics(params), placeholderData: (p) => p });

/** Admin writes refresh every admin list (a block shows in users and reports alike). */
export function useAdminMutation(fn, options = {}) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: fn,
    ...options,
    onSuccess: async (data, vars, ctx) => {
      await qc.invalidateQueries({ queryKey: ['admin'] });
      options.onSuccess?.(data, vars, ctx);
    },
  });
}

export const REPORT_STATUSES = ['open', 'reviewed', 'actioned', 'dismissed'];
export const REPORT_TYPES = ['business', 'review', 'offer', 'event', 'news', 'suggestion'];

/** Where an admin can look at the reported content (admins can preview hidden items). */
export function reportTargetLink(r) {
  if (!r.target) return null;
  if (r.targetType === 'offer') return `/offers/${r.targetId}`;
  if (r.targetType === 'event') return `/events/${r.target.slug}`;
  if (r.targetType === 'news') return `/news/${r.target.slug}`;
  if (r.targetType === 'business' || r.targetType === 'review') return r.target.slug ? `/businesses/${r.target.slug}` : null;
  return null;
}

/** Which actions make sense for a report (the server enforces the same rules). */
export function reportActions(r) {
  if (r.status === 'actioned' || r.status === 'dismissed') return [];
  const actions = ['dismiss'];
  if (r.status === 'open') actions.push('mark_reviewed');
  const canHide = r.targetType !== 'suggestion' && r.target?.isPublic;
  const canBlock = Boolean(r.responsibleUser);
  if (canHide) actions.push('hide_target');
  if (canBlock) actions.push('block_user');
  if (canHide && canBlock) actions.push('hide_and_block');
  return actions;
}
