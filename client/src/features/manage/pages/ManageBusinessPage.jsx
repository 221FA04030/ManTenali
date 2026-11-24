import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ExternalLink } from 'lucide-react';
import { PageHeader } from '../../../components/ui/Header.jsx';
import { ListSkeleton } from '../../../components/ui/Skeleton.jsx';
import { ErrorState } from '../../../components/ui/ErrorState.jsx';
import { useToast } from '../../../components/ui/Toast.jsx';
import { errorMessageKey } from '../../../lib/apiClient.js';
import { BusinessForm } from '../../businesses/components/BusinessForm.jsx';
import { businessesApi, useBusiness, useBusinessMutation } from '../../businesses/api.js';

/** /manage/businesses/:slug - owner edits hours, contact, photos, description. */
export default function ManageBusinessPage() {
  const { slug } = useParams();
  const { t } = useTranslation();
  const toast = useToast();
  const [serverErrors, setServerErrors] = useState({});
  const { data: b, isPending, isError, error, refetch } = useBusiness(slug);

  const mutation = useBusinessMutation((body) => businessesApi.update(b.id, body), {
    onSuccess: () => {
      setServerErrors({});
      toast.success(t('form.saved'));
    },
    onError: (err) => {
      setServerErrors(err.fieldErrors ?? {});
      toast.error(t(errorMessageKey(err)));
    },
  });

  return (
    <>
      <PageHeader title={b?.name ?? t('profile.myBusinesses')} />
      <div className="flex flex-col gap-4 p-4">
        {isPending ? (
          <ListSkeleton rows={3} />
        ) : isError || !b.canManage ? (
          <ErrorState error={error ?? { code: 'FORBIDDEN' }} onRetry={isError ? refetch : undefined} />
        ) : (
          <>
            {b.status === 'published' && (
              <Link to={`/businesses/${b.slug}`} className="inline-flex min-h-tap items-center gap-2 self-start text-sm font-semibold text-brand-700">
                <ExternalLink className="h-4 w-4" aria-hidden="true" />
                {t('manage.viewPublic')}
              </Link>
            )}
            <p className="rounded-xl bg-brand-50 px-3 py-2 text-sm text-ink-muted">{t('manage.ownerNote')}</p>
            <BusinessForm mode="owner" business={b} onSubmit={(body) => mutation.mutate(body)} submitting={mutation.isPending} serverErrors={serverErrors} />
          </>
        )}
      </div>
    </>
  );
}
