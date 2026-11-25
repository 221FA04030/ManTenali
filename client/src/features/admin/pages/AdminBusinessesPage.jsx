import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Archive, BadgeCheck, Eye, EyeOff, Pencil, Plus, Search, Store, TicketPercent } from 'lucide-react';
import { PageHeader } from '../../../components/ui/Header.jsx';
import { Input } from '../../../components/ui/Input.jsx';
import { Button } from '../../../components/ui/Button.jsx';
import { Badge } from '../../../components/ui/Badge.jsx';
import { Modal } from '../../../components/ui/Modal.jsx';
import { Pagination } from '../../../components/ui/Pagination.jsx';
import { ListSkeleton } from '../../../components/ui/Skeleton.jsx';
import { EmptyState } from '../../../components/ui/EmptyState.jsx';
import { ErrorState } from '../../../components/ui/ErrorState.jsx';
import { useToast } from '../../../components/ui/Toast.jsx';
import { errorMessageKey } from '../../../lib/apiClient.js';
import { formatRelative } from '../../../lib/format.js';
import { businessesApi, useAdminBusinesses, useBusinessMutation, STATUS_TONE } from '../../businesses/api.js';

const actionBtn =
  'inline-flex min-h-[40px] items-center gap-1.5 rounded-full px-3 text-[13px] font-semibold ring-1 ring-brand-200 hover:bg-brand-50 disabled:opacity-50';

