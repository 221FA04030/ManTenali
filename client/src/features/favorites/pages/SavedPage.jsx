import { useTranslation } from 'react-i18next';
import { Bookmark, Trash2 } from 'lucide-react';
import { PageHeader } from '../../../components/ui/Header.jsx';
import { ListSkeleton } from '../../../components/ui/Skeleton.jsx';
import { EmptyState } from '../../../components/ui/EmptyState.jsx';
import { ErrorState } from '../../../components/ui/ErrorState.jsx';
import { SectionHeader } from '../../../components/ui/SectionHeader.jsx';
import { useToast } from '../../../components/ui/Toast.jsx';
import { errorMessageKey } from '../../../lib/apiClient.js';
import { BusinessCard } from '../../businesses/components/BusinessCard.jsx';
import { OfferCard } from '../../offers/components/OfferCard.jsx';
import { EventCard } from '../../events/components/EventCard.jsx';
import { useFavorites, useRemoveFavorite } from '../api.js';

const TYPES = ['business', 'offer', 'event'];

function SavedCard({ favorite }) {
  const f = favorite;
  if (f.targetType === 'business') return <BusinessCard business={f.item} />;
  if (f.targetType === 'offer') return <OfferCard offer={f.item} />;
  return <EventCard event={f.item} />;
}

/** /saved - FR-FAV-1 / FR-PRO-2: my saved businesses, offers and events. */
export default function SavedPage() {
  const { t } = useTranslation();
  const toast = useToast();
  const query = useFavorites();
  const remove = useRemoveFavorite();
  const items = query.data ?? [];
  const onRemove = (f) =>
    remove.mutate(f.id, {
      onSuccess: () => toast.success(t('saved.removed')),
      onError: (err) => toast.error(t(errorMessageKey(err))),
    });

  return (
    <>
      <PageHeader title={t('pages.saved')} />
      <div className="page-wide flex flex-col gap-6 p-4">
        {query.isPending ? (
          <ListSkeleton rows={3} />
        ) : query.isError ? (
          <ErrorState error={query.error} onRetry={() => query.refetch()} />
        ) : items.length === 0 ? (
          <EmptyState icon={Bookmark} title={t('saved.emptyTitle')} body={t('saved.emptyBody')} />
        ) : (
          TYPES.map((type) => {
            const group = items.filter((f) => f.targetType === type);
            if (!group.length) return null;
            return (
              <section key={type} aria-labelledby={`saved-${type}`}>
                <div id={`saved-${type}`}>
                  <SectionHeader title={t(`saved.groups.${type}`, { count: group.length })} />
                </div>
                <ul className="card-list">
                  {group.map((f) => (
                    <li key={f.id} className="flex flex-col gap-1">
                      {f.item ? (
                        <SavedCard favorite={f} />
                      ) : (
                        <p className="rounded-card bg-gray-50 p-4 text-sm text-ink-muted ring-1 ring-gray-200">{t('saved.unavailable')}</p>
                      )}
                      <button
                        type="button"
                        onClick={() => onRemove(f)}
                        className="inline-flex min-h-tap items-center gap-1.5 self-end px-2 text-[13px] font-semibold text-ink-muted hover:text-red-700"
                        aria-label={`${t('saved.remove')} - ${f.item?.name ?? f.item?.title ?? t('saved.unavailableShort')}`}
                      >
                        <Trash2 className="h-3.5 w-3.5" aria-hidden="true" /> {t('saved.remove')}
                      </button>
                    </li>
                  ))}
                </ul>
              </section>
            );
          })
        )}
      </div>
    </>
  );
}
