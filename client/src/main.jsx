import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './styles/index.css';
import './app/i18n.js';
import { AppProviders } from './app/AppProviders.jsx';
import { AppRouter } from './app/router.jsx';

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <AppProviders>
      <AppRouter />
    </AppProviders>
  </StrictMode>,
);
