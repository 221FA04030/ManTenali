import { useQuery } from '@tanstack/react-query';
import { api } from '../../lib/apiClient.js';

export const homeKeys = { feed: (params) => ['home', params] };

/** GET /home: banner, Today in Tenali and the Home sections in one request. */
export function useHomeFeed(params) {
  return useQuery({
    queryKey: homeKeys.feed(params),
    queryFn: () => api.get('/home', { query: params }).then((r) => r.data),
    staleTime: 60_000,
  });
}
