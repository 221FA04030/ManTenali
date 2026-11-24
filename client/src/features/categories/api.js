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

/**
 * Flat list (with parentId) -> [{ ...main, children: [...subs] }], keeping
 * server order. Subcategories whose main category is missing are dropped.
 */
export function buildCategoryTree(list = []) {
  const mains = list.filter((c) => !c.parentId).map((c) => ({ ...c, children: [] }));
  const byId = new Map(mains.map((m) => [m.id, m]));
  for (const c of list) if (c.parentId && byId.has(c.parentId)) byId.get(c.parentId).children.push(c);
  return mains;
}

/** Business categories as a two-level tree. */
export function useCategoryTree(type = 'business', options) {
  const query = useCategories(type, options);
  return { ...query, tree: query.data ? buildCategoryTree(query.data) : [] };
}

/** Display name in the current language (Telugu falls back to English). */
export function categoryName(category, lang) {
  if (!category) return '';
  return (lang === 'te' && category.name?.te) || category.name?.en || '';
}
