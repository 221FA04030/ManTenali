import { Hammer } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { PageHeader } from '../../../components/ui/Header.jsx';
import { EmptyState } from '../../../components/ui/EmptyState.jsx';

/** Temporary screen for routes whose feature step hasn't been built yet. */
export default function PlaceholderPage({ titleKey }) {
  const { t } = useTranslation();
  return (
    <>
      <PageHeader title={t(titleKey)} />
      <div className="p-4">
        <EmptyState
          icon={Hammer}
          title={t('states.buildingTitle')}
          body={t('states.buildingBody')}
          action={
            <Link to="/" className="text-sm font-semibold text-brand-700 underline-offset-2 hover:underline">
              {t('states.goHome')}
            </Link>
          }
        />
      </div>
    </>
  );
}
