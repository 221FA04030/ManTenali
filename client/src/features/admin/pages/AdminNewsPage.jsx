import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Archive, Eye, EyeOff, Newspaper, Pencil, Pin, PinOff, Plus, Search, Send } from 'lucide-react';
import { PageHeader } from '../../../components/ui/Header.jsx';
import { Button } from '../../../components/ui/Button.jsx';
import { Input } from '../../../components/ui/Input.jsx';
import { Modal } from '../../../components/ui/Modal.jsx';
import { Badge } from '../../../components/ui/Badge.jsx';
import { Pagination } from '../../../components/ui/Pagination.jsx';
import { ListSkeleton } from '../../../components/ui/Skeleton.jsx';
import { EmptyState } from '../../../components/ui/EmptyState.jsx';
import { ErrorState } from '../../../components/ui/ErrorState.jsx';
import { useToast } from '../../../components/ui/Toast.jsx';
import { errorMessageKey } from '../../../lib/apiClient.js';
import { formatRelative } from '../../../lib/format.js';
import { NEWS_TYPE_KEYS, newsApi, useAdminNews, useNewsMutation } from '../../news/api.js';
import { NewsStatusBadge, NewsTypeBadge } from '../../news/components/NewsBits.jsx';
import { FetchNewsPanel } from '../components/FetchNewsPanel.jsx';

const STATUSES = ['draft', 'published', 'hidden', 'archived'];
const btn = 'inline-flex min-h-[40px] items-center gap-1.5 rounded-full px-3 text-[13px] font-semibold ring-1 ring-brand-200 hover:bg-brand-50 disabled:opacity-50';

