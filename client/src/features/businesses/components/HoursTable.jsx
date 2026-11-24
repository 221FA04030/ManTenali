import { useTranslation } from 'react-i18next';
import { cn } from '../../../lib/cn.js';
import { TIME_ZONE } from '../../../lib/format.js';

const ORDER = [1, 2, 3, 4, 5, 6, 0]; // Monday first

export function dayName(day, lang, style = 'long') {
  // 2023-01-01 was a Sunday (day 0).
  const date = new Date(Date.UTC(2023, 0, 1 + day, 12));
  return new Intl.DateTimeFormat(lang === 'te' ? 'te-IN' : 'en-IN', { weekday: style, timeZone: 'UTC' }).format(date);
}

export function todayInTenali(now = new Date()) {
  const wd = new Intl.DateTimeFormat('en-US', { weekday: 'short', timeZone: TIME_ZONE }).format(now);
  return ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(wd);
}

/** 24h "HH:MM" -> localized short time (e.g. 9:00 am). */
function formatHHMM(hhmm, lang) {
  const [h, m] = hhmm.split(':').map(Number);
  return new Intl.DateTimeFormat(lang === 'te' ? 'te-IN' : 'en-IN', { hour: 'numeric', minute: '2-digit', timeZone: 'UTC' }).format(
    new Date(Date.UTC(2023, 0, 1, h, m)),
  );
}

export function HoursTable({ hours }) {
  const { t, i18n } = useTranslation();
  const today = todayInTenali();
  if (!hours?.length) return <p className="text-sm text-ink-muted">{t('business.hoursUnknown')}</p>;
  return (
    <table className="w-full text-sm">
      <caption className="sr-only">{t('business.hours')}</caption>
      <tbody>
        {ORDER.map((day) => {
          const slots = hours.filter((h) => h.day === day);
          const text = !slots.length
            ? '—'
            : slots.every((s) => s.closed)
              ? t('business.closed')
              : slots
                  .filter((s) => !s.closed)
                  .map((s) => `${formatHHMM(s.open, i18n.language)} – ${formatHHMM(s.close, i18n.language)}`)
                  .join(', ');
          return (
            <tr key={day} className={cn('border-b border-brand-50 last:border-0', day === today && 'font-semibold text-brand-800')}>
              <th scope="row" className="py-2 pr-3 text-left font-medium">
                {dayName(day, i18n.language)}
                {day === today && <span className="sr-only"> ({t('business.today')})</span>}
              </th>
              <td className="py-2 text-right">{text}</td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
