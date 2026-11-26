import { useCallback } from 'react';
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
 * Options for an edit form: the active categories plus the item's CURRENT
 * category when it has since been deactivated (marked `inactive`), so editing
 * keeps it instead of silently dropping it. The server accepts an unchanged
 * category; choosing a different one must be active.
 */
export function withCurrentCategory(active = [], current) {
  if (!current?.id || active.some((c) => c.id === current.id)) return active;
  return [...active, { ...current, inactive: true }];
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

/**
 * Links to a main business category by slug (Home shortcuts, Discover rows):
 * { to: '/businesses?categoryId=...' } once categories load; the full list while
 * they load or cannot be fetched; { missing: true } when the category does not
 * exist (shown as "Coming soon").
 */
export function useBusinessCategoryLink() {
  const { data, isSuccess } = useCategories('business');
  return useCallback(
    (slug) => {
      const c = data?.find((x) => x.slug === slug && !x.parentId);
      if (c) return { to: `/businesses?categoryId=${c.id}` };
      return isSuccess ? { missing: true } : { to: '/businesses' };
    },
    [data, isSuccess],
  );
}
