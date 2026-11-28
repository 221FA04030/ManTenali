import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../../lib/apiClient.js';

/**
 * Fetch News (Instagram: S News Tenali, via Apify on the server) and review of
 * the imported drafts. The browser never sees an Apify token: it only calls
 * /admin/news-imports on our API.
 */
export const IMPORT_STATUSES = ['needs_review', 'published', 'rejected', 'failed'];

export const importKeys = {
  all: ['newsImports'],
  list: (params) => ['newsImports', 'list', params],
  latestRun: ['newsImports', 'runs', 'latest'],
  run: (id) => ['newsImports', 'runs', id],
};

export const newsImportApi = {
  startFetch: () => api.post('/admin/news-imports/fetch').then((r) => r.data),
  latestRun: () => api.get('/admin/news-imports/runs/latest').then((r) => r.data),
  run: (id) => api.get(`/admin/news-imports/runs/${id}`).then((r) => r.data),
  list: (query) => api.get('/admin/news-imports', { query }),
  save: (id, body) => api.patch(`/admin/news-imports/${id}`, body).then((r) => r.data),
  publish: (id, body) => api.post(`/admin/news-imports/${id}/publish`, body).then((r) => r.data),
  reject: (id, body) => api.post(`/admin/news-imports/${id}/reject`, body).then((r) => r.data),
};

/** How often the page asks for progress while a fetch runs. */
export const RUN_POLL_MS = 1500;

/** The latest fetch; polled while it is running, so progress and counts update by themselves. */
export function useLatestImportRun() {
  return useQuery({
    queryKey: importKeys.latestRun,
    queryFn: newsImportApi.latestRun,
    refetchInterval: (query) => (query.state.data?.status === 'running' ? RUN_POLL_MS : false),
  });
}

export const useNewsImports = (params) =>
  useQuery({ queryKey: importKeys.list(params), queryFn: () => newsImportApi.list(params), placeholderData: (p) => p });

/** Any import write refreshes imports and news lists (the draft is a news item). */
export function useImportMutation(fn, options = {}) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: fn,
    ...options,
    onSuccess: async (data, vars, ctx) => {
      await Promise.all([qc.invalidateQueries({ queryKey: importKeys.all }), qc.invalidateQueries({ queryKey: ['news'] })]);
      options.onSuccess?.(data, vars, ctx);
    },
  });
}

/** Start a fetch and show it straight away as the latest run. */
export function useStartFetch(options = {}) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: newsImportApi.startFetch,
    ...options,
    onSuccess: (run, ...rest) => {
      qc.setQueryData(importKeys.latestRun, run);
      options.onSuccess?.(run, ...rest);
    },
  });
}