/** /admin/businesses - all businesses: search, status filter, publish/hide, verify, archive. */
export default function AdminBusinessesPage() {
  const { t, i18n } = useTranslation();
  const toast = useToast();
  const [q, setQ] = useState('');
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);
  const [confirmArchive, setConfirmArchive] = useState(null);
  const params = { q: q.trim() || undefined, status: status || undefined, page };
  const { data, isPending, isError, error, refetch } = useAdminBusinesses(params);

  const onError = (err) => toast.error(t(errorMessageKey(err)));
  const verify = useBusinessMutation(({ id, value }) => businessesApi.verify(id, value), {
    onSuccess: (r) => toast.success(r.isVerified ? t('admin.verifiedDone') : t('admin.unverifiedDone')),
    onError,
  });
  const setStatusM = useBusinessMutation(({ id, value }) => businessesApi.update(id, { status: value }), {
    onSuccess: (r) => toast.success(t('admin.statusChanged', { status: t(`status.${r.status}`) })),
    onError,
  });
  const archive = useBusinessMutation((id) => businessesApi.archive(id), {
    onSuccess: () => {
      setConfirmArchive(null);
      toast.success(t('admin.archivedDone'));
    },
    onError,
  });

  const items = data?.data ?? [];
  const meta = data?.meta;

  return (
    <>
      <PageHeader
        title={t('admin.businesses')}
        actions={
          <Link
            to="/admin/businesses/new"
            aria-label={t('admin.newBusiness')}
            className="flex min-h-tap min-w-tap items-center justify-center rounded-full text-white hover:bg-white/15"
          >
            <Plus className="h-6 w-6" aria-hidden="true" />
          </Link>
        }
      />
      <div className="flex flex-col gap-3 p-4">
        <div className="flex flex-col gap-2 sm:flex-row">
          <label className="relative flex flex-1 items-center">
            <span className="sr-only">{t('admin.searchBusinesses')}</span>
            <Search className="pointer-events-none absolute left-3 h-4 w-4 text-ink-soft" aria-hidden="true" />
            <input
              type="search"
              value={q}
              onChange={(e) => {
                setQ(e.target.value);
                setPage(1);
              }}
              placeholder={t('admin.searchBusinesses')}
              className="min-h-tap w-full rounded-xl border border-brand-200 bg-white pl-9 pr-3 text-[15px]"
            />
          </label>
          <Input
            as="select"
            aria-label={t('form.status')}
            value={status}
            onChange={(e) => {
              setStatus(e.target.value);
              setPage(1);
            }}
          >
            <option value="">{t('admin.allStatuses')}</option>
            {['draft', 'pending', 'published', 'rejected', 'hidden', 'archived'].map((s) => (
              <option key={s} value={s}>
                {t(`status.${s}`)}
              </option>
            ))}
          </Input>
        </div>

        {isPending ? (
          <ListSkeleton rows={4} />
        ) : isError ? (
          <ErrorState error={error} onRetry={refetch} />
        ) : items.length === 0 ? (
          <EmptyState
            icon={Store}
            title={t('admin.noBusinesses')}
            body={t('admin.noBusinessesBody')}
            action={
              <Link to="/admin/businesses/new" className="text-sm font-semibold text-brand-700 hover:underline">
                {t('admin.newBusiness')}
              </Link>
            }
          />
        ) : (
          <ul className="flex flex-col gap-3">
            {items.map((b) => (
              <li key={b.id} className="rounded-card bg-white p-4 shadow-card ring-1 ring-brand-100">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate font-bold">{b.name}</p>
                    <p className="truncate text-sm text-ink-muted">
                      {[b.area, b.owner?.name && t('admin.ownedBy', { name: b.owner.name })].filter(Boolean).join(' • ')}
                    </p>
                    <p className="text-xs text-ink-soft">{t('common.updated', { time: formatRelative(b.updatedAt, i18n.language) })}</p>
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-1">
                    <Badge tone={STATUS_TONE[b.status]}>{t(`status.${b.status}`)}</Badge>
                    {b.isVerified && <Badge tone="green">{t('badge.verified')}</Badge>}
                    {b.isSeed && <Badge tone="amber">{t('badge.sample')}</Badge>}
                  </div>
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Link to={`/admin/businesses/${b.slug}/edit`} className={actionBtn}>
                    <Pencil className="h-4 w-4" aria-hidden="true" /> {t('business.edit')}
                  </Link>
                  {b.status !== 'archived' && (
                    <Link to={`/manage/businesses/${b.id}/offers`} className={actionBtn}>
                      <TicketPercent className="h-4 w-4" aria-hidden="true" /> {t('offers.title')}
                    </Link>
                  )}
                  {b.status !== 'archived' && (
                    <>
                      {b.status === 'pending' || b.status === 'rejected' ? (
                        <Link to={`/admin/submissions/${b.id}`} className={actionBtn}>
                          {t('review.open')}
                        </Link>
                      ) : b.status === 'published' ? (
                        <button type="button" className={actionBtn} onClick={() => setStatusM.mutate({ id: b.id, value: 'hidden' })}>
                          <EyeOff className="h-4 w-4" aria-hidden="true" /> {t('admin.hide')}
                        </button>
                      ) : (
                        <button type="button" className={actionBtn} onClick={() => setStatusM.mutate({ id: b.id, value: 'published' })}>
                          <Eye className="h-4 w-4" aria-hidden="true" /> {t('admin.publish')}
                        </button>
                      )}
                      {!b.isSeed && b.status === 'published' && (
                        <button type="button" className={actionBtn} onClick={() => verify.mutate({ id: b.id, value: !b.isVerified })}>
                          <BadgeCheck className="h-4 w-4" aria-hidden="true" /> {b.isVerified ? t('admin.unverify') : t('admin.verify')}
                        </button>
                      )}
                      <button type="button" className={`${actionBtn} text-red-700`} onClick={() => setConfirmArchive(b)}>
                        <Archive className="h-4 w-4" aria-hidden="true" /> {t('admin.archive')}
                      </button>
                    </>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
        {meta && <Pagination page={meta.page} totalPages={meta.totalPages} onChange={setPage} />}
      </div>

      <Modal
        open={Boolean(confirmArchive)}
        onClose={() => setConfirmArchive(null)}
        title={t('admin.archiveTitle')}
        footer={
          <>
            <Button variant="secondary" onClick={() => setConfirmArchive(null)}>
              {t('common.cancel')}
            </Button>
            <Button variant="danger" loading={archive.isPending} onClick={() => archive.mutate(confirmArchive.id)}>
              {t('admin.archive')}
            </Button>
          </>
        }
      >
        <p className="text-sm text-ink-muted">{t('admin.archiveBody', { name: confirmArchive?.name })}</p>
      </Modal>
    </>
  );
}
