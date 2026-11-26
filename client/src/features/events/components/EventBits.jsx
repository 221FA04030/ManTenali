import { useTranslation } from 'react-i18next';
import { Badge } from '../../../components/ui/Badge.jsx';
import { formatIsoDate, formatLocalTime } from '../../../lib/dates.js';
import { STATUS_TONE } from '../api.js';

/**
 * "Sat 30 Nov 2026 • 6:00 pm – 9:00 pm" from IST local strings returned by the API.
 * Multi-day: "30 Nov 2026 – 2 Dec 2026". All-day: dates only + "All day".
 */
export function EventWhen({ startLocal, endLocal, allDay }) {
  const { t, i18n } = useTranslation();
  const lang = i18n.language;
  const sd = startLocal.slice(0, 10);
  const ed = endLocal.slice(0, 10);
  const sameDay = sd === ed;
  if (allDay) {
    return (
      <span>
        {sameDay ? formatIsoDate(sd, lang) : `${formatIsoDate(sd, lang)} – ${formatIsoDate(ed, lang)}`} • {t('events.allDay')}
      </span>
    );
  }
  return (
    <span>
      {sameDay
        ? `${formatIsoDate(sd, lang)} • ${formatLocalTime(startLocal, lang)} – ${formatLocalTime(endLocal, lang)}`
        : `${formatIsoDate(sd, lang)}, ${formatLocalTime(startLocal, lang)} – ${formatIsoDate(ed, lang)}, ${formatLocalTime(endLocal, lang)}`}
    </span>
  );
}

/** Calendar-style date block: "30 / NOV" (IST date). */
export function DateBlock({ startLocal, muted = false, className = '' }) {
  const { i18n } = useTranslation();
  const [y, m, d] = startLocal.slice(0, 10).split('-').map(Number);
  const month = new Intl.DateTimeFormat(i18n.language === 'te' ? 'te-IN' : 'en-IN', { month: 'short', timeZone: 'UTC' }).format(
    new Date(Date.UTC(y, m - 1, d)),
  );
  return (
    <span className={`flex h-[72px] w-[64px] shrink-0 flex-col items-center justify-center rounded-2xl text-white ${muted ? 'bg-gray-500' : 'bg-brand-700'} ${className}`}>
      <span className="text-2xl font-bold leading-none">{d}</span>
      <span className="mt-1 text-xs font-semibold uppercase">{month}</span>
    </span>
  );
}

export function EventStatusBadge({ status }) {
  const { t } = useTranslation();
  return <Badge tone={STATUS_TONE[status] ?? 'gray'}>{t(`events.status.${status}`)}</Badge>;
}
