import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { CircleX, ExternalLink } from 'lucide-react';
import { PageHeader } from '../../../components/ui/Header.jsx';
import { Badge } from '../../../components/ui/Badge.jsx';
import { ListSkeleton } from '../../../components/ui/Skeleton.jsx';
import { ErrorState } from '../../../components/ui/ErrorState.jsx';
import { EmptyState } from '../../../components/ui/EmptyState.jsx';
import { useToast } from '../../../components/ui/Toast.jsx';
import { errorMessageKey } from '../../../lib/apiClient.js';
import { BusinessForm } from '../../businesses/components/BusinessForm.jsx';
import { businessesApi, businessKeys, useMyBusiness, OWNER_STATUS_KEY, STATUS_TONE } from '../../businesses/api.js';

const BEFORE_APPROVAL = ['draft', 'pending', 'rejected'];

/**
 * /manage/businesses/:id - the owner edits their own listing.
 * Before approval: all listing fields (and submit for review).
 * After approval: only description, tags, contact, hours and photos.
 */
export default function ManageBusinessPage() {
  const { id } = useParams();
  const { t } = useTranslation();
  const toast = useToast();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [serverErrors, setServerErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const { data: b, isPending, isError, error, refetch } = useMyBusiness(id);

  async function save(body, { submit }) {
    setSaving(true);
    try {
      await businessesApi.update(b.id, body);
      if (submit) await businessesApi.submitForReview(b.id);
      setServerErrors({});
      await qc.invalidateQueries({ queryKey: businessKeys.all });
      toast.success(submit ? t('submit.sentForReview') : t('form.saved'));
      if (submit) navigate('/manage');
    } catch (err) {
      setServerErrors(err.fieldErrors ?? {});
      toast.error(err.status === 409 || err.status === 403 ? err.message : t(errorMessageKey(err)));
    } finally {
      setSaving(false);
    }
  }

  const beforeApproval = b && BEFORE_APPROVAL.includes(b.status);

  return (
    <>
      <PageHeader title={b?.name ?? t('profile.myBusinesses')} />
      <div className="flex flex-col gap-4 p-4">
        {isPending ? (
          <ListSkeleton rows={3} />
        ) : isError ? (
          error?.status === 404 ? (
            <EmptyState title={t('business.notFound')} body={t('states.notFoundBody')} />
          ) : (
            <ErrorState error={error} onRetry={refetch} />
          )
        ) : (
          <>
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone={STATUS_TONE[b.status]}>{t(OWNER_STATUS_KEY[b.status])}</Badge>
              {b.status === 'published' && (
                <Link to={`/businesses/${b.slug}`} className="inline-flex min-h-tap items-center gap-2 text-sm font-semibold text-brand-700">
                  <ExternalLink className="h-4 w-4" aria-hidden="true" />
                  {t('manage.viewPublic')}
                </Link>
              )}
            </div>
            {b.status === 'rejected' && b.rejectionReason && (
              <div role="status" className="rounded-xl bg-red-50 p-3 text-sm text-red-900">
                <p className="flex items-center gap-1.5 font-semibold">
                  <CircleX className="h-4 w-4" aria-hidden="true" /> {t('submit.rejectedBecause')}
                </p>
                <p className="mt-1 whitespace-pre-line">{b.rejectionReason}</p>
                <p className="mt-2 text-red-800">{t('submit.fixAndResubmit')}</p>
              </div>
            )}
            {b.status === 'pending' && <p className="rounded-xl bg-amber-50 px-3 py-2 text-sm text-amber-900">{t('submit.pendingNote')}</p>}
            {!beforeApproval && <p className="rounded-xl bg-brand-50 px-3 py-2 text-sm text-ink-muted">{t('manage.ownerNote')}</p>}
            <BusinessForm
              key={`${b.id}-${b.status}`}
              mode={beforeApproval ? 'submission' : 'owner'}
              business={b}
              canSubmitForReview={b.status === 'draft' || b.status === 'rejected'}
              onSubmit={save}
              submitting={saving}
              serverErrors={serverErrors}
            />
          </>
        )}
      </div>
    </>
  );
}
