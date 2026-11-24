import { MapPin } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { PageHeader } from '../../../components/ui/Header.jsx';
import { EmptyState } from '../../../components/ui/EmptyState.jsx';

export default function NotFoundPage() {
  const { t } = useTranslation();
  return (
    <>
      <PageHeader title={t('states.notFoundTitle')} />
      <div className="p-4">
        <EmptyState
          icon={MapPin}
          title={t('states.notFoundTitle')}
          body={t('states.notFoundBody')}
          action={
            <Link to="/" className="text-sm font-semibold text-brand-700 hover:underline">
              {t('states.goHome')}
            </Link>
          }
        />
      </div>
    </>
  );
}
