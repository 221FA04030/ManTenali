import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { UserCheck, X } from 'lucide-react';
import { api } from '../../../lib/apiClient.js';
import { Input } from '../../../components/ui/Input.jsx';

/** Admin-only: search users and assign one as the business owner. */
export function OwnerPicker({ value, onChange }) {
  const { t } = useTranslation();
  const [q, setQ] = useState('');
  const search = q.trim();
  const { data: users = [], isFetching } = useQuery({
    queryKey: ['admin', 'users', 'picker', search],
    queryFn: () => api.get('/admin/users', { query: { q: search, status: 'active', limit: 8 } }).then((r) => r.data),
    enabled: search.length >= 2,
  });

  return (
    <div className="flex flex-col gap-2">
      <span className="text-sm font-semibold text-ink">{t('form.owner')}</span>
      {value ? (
        <div className="flex items-center justify-between gap-2 rounded-xl bg-brand-50 px-3 py-2">
          <span className="flex min-w-0 items-center gap-2 text-sm">
            <UserCheck className="h-4 w-4 shrink-0 text-brand-700" aria-hidden="true" />
            <span className="truncate">{value.name ?? t('form.ownerAssigned')}</span>
            {value.email && <span className="truncate text-ink-soft">{value.email}</span>}
          </span>
          <button
            type="button"
            onClick={() => onChange(null)}
            className="flex min-h-tap min-w-tap items-center justify-center rounded-full text-ink-muted hover:bg-white"
            aria-label={t('form.removeOwner')}
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
      ) : (
        <p className="text-xs text-ink-soft">{t('form.noOwner')}</p>
      )}
      <Input
        label={t('form.findOwner')}
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder={t('form.findOwnerPlaceholder')}
        hint={t('form.ownerHint')}
      />
      {search.length >= 2 && (
        <ul className="flex flex-col gap-1" aria-busy={isFetching}>
          {users.map((u) => (
            <li key={u.id}>
              <button
                type="button"
                onClick={() => {
                  onChange({ id: u.id, name: u.name, email: u.email });
                  setQ('');
                }}
                className="flex min-h-tap w-full items-center justify-between rounded-xl px-3 text-left text-sm hover:bg-brand-50"
              >
                <span className="truncate font-medium">{u.name}</span>
                <span className="truncate text-xs text-ink-soft">{u.email}</span>
              </button>
            </li>
          ))}
          {!isFetching && users.length === 0 && <li className="px-3 text-sm text-ink-soft">{t('form.noUsersFound')}</li>}
        </ul>
      )}
    </div>
  );
}
