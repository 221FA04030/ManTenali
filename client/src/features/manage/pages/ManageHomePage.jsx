import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { CircleX, Pencil, Plus, Send, ShieldCheck, Store, TicketPercent } from 'lucide-react';
import { PageHeader } from '../../../components/ui/Header.jsx';
import { ListSkeleton } from '../../../components/ui/Skeleton.jsx';
import { EmptyState } from '../../../components/ui/EmptyState.jsx';
import { ErrorState } from '../../../components/ui/ErrorState.jsx';
import { Badge } from '../../../components/ui/Badge.jsx';
import { ListRow } from '../../../components/ui/ListRow.jsx';
import { useToast } from '../../../components/ui/Toast.jsx';
import { errorMessageKey } from '../../../lib/apiClient.js';
import { formatRelative } from '../../../lib/format.js';
import { useAuth } from '../../auth/AuthContext.jsx';
import { categoryName } from '../../categories/api.js';
import { businessesApi, useBusinessMutation, useMyBusinesses, OWNER_STATUS_KEY, STATUS_TONE } from '../../businesses/api.js';

const actionCls =
  'inline-flex min-h-[40px] items-center gap-1.5 rounded-full px-3 text-[13px] font-semibold ring-1 ring-brand-200 hover:bg-brand-50';

/** /manage - "My Businesses": every listing the signed-in user owns, with review status. */
export default function ManageHomePage() {
  const { t, i18n } = useTranslation();
  const toast = useToast();
  const { user } = useAuth();
  const { data = [], isPending, isError, error, refetch } = useMyBusinesses();
  const submit = useBusinessMutation((id) => businessesApi.submitForReview(id), {
    onSuccess: () => toast.success(t('submit.sentForReview')),
    onError: (err) => toast.error(err.status === 409 ? err.message : t(errorMessageKey(err))),
  });

  return (
    <>
      <PageHeader title={t('profile.myBusinesses')} />
      <div className="flex flex-col gap-3 p-4">
        {user.role === 'admin' && (
          <ListRow icon={ShieldCheck} title={t('admin.businesses')} subtitle={t('admin.businessesHint')} to="/admin/businesses" iconSize="md" />
        )}
        <Link
          to="/manage/new"
          className="flex min-h-[56px] items-center justify-center gap-2 rounded-card bg-brand-700 px-4 font-semibold text-white shadow-lift hover:bg-brand-800"
        >
          <Plus className="h-5 w-5" aria-hidden="true" />
          {t('submit.addYourBusiness')}
        </Link>

        {isPending ? (
          <ListSkeleton rows={2} />
        ) : isError ? (
          <ErrorState error={error} onRetry={refetch} />
        ) : data.length === 0 ? (
          <EmptyState icon={Store} title={t('manage.emptyTitle')} body={t('submit.emptyBody')} />
        ) : (
          <ul className="flex flex-col gap-3">
            {data.map((b) => {
              const editable = b.status !== 'archived';
              const canSubmit = b.status === 'draft' || b.status === 'rejected';
              return (
                <li key={b.id} className="rounded-card bg-white p-4 shadow-card ring-1 ring-brand-100">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-bold leading-snug">{b.name}</p>
                      <p className="truncate text-sm text-ink-muted">
                        {[categoryName(b.subcategory ?? b.category, i18n.language), b.area].filter(Boolean).join(' • ')}
                      </p>
                      <p className="text-xs text-ink-soft">{t('common.updated', { time: formatRelative(b.updatedAt, i18n.language) })}</p>
                    </div>
                    <Badge tone={STATUS_TONE[b.status]}>{t(OWNER_STATUS_KEY[b.status])}</Badge>
                  </div>
                  {b.status === 'pending' && <p className="mt-2 text-sm text-ink-muted">{t('submit.pendingNote')}</p>}
                  {b.status === 'rejected' && b.rejectionReason && (
                    <div className="mt-3 rounded-xl bg-red-50 p-3 text-sm text-red-900">
                      <p className="flex items-center gap-1.5 font-semibold">
                        <CircleX className="h-4 w-4" aria-hidden="true" /> {t('submit.rejectedBecause')}
                      </p>
                      <p className="mt-1 whitespace-pre-line">{b.rejectionReason}</p>
                    </div>
                  )}
                  <div className="mt-3 flex flex-wrap gap-2">
                    {editable && (
                      <Link to={`/manage/businesses/${b.id}`} className={actionCls}>
                        <Pencil className="h-4 w-4" aria-hidden="true" /> {t('business.edit')}
                      </Link>
                    )}
                    {canSubmit && (
                      <button type="button" className={actionCls} disabled={submit.isPending} onClick={() => submit.mutate(b.id)}>
                        <Send className="h-4 w-4" aria-hidden="true" /> {b.status === 'rejected' ? t('submit.resubmit') : t('submit.submitForReview')}
                      </button>
                    )}
                    {b.status === 'published' && (user.role === 'owner' || user.role === 'admin') && (
                      <Link to={`/manage/businesses/${b.id}/offers`} className={actionCls}>
                        <TicketPercent className="h-4 w-4" aria-hidden="true" /> {t('offers.title')}
                      </Link>
                    )}
                    {b.status === 'published' && (
                      <Link to={`/businesses/${b.slug}`} className={actionCls}>
                        {t('manage.viewPublic')}
                      </Link>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </>
  );
}
