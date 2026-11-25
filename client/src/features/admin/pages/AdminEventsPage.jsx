import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Archive, Ban, CalendarDays, Eye, EyeOff, Pencil, Plus, Search, Send } from 'lucide-react';
import { PageHeader } from '../../../components/ui/Header.jsx';
import { Button } from '../../../components/ui/Button.jsx';
import { Input } from '../../../components/ui/Input.jsx';
import { Modal } from '../../../components/ui/Modal.jsx';
import { Pagination } from '../../../components/ui/Pagination.jsx';
import { ListSkeleton } from '../../../components/ui/Skeleton.jsx';
import { EmptyState } from '../../../components/ui/EmptyState.jsx';
import { ErrorState } from '../../../components/ui/ErrorState.jsx';
import { useToast } from '../../../components/ui/Toast.jsx';
import { errorMessageKey } from '../../../lib/apiClient.js';
import { formatIsoDate } from '../../../lib/dates.js';
import { eventsApi, useAdminEvents, useEventMutation } from '../../events/api.js';
import { EventStatusBadge } from '../../events/components/EventBits.jsx';

const STATUSES = ['draft', 'pending_review', 'changes_requested', 'published', 'cancelled', 'hidden', 'rejected', 'withdrawn', 'archived'];
const btn = 'inline-flex min-h-[40px] items-center gap-1.5 rounded-full px-3 text-[13px] font-semibold ring-1 ring-brand-200 hover:bg-brand-50 disabled:opacity-50';