/** /admin/news - all news items: edit, publish, hide, pin/unpin, remove (FR-NEWS-3). */
export default function AdminNewsPage() {
  const { t, i18n } = useTranslation();
  const toast = useToast();
  const [q, setQ] = useState('');
  const [status, setStatus] = useState('');
  const [type, setType] = useState('');
  const [page, setPage] = useState(1);
  const [removing, setRemoving] = useState(null);
  const { data, isPending, isError, error, refetch } = useAdminNews({
    q: q.trim() || undefined,
    status: status || undefined,
    type: type || undefined,
    page,
  });

  const onError = (err) => toast.error(err.status === 409 || err.status === 400 ? err.message : t(errorMessageKey(err)));
  const patch = useNewsMutation(({ id, body }) => newsApi.update(id, body), {
    onSuccess: (n, { body }) => {
      if (body.isPinned !== undefined) toast.success(t(n.isPinned ? 'newsAdmin.pinnedDone' : 'newsAdmin.unpinnedDone'));
      else toast.success(t('admin.statusChanged', { status: t(`status.${n.status}`) }));
    },
    onError,
  });
  const remove = useNewsMutation((id) => newsApi.remove(id), {
    onSuccess: () => {
      setRemoving(null);
      toast.success(t('newsAdmin.removed'));
    },
    onError,
  });
  const items = data?.data ?? [];
  const resetPage = (fn) => (e) => {
    fn(e.target.value);
    setPage(1);
  };

  return (
    <>
      <PageHeader
        title={t('newsAdmin.title')}
        actions={
          <Link to="/admin/news/new" aria-label={t('newsAdmin.new')} className="flex min-h-tap min-w-tap items-center justify-center rounded-full text-white hover:bg-white/15">
            <Plus className="h-6 w-6" aria-hidden="true" />
          </Link>
        }
      />
      <div className="flex flex-col gap-3 p-4">
        <FetchNewsPanel />
        <label className="relative flex items-center">
          <span className="sr-only">{t('newsAdmin.search')}</span>
          <Search className="pointer-events-none absolute left-3 h-4 w-4 text-ink-soft" aria-hidden="true" />
          <input
            type="search"
            value={q}
            onChange={resetPage(setQ)}
            placeholder={t('newsAdmin.search')}
            className="min-h-tap w-full rounded-xl border border-brand-200 bg-white pl-9 pr-3 text-[15px]"
          />
        </label>
        <div className="grid grid-cols-2 gap-2">
          <Input as="select" aria-label={t('form.status')} value={status} onChange={resetPage(setStatus)}>
            <option value="">{t('admin.allStatuses')}</option>
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {t(`status.${s}`)}
              </option>
            ))}
          </Input>
          <Input as="select" aria-label={t('news.type')} value={type} onChange={resetPage(setType)}>
            <option value="">{t('news.allTypes')}</option>
            {NEWS_TYPE_KEYS.map((k) => (
              <option key={k} value={k}>
                {t(`news.types.${k}`)}
              </option>
            ))}
          </Input>
        </div>

        {isPending ? (
          <ListSkeleton rows={4} />
        ) : isError ? (
          <ErrorState error={error} onRetry={refetch} />
        ) : items.length === 0 ? (
          <EmptyState icon={Newspaper} title={t('newsAdmin.emptyTitle')} body={t('admin.noBusinessesBody')} />
        ) : (
          <ul className="flex flex-col gap-3">
            {items.map((n) => (
              <li key={n.id} className="rounded-card bg-white p-4 shadow-card ring-1 ring-brand-100">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex min-w-0 flex-col gap-1">
                    <span className="flex flex-wrap gap-1.5">
                      <NewsTypeBadge type={n.type} />
                      {n.isPinned && (
                        <Badge tone="solid" icon={Pin}>
                          {t('news.pinned')}
                        </Badge>
                      )}
                      {n.isExpired && <Badge tone="gray">{t('news.expired')}</Badge>}
                    </span>
                    <p className="font-bold leading-snug">{n.title}</p>
                    <p className="text-xs text-ink-soft">
                      {[t('news.source', { name: n.sourceName }), t('common.updated', { time: formatRelative(n.updatedAt, i18n.language) })].join(' • ')}
                    </p>
                  </div>
                  <NewsStatusBadge status={n.status} />
                </div>
                {n.status !== 'archived' && (
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Link to={`/admin/news/${n.id}/edit`} className={btn} aria-label={`${t('business.edit')} ${n.title}`}>
                      <Pencil className="h-4 w-4" aria-hidden="true" /> {t('business.edit')}
                    </Link>
                    {n.status === 'published' && (
                      <Link to={`/news/${n.slug}`} className={btn}>
                        <Eye className="h-4 w-4" aria-hidden="true" /> {t('newsAdmin.view')}
                      </Link>
                    )}
                    {['draft', 'hidden'].includes(n.status) && (
                      <button type="button" className={btn} disabled={patch.isPending} onClick={() => patch.mutate({ id: n.id, body: { status: 'published' } })} aria-label={`${t('admin.publish')} ${n.title}`}>
                        <Send className="h-4 w-4" aria-hidden="true" /> {t('admin.publish')}
                      </button>
                    )}
                    {n.status === 'published' && (
                      <button type="button" className={btn} disabled={patch.isPending} onClick={() => patch.mutate({ id: n.id, body: { status: 'hidden' } })} aria-label={`${t('admin.hide')} ${n.title}`}>
                        <EyeOff className="h-4 w-4" aria-hidden="true" /> {t('admin.hide')}
                      </button>
                    )}
                    <button
                      type="button"
                      className={btn}
                      disabled={patch.isPending}
                      onClick={() => patch.mutate({ id: n.id, body: { isPinned: !n.isPinned } })}
                      aria-label={`${n.isPinned ? t('newsAdmin.unpin') : t('newsAdmin.pin')} ${n.title}`}
                    >
                      {n.isPinned ? <PinOff className="h-4 w-4" aria-hidden="true" /> : <Pin className="h-4 w-4" aria-hidden="true" />}
                      {n.isPinned ? t('newsAdmin.unpin') : t('newsAdmin.pin')}
                    </button>
                    <button type="button" className={`${btn} text-red-700`} onClick={() => setRemoving(n)} aria-label={`${t('eventAdmin.remove')} ${n.title}`}>
                      <Archive className="h-4 w-4" aria-hidden="true" /> {t('eventAdmin.remove')}
                    </button>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
        {data?.meta && <Pagination page={data.meta.page} totalPages={data.meta.totalPages} onChange={setPage} />}
      </div>

      <Modal
        open={Boolean(removing)}
        onClose={() => setRemoving(null)}
        title={t('newsAdmin.removeTitle')}
        footer={
          <>
            <Button variant="secondary" onClick={() => setRemoving(null)}>
              {t('common.cancel')}
            </Button>
            <Button variant="danger" loading={remove.isPending} onClick={() => remove.mutate(removing.id)}>
              {t('eventAdmin.remove')}
            </Button>
          </>
        }
      >
        <p className="text-sm text-ink-muted">{t('newsAdmin.removeBody', { name: removing?.title })}</p>
      </Modal>
    </>
  );
}
