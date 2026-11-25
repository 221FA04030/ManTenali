import { useEffect, useState } from 'react';
import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { Building2, CalendarDays, Newspaper, Store, TicketPercent } from 'lucide-react';
import { api } from '../../lib/apiClient.js';

/** Tabs on /search (FR-SRCH-1). `all` shows a preview of each type. */
export const SEARCH_TABS = [
  { key: 'all', icon: Building2 },
  { key: 'business', icon: Store },
  { key: 'offer', icon: TicketPercent },
  { key: 'event', icon: CalendarDays },
  { key: 'news', icon: Newspaper },
];
export const RESULT_TYPES = ['business', 'offer', 'event', 'news'];
export const MIN_QUERY = 2;

export const searchKeys = {
  results: (params) => ['search', 'results', params],
  suggest: (q) => ['search', 'suggest', q],
};

export const searchApi = {
  search: (query) => api.get('/search', { query }),
  suggest: (q) => api.get('/search/suggest', { query: { q } }).then((r) => r.data),
};

/** One query, every type (`type=all`) or one type with load more. */
export function useSearch(params) {
  const enabled = (params.q ?? '').trim().length >= MIN_QUERY;
  return useInfiniteQuery({
    queryKey: searchKeys.results(params),
    queryFn: ({ pageParam }) => searchApi.search({ ...params, ...(params.type === 'all' ? {} : { page: pageParam, limit: 20 }) }),
    initialPageParam: 1,
    getNextPageParam: (last) => (last.meta && last.meta.page < last.meta.totalPages ? last.meta.page + 1 : undefined),
    enabled,
    staleTime: 60_000,
  });
}

/** Value that settles `delay` ms after the last change (typing). */
export function useDebounced(value, delay = 250) {
  const [settled, setSettled] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setSettled(value), delay);
    return () => clearTimeout(id);
  }, [value, delay]);
  return settled;
}

/** FR-SRCH-3: business and category name suggestions while typing. */
export function useSuggest(text) {
  const q = useDebounced(text.trim());
  return useQuery({
    queryKey: searchKeys.suggest(q),
    queryFn: () => searchApi.suggest(q),
    enabled: q.length >= MIN_QUERY,
    staleTime: 5 * 60_000,
  });
}
