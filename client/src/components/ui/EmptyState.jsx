import { Inbox } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { cn } from '../../lib/cn.js';

export function EmptyState({ icon: Icon = Inbox, title, body, action, className }) {
  const { t } = useTranslation();
  return (
    <div
      className={cn(
        'flex flex-col items-center gap-3 rounded-card bg-white px-6 py-10 text-center shadow-card',
        className,
      )}
    >
      <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-100 text-brand-700">
        <Icon className="h-7 w-7" aria-hidden="true" />
      </span>
      <h2 className="text-base font-bold text-ink">{title ?? t('states.emptyTitle')}</h2>
      <p className="max-w-xs text-sm text-ink-muted">{body ?? t('states.emptyBody')}</p>
      {action}
    </div>
  );
}
