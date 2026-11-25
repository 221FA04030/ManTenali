import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { PageHeader } from '../../../components/ui/Header.jsx';
import { ListSkeleton } from '../../../components/ui/Skeleton.jsx';
import { ErrorState } from '../../../components/ui/ErrorState.jsx';
import { useToast } from '../../../components/ui/Toast.jsx';
import { errorMessageKey } from '../../../lib/apiClient.js';
import { NewsForm, newsPayload } from '../../news/components/NewsForm.jsx';
import { newsApi, useAdminNewsItem, useNewsMutation } from '../../news/api.js';

/** /admin/news/new and /admin/news/:id/edit (FR-NEWS-3). */
export default function AdminNewsFormPage() {
  const { id } = useParams();
  const isNew = !id;
  const { t } = useTranslation();
  const toast = useToast();
  const navigate = useNavigate();
  const [serverErrors, setServerErrors] = useState({});
  const existing = useAdminNewsItem(id);

  const mutation = useNewsMutation(
    (state) => (isNew ? newsApi.create(newsPayload(state)) : newsApi.update(id, newsPayload(state, { editing: true }))),
    {
      onSuccess: () => {
        toast.success(t('form.saved'));
        navigate('/admin/news');
      },
      onError: (err) => {
        setServerErrors(err.fieldErrors ?? {});
        toast.error(err.status === 409 ? err.message : t(errorMessageKey(err)));
      },
    },
  );

  return (
    <>
      <PageHeader title={isNew ? t('newsAdmin.new') : t('newsAdmin.edit')} />
      <div className="p-4">
        {!isNew && existing.isPending ? (
          <ListSkeleton rows={3} />
        ) : !isNew && existing.isError ? (
          <ErrorState error={existing.error} onRetry={existing.refetch} />
        ) : (
          <NewsForm
            key={existing.data?.id ?? 'new'}
            item={isNew ? undefined : existing.data}
            onSubmit={(state) => mutation.mutate(state)}
            submitting={mutation.isPending}
            serverErrors={serverErrors}
          />
        )}
      </div>
    </>
  );
}
