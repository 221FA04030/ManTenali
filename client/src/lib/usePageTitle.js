import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';

/**
 * Browser tab / history / screen-reader page title (WCAG 2.4.2):
 * "Local Shops & Businesses · Mana Tenali". Follows the chosen language.
 */
export function usePageTitle(title) {
  const { t } = useTranslation();
  const app = t('app.name');
  useEffect(() => {
    document.title = title && title !== app ? `${title} · ${app}` : `${app} - ${t('app.tagline')}`;
  }, [title, app, t]);
}
