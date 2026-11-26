import { useSyncExternalStore } from 'react';
import { WifiOff } from 'lucide-react';
import { useTranslation } from 'react-i18next';

function subscribe(onChange) {
  window.addEventListener('online', onChange);
  window.addEventListener('offline', onChange);
  return () => {
    window.removeEventListener('online', onChange);
    window.removeEventListener('offline', onChange);
  };
}
const isOnline = () => navigator.onLine !== false;

/**
 * Calm notice when the phone loses its connection, so failed loads aren't
 * mistaken for a broken app. Pages already loaded stay readable; when the
 * connection returns, data refreshes by itself (TanStack Query refetches on
 * reconnect) and the notice disappears.
 */
export function OfflineBanner() {
  const { t } = useTranslation();
  const online = useSyncExternalStore(subscribe, isOnline, () => true);
  return (
    <div role="status" aria-live="polite" className="pointer-events-none fixed inset-x-0 bottom-[calc(5.5rem+env(safe-area-inset-bottom))] z-[45] flex justify-center px-3">
      {!online && (
        <p className="pointer-events-auto flex max-w-app items-start gap-2 rounded-2xl bg-ink px-4 py-3 text-sm text-white shadow-lift">
          <WifiOff className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          <span>
            <strong className="font-semibold">{t('offline.title')}</strong> {t('offline.body')}
          </span>
        </p>
      )}
    </div>
  );
}
