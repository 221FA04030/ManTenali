import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ChevronRight, ShieldCheck, Store } from 'lucide-react';
import { PageHeader } from '../../../components/ui/Header.jsx';
import { ListSkeleton } from '../../../components/ui/Skeleton.jsx';
import { EmptyState } from '../../../components/ui/EmptyState.jsx';
import { ErrorState } from '../../../components/ui/ErrorState.jsx';
import { Badge } from '../../../components/ui/Badge.jsx';
import { ListRow } from '../../../components/ui/ListRow.jsx';
import { useAuth } from '../../auth/AuthContext.jsx';
import { useMyBusinesses } from '../../businesses/api.js';

export const STATUS_TONE = { published: 'green', draft: 'amber', hidden: 'gray', archived: 'red' };

/** /manage - "My businesses" for owners (FR-BUS-5). */
export default function ManageHomePage() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { data = [], isPending, isError, error, refetch } = useMyBusinesses();

  return (
    <>
      <PageHeader title={t('profile.myBusinesses')} />
      <div className="flex flex-col gap-3 p-4">
        {user.role === 'admin' && (
          <ListRow icon={ShieldCheck} title={t('admin.businesses')} subtitle={t('admin.businessesHint')} to="/admin/businesses" iconSize="md" />
        )}
        {isPending ? (
          <ListSkeleton rows={2} />
        ) : isError ? (
          <ErrorState error={error} onRetry={refetch} />
        ) : data.length === 0 ? (
          <EmptyState icon={Store} title={t('manage.emptyTitle')} body={t('manage.emptyBody')} />
        ) : (
          <ul className="flex flex-col gap-3">
            {data.map((b) => (
              <li key={b.id}>
                <Link
                  to={`/manage/businesses/${b.slug}`}
                  className="flex min-h-[72px] items-center gap-3 rounded-card bg-white px-4 py-3 shadow-card ring-1 ring-brand-100 hover:shadow-lift"
                >
                  <span className="flex min-w-0 flex-1 flex-col gap-1">
                    <span className="truncate font-bold">{b.name}</span>
                    <span className="flex flex-wrap gap-1.5">
                      <Badge tone={STATUS_TONE[b.status]}>{t(`status.${b.status}`)}</Badge>
                      {b.isVerified && <Badge tone="green">{t('badge.verified')}</Badge>}
                    </span>
                  </span>
                  <ChevronRight className="h-5 w-5 text-ink-muted" aria-hidden="true" />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </>
  );
}
