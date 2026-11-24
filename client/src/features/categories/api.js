import { useQuery } from '@tanstack/react-query';
import { api } from '../../lib/apiClient.js';

export const categoryKeys = {
  list: (type, includeInactive = false) => ['categories', type ?? 'all', includeInactive],
};

export const categoriesApi = {
  list: (type, { includeInactive } = {}) =>
    api.get('/categories', { query: { type, includeInactive: includeInactive ? 'true' : undefined } }).then((r) => r.data),
  create: (body) => api.post('/categories', body).then((r) => r.data),
  update: (id, body) => api.patch(`/categories/${id}`, body).then((r) => r.data),
};

/** Active categories of a type (business | event | news). Rarely change -> long cache. */
export function useCategories(type, { includeInactive = false, enabled = true } = {}) {
  return useQuery({
    queryKey: categoryKeys.list(type, includeInactive),
    queryFn: () => categoriesApi.list(type, { includeInactive }),
    staleTime: 30 * 60_000,
    enabled,
  });
}

/** Display name in the current language (Telugu falls back to English). */
export function categoryName(category, lang) {
  if (!category) return '';
  return (lang === 'te' && category.name?.te) || category.name?.en || '';
}
