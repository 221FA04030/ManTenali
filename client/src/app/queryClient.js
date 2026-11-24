import { QueryClient } from '@tanstack/react-query';

export function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 60_000,
        gcTime: 5 * 60_000,
        refetchOnWindowFocus: false,
        retry: (failureCount, error) => {
          // Don't retry client errors (validation, auth, not found).
          if (error?.status >= 400 && error?.status < 500) return false;
          return failureCount < 2;
        },
      },
      mutations: { retry: false },
    },
  });
}
