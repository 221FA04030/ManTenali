import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Search, Users } from 'lucide-react';
import { PageHeader } from '../../../components/ui/Header.jsx';
import { Badge } from '../../../components/ui/Badge.jsx';
import { Button } from '../../../components/ui/Button.jsx';
import { Input } from '../../../components/ui/Input.jsx';
import { Modal } from '../../../components/ui/Modal.jsx';
import { Pagination } from '../../../components/ui/Pagination.jsx';
import { ListSkeleton } from '../../../components/ui/Skeleton.jsx';
import { EmptyState } from '../../../components/ui/EmptyState.jsx';
import { ErrorState } from '../../../components/ui/ErrorState.jsx';
import { useToast } from '../../../components/ui/Toast.jsx';
import { errorMessageKey } from '../../../lib/apiClient.js';
import { formatDate } from '../../../lib/format.js';
import { useAuth } from '../../auth/AuthContext.jsx';
import { adminApi, useAdminMutation, useAdminUsers } from '../api.js';

const ROLES = ['user', 'owner', 'admin'];

/**
 * /admin/users - user management (FR-AUTH-4): search, change role, block and
 * unblock. Every change is confirmed. Admins cannot change their own role or
 * block themselves (the server refuses too).
 */
export default function AdminUsersPage() {
  const { t, i18n } = useTranslation();
  const toast = useToast();
  const { user: me } = useAuth();
  const [q, setQ] = useState('');
  const [role, setRole] = useState('');
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);
  const [pending, setPending] = useState(null); // { user, change: { role } | { status } }
  const { data, isPending, isError, error, refetch } = useAdminUsers({ q: q.trim() || undefined, role: role || undefined, status: status || undefined, page });
  const update = useAdminMutation(({ id, change }) => adminApi.updateUser(id, change), {
    onSuccess: (u) => {
      setPending(null);
      toast.success(t('adminUsers.updated', { name: u.name }));
    },
    onError: (err) => toast.error(err.status === 403 ? err.message : t(errorMessageKey(err))),
  });
  const items = data?.data ?? [];
  const reset = (fn) => (e) => {
    fn(e.target.value);
    setPage(1);
  };
  const confirmText = pending
    ? pending.change.role
      ? t('adminUsers.confirmRole', { name: pending.user.name, role: t(`roles.${pending.change.role}`) })
      : t(pending.change.status === 'blocked' ? 'adminUsers.confirmBlock' : 'adminUsers.confirmUnblock', { name: pending.user.name })
    : '';

  return (
    <>
      <PageHeader title={t('adminUsers.title')} />
      <div className="flex flex-col gap-3 p-4">
        <label className="relative flex items-center">
          <span className="sr-only">{t('adminUsers.search')}</span>
          <Search className="pointer-events-none absolute left-3 h-4 w-4 text-ink-soft" aria-hidden="true" />
          <input type="search" value={q} onChange={reset(setQ)} placeholder={t('adminUsers.search')} className="min-h-tap w-full rounded-xl border border-brand-200 bg-white pl-9 pr-3 text-[15px]" />
        </label>
        <div className="grid grid-cols-2 gap-2">
          <Input as="select" aria-label={t('adminUsers.role')} value={role} onChange={reset(setRole)}>
            <option value="">{t('adminUsers.allRoles')}</option>
            {ROLES.map((r) => (
              <option key={r} value={r}>
                {t(`roles.${r}`)}
              </option>
            ))}
          </Input>
          <Input as="select" aria-label={t('form.status')} value={status} onChange={reset(setStatus)}>
            <option value="">{t('admin.allStatuses')}</option>
            <option value="active">{t('adminUsers.active')}</option>
            <option value="blocked">{t('adminUsers.blocked')}</option>
          </Input>
        </div>

        {isPending ? (
          <ListSkeleton rows={4} />
        ) : isError ? (
          <ErrorState error={error} onRetry={refetch} />
        ) : items.length === 0 ? (
          <EmptyState icon={Users} title={t('adminUsers.emptyTitle')} body={t('admin.noBusinessesBody')} />
        ) : (
          <ul className="flex flex-col gap-3">
            {items.map((u) => {
              const self = u.id === me?.id;
              return (
                <li key={u.id} className="flex flex-col gap-2 rounded-card bg-white p-4 shadow-card ring-1 ring-brand-100">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-bold leading-snug">
                        {u.name} {self && <span className="text-sm font-normal text-ink-muted">({t('adminUsers.you')})</span>}
                      </p>
                      <p className="break-all text-sm text-ink-muted">{u.email ?? '-'}</p>
                      <p className="text-xs text-ink-soft">
                        {[t('adminUsers.joined', { date: formatDate(u.createdAt, i18n.language) }), u.signIn.map((s) => t(`adminUsers.signIn.${s}`)).join(', ')].filter(Boolean).join(' • ')}
                      </p>
                    </div>
                    <div className="flex shrink-0 flex-col items-end gap-1">
                      <Badge tone={u.role === 'admin' ? 'solid' : u.role === 'owner' ? 'green' : 'gray'}>{t(`roles.${u.role}`)}</Badge>
                      {u.status === 'blocked' && <Badge tone="red">{t('adminUsers.blocked')}</Badge>}
                    </div>
                  </div>
                  {!self && (
                    <div className="flex flex-wrap items-end gap-2">
                      <Input
                        as="select"
                        className="min-w-[9rem] flex-1"
                        label={t('adminUsers.changeRole')}
                        value={u.role}
                        onChange={(e) => setPending({ user: u, change: { role: e.target.value } })}
                      >
                        {ROLES.map((r) => (
                          <option key={r} value={r}>
                            {t(`roles.${r}`)}
                          </option>
                        ))}
                      </Input>
                      <Button
                        variant={u.status === 'blocked' ? 'secondary' : 'danger'}
                        onClick={() => setPending({ user: u, change: { status: u.status === 'blocked' ? 'active' : 'blocked' } })}
                        aria-label={`${t(u.status === 'blocked' ? 'adminUsers.unblock' : 'adminUsers.block')} - ${u.name}`}
                      >
                        {t(u.status === 'blocked' ? 'adminUsers.unblock' : 'adminUsers.block')}
                      </Button>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
        {data?.meta && <Pagination page={data.meta.page} totalPages={data.meta.totalPages} onChange={setPage} />}
      </div>

      <Modal
        open={Boolean(pending)}
        onClose={() => setPending(null)}
        title={t('adminUsers.confirmTitle')}
        footer={
          <>
            <Button variant="secondary" onClick={() => setPending(null)}>
              {t('common.cancel')}
            </Button>
            <Button
              variant={pending?.change.status === 'blocked' ? 'danger' : 'primary'}
              loading={update.isPending}
              onClick={() => update.mutate({ id: pending.user.id, change: pending.change })}
            >
              {t('adminUsers.confirm')}
            </Button>
          </>
        }
      >
        <p className="text-sm text-ink-muted">{confirmText}</p>
        {pending?.change.role === 'admin' && <p className="mt-2 rounded-lg bg-amber-50 p-2 text-sm text-amber-900">{t('adminUsers.adminWarning')}</p>}
      </Modal>
    </>
  );
}
