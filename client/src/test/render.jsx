import { render } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { QueryClient } from '@tanstack/react-query';
import { AppProviders } from '../app/AppProviders.jsx';
import { routes } from '../app/routes.jsx';

export function createTestQueryClient() {
  return new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 }, mutations: { retry: false } } });
}

/** Render the real route table at a given URL with all providers. */
export function renderApp(initialPath = '/', { queryClient } = {}) {
  const router = createMemoryRouter(routes, { initialEntries: [initialPath] });
  const utils = render(
    <AppProviders queryClient={queryClient ?? createTestQueryClient()}>
      <RouterProvider router={router} />
    </AppProviders>,
  );
  return { ...utils, router };
}

/** Render a single element inside providers + a memory router. */
export function renderWithProviders(ui, { path = '/', initialPath = '/', queryClient } = {}) {
  const router = createMemoryRouter(
    [
      { path, element: ui },
      { path: '*', element: <div data-testid="navigated" /> },
    ],
    { initialEntries: [initialPath] },
  );
  const utils = render(
    <AppProviders queryClient={queryClient ?? createTestQueryClient()}>
      <RouterProvider router={router} />
    </AppProviders>,
  );
  return { ...utils, router };
}

/** Build a fetch mock Response with the standard envelope. */
export function jsonResponse(body, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}
