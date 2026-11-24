import '@testing-library/jest-dom/vitest';
import { afterEach, beforeEach, vi } from 'vitest';
import { cleanup } from '@testing-library/react';
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
