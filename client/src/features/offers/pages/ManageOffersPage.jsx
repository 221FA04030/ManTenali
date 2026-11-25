import { Link, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { EyeOff, Pencil, Plus, Send, TicketPercent } from 'lucide-react';
import { PageHeader } from '../../../components/ui/Header.jsx';
import { ListSkeleton } from '../../../components/ui/Skeleton.jsx';
import { EmptyState } from '../../../components/ui/EmptyState.jsx';
import { ErrorState } from '../../../components/ui/ErrorState.jsx';
import { useToast } from '../../../components/ui/Toast.jsx';
import { errorMessageKey } from '../../../lib/apiClient.js';
import { offersApi, useManagedOffers, useOfferMutation, OFFER_GROUPS } from '../api.js';
import { OfferStatusBadge, ValidityDates } from '../components/OfferBits.jsx';

const actionCls =
  'inline-flex min-h-[40px] items-center gap-1.5 rounded-full px-3 text-[13px] font-semibold ring-1 ring-brand-200 hover:bg-brand-50 disabled:opacity-50';

/**
 * /manage/businesses/:businessId/offers - owner (own business) or admin (any)
 * manages offers, grouped by Draft / Live / Scheduled / Expired / Hidden.
 */
export default function ManageOffersPage() {
  const { businessId } = useParams();
  const { t } = useTranslation();
  const toast = useToast();
  const { data, isPending, isError, error, refetch } = useManagedOffers(businessId);

  const onError = (err) => toast.error(err.status === 409 ? err.message : t(errorMessageKey(err)));
  const hide = useOfferMutation((id) => offersApi.hide(id), { onSuccess: () => toast.success(t('offers.hidden')), onError });
  const publish = useOfferMutation((id) => offersApi.update(id, { status: 'published' }), {
    onSuccess: () => toast.success(t('offers.published')),
    onError,
  });

  const items = data?.items ?? [];
  const atLimit = data && data.activeOrScheduled >= data.limit;

  return (
    <>
      <PageHeader title={data?.business?.name ?? t('offers.title')} />
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
            <div className="rounded-card bg-white p-4 shadow-card ring-1 ring-brand-100">
              <h2 className="text-base font-bold">{t('offers.manageTitle')}</h2>
              <p className="text-sm text-ink-muted">{t('offers.limitInfo', { count: data.activeOrScheduled, limit: data.limit })}</p>
              {!data.canCreate && <p className="mt-2 rounded-xl bg-amber-50 p-2 text-sm text-amber-900">{t('offers.notEligible')}</p>}
              {data.canCreate && (
                <Link
                  to={`/manage/businesses/${businessId}/offers/new`}
                  className="mt-3 flex min-h-[52px] items-center justify-center gap-2 rounded-full bg-brand-700 px-4 font-semibold text-white hover:bg-brand-800"
                >
                  <Plus className="h-5 w-5" aria-hidden="true" />
                  {t('offers.new')}
                </Link>
              )}
              {data.canCreate && atLimit && <p className="mt-2 text-xs text-amber-800">{t('offers.atLimit', { limit: data.limit })}</p>}
            </div>

            {items.length === 0 ? (
              <EmptyState icon={TicketPercent} title={t('offers.noneYet')} body={t('offers.noneYetBody')} />
            ) : (
              OFFER_GROUPS.map((group) => {
                const groupItems = items.filter((o) => o.displayStatus === group);
                if (!groupItems.length) return null;
                return (
                  <section key={group} aria-labelledby={`offers-${group}`}>
                    <h2 id={`offers-${group}`} className="mb-2 text-sm font-bold uppercase tracking-wide text-ink-muted">
                      {t(`offers.status.${group}`)} ({groupItems.length})
                    </h2>
                    <ul className="flex flex-col gap-3">
                      {groupItems.map((o) => (
                        <li key={o.id} className="rounded-card bg-white p-4 shadow-card ring-1 ring-brand-100">
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                              <p className="font-bold leading-snug">{o.title}</p>
                              <p className="text-sm font-semibold text-amber-800">{o.discountLabel}</p>
                              <p className="text-xs text-ink-soft">
                                <ValidityDates from={o.validFromDate} to={o.validToDate} />
                              </p>
                            </div>
                            <OfferStatusBadge status={o.displayStatus} />
                          </div>
                          <div className="mt-3 flex flex-wrap gap-2">
                            <Link to={`/manage/offers/${o.id}/edit`} className={actionCls}>
                              <Pencil className="h-4 w-4" aria-hidden="true" /> {t('offers.edit')}
                            </Link>
                            {(group === 'draft' || group === 'hidden') && data.canCreate && (
                              <button
                                type="button"
                                className={actionCls}
                                disabled={publish.isPending}
                                onClick={() => publish.mutate(o.id)}
                                aria-label={`${t('offers.publish')} ${o.title}`}
                              >
                                <Send className="h-4 w-4" aria-hidden="true" /> {t('offers.publish')}
                              </button>
                            )}
                            {group !== 'hidden' && (
                              <button
                                type="button"
                                className={`${actionCls} text-red-700`}
                                disabled={hide.isPending}
                                onClick={() => hide.mutate(o.id)}
                                aria-label={`${t('offers.hide')} ${o.title}`}
                              >
                                <EyeOff className="h-4 w-4" aria-hidden="true" /> {t('offers.hide')}
                              </button>
                            )}
                          </div>
                        </li>
                      ))}
                    </ul>
                  </section>
                );
              })
            )}
          </>
        )}
      </div>
    </>
  );
}
