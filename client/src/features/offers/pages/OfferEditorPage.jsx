import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { PageHeader } from '../../../components/ui/Header.jsx';
import { ListSkeleton } from '../../../components/ui/Skeleton.jsx';
import { ErrorState } from '../../../components/ui/ErrorState.jsx';
import { EmptyState } from '../../../components/ui/EmptyState.jsx';
import { useToast } from '../../../components/ui/Toast.jsx';
import { errorMessageKey } from '../../../lib/apiClient.js';
import { OfferForm, offerPayload } from '../components/OfferForm.jsx';
import { offersApi, useManagedOffers, useOffer, useOfferMutation } from '../api.js';

/**
 * /manage/businesses/:businessId/offers/new  and  /manage/offers/:offerId/edit
 * Shared by owners (own businesses) and admins (any business); the server enforces both.
 */
export default function OfferEditorPage() {
  const { businessId: routeBusinessId, offerId } = useParams();
  const isNew = !offerId;
  const { t } = useTranslation();
  const toast = useToast();
  const navigate = useNavigate();
  const [serverErrors, setServerErrors] = useState({});

  const existing = useOffer(offerId);
  const businessId = routeBusinessId ?? existing.data?.businessId;
  const managed = useManagedOffers(businessId);

  const mutation = useOfferMutation(
    ({ state, publish }) =>
      isNew
        ? offersApi.create(offerPayload(state, { businessId, status: publish ? 'published' : 'draft' }))
        : offersApi.update(offerId, offerPayload(state, { original: existing.data, status: publish ? 'published' : undefined })),
    {
      onSuccess: (o) => {
        toast.success(o.status === 'published' ? t('offers.published') : t('offers.saved'));
        navigate(`/manage/businesses/${businessId}/offers`, { replace: true });
      },
      onError: (err) => {
        setServerErrors(err.fieldErrors ?? {});
        toast.error(err.status === 409 ? err.message : t(errorMessageKey(err)));
      },
    },
  );

  const loading = (!isNew && existing.isPending) || (businessId && managed.isPending);
  const failed = (!isNew && existing.isError) || managed.isError;
  const error = existing.error ?? managed.error;
  const canManage = isNew || existing.data?.canManage;

  return (
    <>
      <PageHeader title={isNew ? t('offers.new') : t('offers.edit')} />
      <div className="p-4">
        {loading ? (
          <ListSkeleton rows={3} />
        ) : failed || !canManage ? (
          error?.status === 404 || !canManage ? (
            <EmptyState title={t('offers.notFound')} body={t('states.notFoundBody')} />
          ) : (
            <ErrorState
              error={error}
              onRetry={() => {
                existing.refetch();
                managed.refetch();
              }}
            />
          )
        ) : (
          <>
            {managed.data && <p className="mb-3 text-sm text-ink-muted">{t('offers.forBusiness', { name: managed.data.business.name })}</p>}
            <OfferForm
              key={existing.data?.id ?? 'new'}
              offer={isNew ? undefined : existing.data}
              canPublish={managed.data?.canCreate ?? false}
              disabledReason={isNew && managed.data && !managed.data.canCreate ? t('offers.notEligible') : undefined}
              onSubmit={(state, { publish }) => mutation.mutate({ state, publish })}
              submitting={mutation.isPending}
              serverErrors={serverErrors}
            />
          </>
        )}
      </div>
    </>
  );
}
