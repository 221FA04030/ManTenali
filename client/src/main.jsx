import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './styles/index.css';
import './app/i18n.js';
import { AppProviders } from './app/AppProviders.jsx';
import { AppRouter } from './app/router.jsx';
import { initErrorReporting } from './lib/errorReporting.js';

// Optional (VITE_SENTRY_DSN); never delays the first render.
initErrorReporting().catch(() => {});

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <AppProviders>
      <AppRouter />
    </AppProviders>
  </StrictMode>,
);
