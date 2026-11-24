import { createContext, useCallback, useContext, useEffect, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { authApi, authKeys } from './api.js';
import { setUnauthorizedHandler } from '../../lib/apiClient.js';

/**
 * Session state. The session itself is an httpOnly cookie the browser JS can't
 * read; we only know who is logged in by asking GET /auth/me.
 */
const AuthContext = createContext({
  user: null,
  status: 'loading',
  setSessionUser: () => {},
  logout: async () => {},
  refresh: async () => {},
});

export function AuthProvider({ children }) {
  const queryClient = useQueryClient();
  const { i18n } = useTranslation();

  const meQuery = useQuery({
    queryKey: authKeys.me,
    queryFn: async () => {
      try {
        return await authApi.me();
      } catch (err) {
        if (err?.status === 401 || err?.status === 403) return null;
        throw err;
      }
    },
    staleTime: 5 * 60_000,
    retry: false,
  });

  const user = meQuery.data ?? null;

  const setSessionUser = useCallback(
    (next) => {
      queryClient.setQueryData(authKeys.me, next);
      if (next?.language && next.language !== i18n.language) i18n.changeLanguage(next.language);
    },
    [queryClient, i18n],
  );

  // Any 401 from the API means the session ended: forget the user so guards redirect.
  useEffect(() => {
    setUnauthorizedHandler(() => queryClient.setQueryData(authKeys.me, null));
    return () => setUnauthorizedHandler(null);
  }, [queryClient]);

  const logout = useCallback(async () => {
    try {
      await authApi.logout();
    } catch {
      /* the cookie may already be gone */
    }
    queryClient.setQueryData(authKeys.me, null);
    // Drop any user-specific cached data (favorites, own reviews, admin lists).
    queryClient.removeQueries({ predicate: (q) => q.queryKey[0] !== 'auth' });
  }, [queryClient]);

  const value = useMemo(
    () => ({
      user,
      status: meQuery.isPending ? 'loading' : user ? 'authenticated' : 'anonymous',
      setSessionUser,
      logout,
      refresh: () => meQuery.refetch(),
    }),
    [user, meQuery, setSessionUser, logout],
  );
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export const useAuth = () => useContext(AuthContext);
