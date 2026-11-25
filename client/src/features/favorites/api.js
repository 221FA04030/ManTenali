import { useMemo } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../../lib/apiClient.js';
import { useAuth } from '../auth/AuthContext.jsx';

export const favoriteKeys = { mine: ['favorites', 'mine'] };

export const favoritesApi = {
  list: () => api.get('/favorites').then((r) => r.data),
  add: (targetType, targetId) => api.post('/favorites', { targetType, targetId }).then((r) => r.data),
  remove: (id) => api.delete(`/favorites/${id}`).then((r) => r.data),
};

/** My saved items (only fetched when signed in). */
export function useFavorites() {
  const { user } = useAuth();
  return useQuery({ queryKey: favoriteKeys.mine, queryFn: favoritesApi.list, enabled: Boolean(user), staleTime: 60_000 });
}

/** Saved state and toggle for one item. */
export function useSaved(targetType, targetId) {
  const qc = useQueryClient();
  const { data } = useFavorites();
  const entry = useMemo(() => (data ?? []).find((f) => f.targetType === targetType && f.targetId === targetId), [data, targetType, targetId]);
  const mutation = useMutation({
    mutationFn: () => (entry ? favoritesApi.remove(entry.id) : favoritesApi.add(targetType, targetId)),
    onSettled: () => qc.invalidateQueries({ queryKey: favoriteKeys.mine }),
  });
  return { saved: Boolean(entry), toggle: mutation.mutateAsync, pending: mutation.isPending };
}

export function useRemoveFavorite() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: favoritesApi.remove, onSettled: () => qc.invalidateQueries({ queryKey: favoriteKeys.mine }) });
}
