import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Info } from 'lucide-react';
import { PageHeader } from '../../../components/ui/Header.jsx';
import { useToast } from '../../../components/ui/Toast.jsx';
import { errorMessageKey } from '../../../lib/apiClient.js';
import { BusinessForm } from '../../businesses/components/BusinessForm.jsx';
import { businessesApi, useBusinessMutation } from '../../businesses/api.js';

/** /manage/new - "Add your business": any signed-in user submits a listing for review. */
export default function AddBusinessPage() {
  const { t } = useTranslation();
  const toast = useToast();
  const navigate = useNavigate();
  const [serverErrors, setServerErrors] = useState({});

  const mutation = useBusinessMutation(({ body, submit }) => businessesApi.submit({ ...body, submit }), {
    onSuccess: (b) => {
      toast.success(b.status === 'pending' ? t('submit.sentForReview') : t('submit.draftSaved'));
      navigate('/manage', { replace: true });
    },
    onError: (err) => {
      setServerErrors(err.fieldErrors ?? {});
      toast.error(err.status === 409 ? err.message : t(errorMessageKey(err)));
    },
  });

  return (
    <>
      <PageHeader title={t('submit.addYourBusiness')} />
      <div className="flex flex-col gap-4 p-4">
        <div className="flex gap-3 rounded-card bg-brand-50 p-4 text-sm text-ink-muted ring-1 ring-brand-100">
          <Info className="h-5 w-5 shrink-0 text-brand-700" aria-hidden="true" />
          <p>{t('submit.intro')}</p>
        </div>
        <BusinessForm
          mode="submission"
          canSubmitForReview
          onSubmit={(body, { submit }) => mutation.mutate({ body, submit })}
          submitting={mutation.isPending}
          serverErrors={serverErrors}
        />
      </div>
    </>
  );
}
