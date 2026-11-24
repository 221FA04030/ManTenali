import { Navigate, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ShieldAlert } from 'lucide-react';
import { useAuth } from '../AuthContext.jsx';
import { ListSkeleton } from '../../../components/ui/Skeleton.jsx';
import { EmptyState } from '../../../components/ui/EmptyState.jsx';
import { PageHeader } from '../../../components/ui/Header.jsx';

/**
 * Route guard. The server enforces every permission; this only decides what
 * to show (login redirect / forbidden screen) for a better experience.
 */
export function RequireAuth({ roles, children }) {
  const { user, status } = useAuth();
  const location = useLocation();
  const { t } = useTranslation();

  if (status === 'loading') {
    return (
      <div className="p-4">
        <ListSkeleton rows={3} />
      </div>
    );
  }
  if (!user) {
    const next = encodeURIComponent(location.pathname + location.search);
    return <Navigate to={`/login?next=${next}`} replace />;
  }
  if (roles && !roles.includes(user.role)) {
    return (
      <>
        <PageHeader title={t('auth.forbiddenTitle')} />
        <div className="p-4">
          <EmptyState icon={ShieldAlert} title={t('auth.forbiddenTitle')} body={t('errors.FORBIDDEN')} />
        </div>
      </>
    );
  }
  return children;
}
