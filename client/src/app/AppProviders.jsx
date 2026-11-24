import { useState } from 'react';
import { QueryClientProvider } from '@tanstack/react-query';
import { I18nextProvider } from 'react-i18next';
import i18n from './i18n.js';
import { createQueryClient } from './queryClient.js';
import { LocationProvider } from './providers/LocationProvider.jsx';
import { MenuProvider } from './MenuContext.jsx';
import { AuthProvider } from '../features/auth/AuthContext.jsx';
import { ToastProvider } from '../components/ui/Toast.jsx';

/** All app-wide providers: Query, i18n, Auth, Location, Toast, Menu. */
export function AppProviders({ children, queryClient }) {
  const [client] = useState(() => queryClient ?? createQueryClient());
  return (
    <QueryClientProvider client={client}>
      <I18nextProvider i18n={i18n}>
        <ToastProvider>
          <AuthProvider>
            <LocationProvider>
              <MenuProvider>{children}</MenuProvider>
            </LocationProvider>
          </AuthProvider>
        </ToastProvider>
      </I18nextProvider>
    </QueryClientProvider>
  );
}
