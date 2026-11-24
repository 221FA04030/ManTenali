import { CircleAlert, RotateCw } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Button } from './Button.jsx';
import { errorMessageKey } from '../../lib/apiClient.js';
import { cn } from '../../lib/cn.js';

/** Error state with retry, matching the card style. */
export function ErrorState({ error, onRetry, title, className }) {
  const { t } = useTranslation();
  const message = error ? t(errorMessageKey(error)) : t('states.errorBody');
  return (
    <div
      role="alert"
      className={cn('flex flex-col items-center gap-3 rounded-card bg-white px-6 py-10 text-center shadow-card', className)}
    >
      <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-red-50 text-red-600">
        <CircleAlert className="h-7 w-7" aria-hidden="true" />
      </span>
      <h2 className="text-base font-bold text-ink">{title ?? t('states.errorTitle')}</h2>
      <p className="max-w-xs text-sm text-ink-muted">{message}</p>
      {onRetry && (
        <Button variant="secondary" onClick={onRetry}>
          <RotateCw className="h-4 w-4" aria-hidden="true" />
          {t('common.retry')}
        </Button>
      )}
    </div>
  );
}
