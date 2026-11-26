import '@testing-library/jest-dom/vitest';
import { afterEach, beforeEach, vi } from 'vitest';
import { cleanup, configure } from '@testing-library/react';

// findBy*/waitFor wait up to 3 s (default 1 s): lazy routes are slower when every file runs in parallel.
configure({ asyncUtilTimeout: 3000 });

// jsdom has no scrolling; React Router's ScrollRestoration calls window.scrollTo on navigation.
window.scrollTo = vi.fn();
import i18n from '../app/i18n.js';
import { mockApi } from './mockApi.js';

// Every test starts with an anonymous API mock; tests override routes as needed.
beforeEach(() => {
  mockApi();
});

afterEach(async () => {
  cleanup();
  vi.restoreAllMocks();
  window.localStorage.clear();
  if (i18n.language !== 'en') await i18n.changeLanguage('en');
});
