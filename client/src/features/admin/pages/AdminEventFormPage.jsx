import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { PageHeader } from '../../../components/ui/Header.jsx';
import { ListSkeleton } from '../../../components/ui/Skeleton.jsx';
import { ErrorState } from '../../../components/ui/ErrorState.jsx';
import { useToast } from '../../../components/ui/Toast.jsx';
import { errorMessageKey } from '../../../lib/apiClient.js';
import { EventForm, eventPayload } from '../../events/components/EventForm.jsx';
import { eventsApi, useEventMutation, useEventReview } from '../../events/api.js';

/** /admin/events/new and /admin/events/:id/edit (FR-EVT-3). */
export default function AdminEventFormPage() {
  const { id } = useParams();
  const isNew = !id;
  const { t } = useTranslation();
  const toast = useToast();
  const navigate = useNavigate();
  const [serverErrors, setServerErrors] = useState({});
  const existing = useEventReview(id);

  const mutation = useEventMutation(
    (state) => (isNew ? eventsApi.adminCreate(eventPayload(state, { admin: true })) : eventsApi.adminUpdate(id, eventPayload(state, { admin: true, editing: true }))),
    {
      onSuccess: () => {
        toast.success(t('form.saved'));
        navigate('/admin/events');
      },
      onError: (err) => {
        setServerErrors(err.fieldErrors ?? {});
        toast.error(err.status === 409 ? err.message : t(errorMessageKey(err)));
      },
    },
  );

  return (
    <>
      <PageHeader title={isNew ? t('eventAdmin.new') : t('eventAdmin.edit')} />
      <div className="p-4">
        {!isNew && existing.isPending ? (
          <ListSkeleton rows={3} />
        ) : !isNew && existing.isError ? (
          <ErrorState error={existing.error} onRetry={existing.refetch} />
        ) : (
          <EventForm
            key={existing.data?.id ?? 'new'}
            mode="admin"
            event={isNew ? undefined : existing.data}
            requireFuture={isNew}
            onSubmit={(state) => mutation.mutate(state)}
            submitting={mutation.isPending}
            serverErrors={serverErrors}
          />
        )}
      </div>
    </>
  );
}
