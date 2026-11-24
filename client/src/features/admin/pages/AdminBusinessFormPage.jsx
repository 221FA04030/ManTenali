import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { PageHeader } from '../../../components/ui/Header.jsx';
import { ListSkeleton } from '../../../components/ui/Skeleton.jsx';
import { ErrorState } from '../../../components/ui/ErrorState.jsx';
import { useToast } from '../../../components/ui/Toast.jsx';
import { errorMessageKey } from '../../../lib/apiClient.js';
import { BusinessForm } from '../../businesses/components/BusinessForm.jsx';
import { businessesApi, useBusiness, useBusinessMutation } from '../../businesses/api.js';

/** /admin/businesses/new and /admin/businesses/:slug/edit (FR-BUS-4). */
export default function AdminBusinessFormPage() {
  const { slug } = useParams();
  const isNew = !slug;
  const { t } = useTranslation();
  const toast = useToast();
  const navigate = useNavigate();
  const [serverErrors, setServerErrors] = useState({});
  const existing = useBusiness(slug);

  const onError = (err) => {
    setServerErrors(err.fieldErrors ?? {});
    toast.error(t(errorMessageKey(err)));
  };
  const mutation = useBusinessMutation(
    (body) => (isNew ? businessesApi.create(body) : businessesApi.update(existing.data.id, body)),
    {
      onSuccess: () => {
        toast.success(t('form.saved'));
        navigate('/admin/businesses');
      },
      onError,
    },
  );

  return (
    <>
      <PageHeader title={isNew ? t('admin.newBusiness') : t('admin.editBusiness')} />
      <div className="p-4">
        {!isNew && existing.isPending ? (
          <ListSkeleton rows={3} />
        ) : !isNew && existing.isError ? (
          <ErrorState error={existing.error} onRetry={existing.refetch} />
        ) : (
          <BusinessForm
            key={existing.data?.id ?? 'new'}
            mode="admin"
            business={isNew ? undefined : existing.data}
            onSubmit={(body) => mutation.mutate(body)}
            submitting={mutation.isPending}
            serverErrors={serverErrors}
          />
        )}
      </div>
    </>
  );
}