/** /admin/events - all events: edit, publish, cancel (with reason), hide, restore, remove. */
export default function AdminEventsPage() {
  const { t, i18n } = useTranslation();
  const toast = useToast();
  const [q, setQ] = useState('');
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);
  const [dialog, setDialog] = useState(null); // { kind: 'cancel' | 'remove', event }
  const [reason, setReason] = useState('');
  const { data, isPending, isError, error, refetch } = useAdminEvents({ q: q.trim() || undefined, status: status || undefined, page });

  const onError = (err) => toast.error(err.status === 409 ? err.message : t(errorMessageKey(err)));
  const setEventStatus = useEventMutation(({ id, value, cancelReason }) => eventsApi.adminUpdate(id, { status: value, ...(cancelReason ? { cancelReason } : {}) }), {
    onSuccess: (e) => {
      setDialog(null);
      toast.success(t('eventAdmin.statusChanged', { status: t(`events.status.${e.status}`) }));
    },
    onError,
  });
  const remove = useEventMutation((id) => eventsApi.adminRemove(id), {
    onSuccess: () => {
      setDialog(null);
      toast.success(t('eventAdmin.removed'));
    },
    onError,
  });
  const items = data?.data ?? [];

  return (
    <>
      <PageHeader
        title={t('eventAdmin.title')}
        actions={
          <Link to="/admin/events/new" aria-label={t('eventAdmin.new')} className="flex min-h-tap min-w-tap items-center justify-center rounded-full text-white hover:bg-white/15">
            <Plus className="h-6 w-6" aria-hidden="true" />
          </Link>
        }
      />
      <div className="flex flex-col gap-3 p-4">
        <div className="flex flex-col gap-2 sm:flex-row">
          <label className="relative flex flex-1 items-center">
            <span className="sr-only">{t('eventAdmin.search')}</span>
            <Search className="pointer-events-none absolute left-3 h-4 w-4 text-ink-soft" aria-hidden="true" />
            <input
              type="search"
              value={q}
              onChange={(e) => {
                setQ(e.target.value);
                setPage(1);
              }}
              placeholder={t('eventAdmin.search')}
              className="min-h-tap w-full rounded-xl border border-brand-200 bg-white pl-9 pr-3 text-[15px]"
            />
          </label>
          <Input as="select" aria-label={t('form.status')} value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }}>
            <option value="">{t('admin.allStatuses')}</option>
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {t(`events.status.${s}`)}
              </option>
            ))}
          </Input>
        </div>

        {isPending ? (
          <ListSkeleton rows={4} />
        ) : isError ? (
          <ErrorState error={error} onRetry={refetch} />
        ) : items.length === 0 ? (
          <EmptyState icon={CalendarDays} title={t('eventAdmin.emptyTitle')} body={t('admin.noBusinessesBody')} />
        ) : (
          <ul className="flex flex-col gap-3">
            {items.map((e) => (
              <li key={e.id} className="rounded-card bg-white p-4 shadow-card ring-1 ring-brand-100">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-bold leading-snug">{e.title}</p>
                    <p className="text-sm text-ink-muted">{[formatIsoDate(e.startLocal.slice(0, 10), i18n.language), e.area].filter(Boolean).join(' • ')}</p>
                    <p className="text-xs text-ink-soft">{t(`eventAdmin.source.${e.source}`)}</p>
                  </div>
                  <EventStatusBadge status={e.status} />
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  {['pending_review', 'changes_requested'].includes(e.status) && (
                    <Link to={`/admin/event-submissions/${e.id}`} className={btn}>
                      {t('review.open')}
                    </Link>
                  )}
                  {!['rejected', 'withdrawn', 'archived'].includes(e.status) && (
                    <Link to={`/admin/events/${e.id}/edit`} className={btn}>
                      <Pencil className="h-4 w-4" aria-hidden="true" /> {t('business.edit')}
                    </Link>
                  )}
                  {['draft', 'hidden', 'cancelled'].includes(e.status) && (
                    <button type="button" className={btn} onClick={() => setEventStatus.mutate({ id: e.id, value: 'published' })} aria-label={`${t('admin.publish')} ${e.title}`}>
                      {e.status === 'draft' ? <Send className="h-4 w-4" aria-hidden="true" /> : <Eye className="h-4 w-4" aria-hidden="true" />}
                      {e.status === 'draft' ? t('admin.publish') : t('eventAdmin.restore')}
                    </button>
                  )}
                  {['published', 'hidden'].includes(e.status) && (
                    <button type="button" className={btn} onClick={() => { setReason(''); setDialog({ kind: 'cancel', event: e }); }} aria-label={`${t('eventAdmin.cancel')} ${e.title}`}>
                      <Ban className="h-4 w-4" aria-hidden="true" /> {t('eventAdmin.cancel')}
                    </button>
                  )}
                  {e.status === 'published' && (
                    <button type="button" className={btn} onClick={() => setEventStatus.mutate({ id: e.id, value: 'hidden' })} aria-label={`${t('admin.hide')} ${e.title}`}>
                      <EyeOff className="h-4 w-4" aria-hidden="true" /> {t('admin.hide')}
                    </button>
                  )}
                  {e.status !== 'archived' && (
                    <button type="button" className={`${btn} text-red-700`} onClick={() => setDialog({ kind: 'remove', event: e })} aria-label={`${t('eventAdmin.remove')} ${e.title}`}>
                      <Archive className="h-4 w-4" aria-hidden="true" /> {t('eventAdmin.remove')}
                    </button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
        {data?.meta && <Pagination page={data.meta.page} totalPages={data.meta.totalPages} onChange={setPage} />}
      </div>

      <Modal
        open={Boolean(dialog)}
        onClose={() => setDialog(null)}
        title={dialog?.kind === 'cancel' ? t('eventAdmin.cancelTitle') : t('eventAdmin.removeTitle')}
        footer={
          <>
            <Button variant="secondary" onClick={() => setDialog(null)}>
              {t('common.cancel')}
            </Button>
            {dialog?.kind === 'cancel' ? (
              <Button variant="danger" loading={setEventStatus.isPending} onClick={() => setEventStatus.mutate({ id: dialog.event.id, value: 'cancelled', cancelReason: reason.trim() })}>
                {t('eventAdmin.cancel')}
              </Button>
            ) : (
              <Button variant="danger" loading={remove.isPending} onClick={() => remove.mutate(dialog.event.id)}>
                {t('eventAdmin.remove')}
              </Button>
            )}
          </>
        }
      >
        {dialog?.kind === 'cancel' ? (
          <Input as="textarea" label={t('eventAdmin.cancelReason')} maxLength={300} value={reason} onChange={(e) => setReason(e.target.value)} hint={t('eventAdmin.cancelHint')} />
        ) : (
          <p className="text-sm text-ink-muted">{t('eventAdmin.removeBody', { name: dialog?.event.title })}</p>
        )}
      </Modal>
    </>
  );
}
