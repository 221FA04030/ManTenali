import { useTranslation } from 'react-i18next';
import { dayName } from './HoursTable.jsx';

const ORDER = [1, 2, 3, 4, 5, 6, 0];

/** Editor state: one row per weekday { day, closed, open, close }. */
export function hoursToRows(hours = []) {
  return ORDER.map((day) => {
    const slot = hours.find((h) => h.day === day);
    if (!slot) return { day, closed: false, open: '', close: '' };
    return { day, closed: Boolean(slot.closed), open: slot.open ?? '', close: slot.close ?? '' };
  });
}

/** Rows -> API payload. Days with no times and not closed are omitted ("not listed"). */
export function rowsToHours(rows) {
  return rows.flatMap((r) => {
    if (r.closed) return [{ day: r.day, closed: true }];
    if (r.open && r.close) return [{ day: r.day, open: r.open, close: r.close }];
    return [];
  });
}

export function HoursEditor({ rows, onChange }) {
  const { t, i18n } = useTranslation();
  const set = (i, patch) => onChange(rows.map((r, j) => (j === i ? { ...r, ...patch } : r)));
  const copyFirst = () => onChange(rows.map((r) => ({ ...r, closed: rows[0].closed, open: rows[0].open, close: rows[0].close })));

  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="mb-1 text-sm font-semibold text-ink">{t('business.hours')}</legend>
      <p className="text-xs text-ink-soft">{t('form.hoursHint')}</p>
      {rows.map((r, i) => (
        <div key={r.day} className="grid grid-cols-[4.5rem_1fr_1fr_auto] items-center gap-2">
          <span className="text-sm font-medium">{dayName(r.day, i18n.language, 'short')}</span>
          <input
            type="time"
            aria-label={`${dayName(r.day, i18n.language)} ${t('form.opens')}`}
            value={r.open}
            disabled={r.closed}
            onChange={(e) => set(i, { open: e.target.value })}
            className="min-h-tap min-w-0 rounded-xl border border-brand-200 px-2 text-sm disabled:opacity-50"
          />
          <input
            type="time"
            aria-label={`${dayName(r.day, i18n.language)} ${t('form.closes')}`}
            value={r.close}
            disabled={r.closed}
            onChange={(e) => set(i, { close: e.target.value })}
            className="min-h-tap min-w-0 rounded-xl border border-brand-200 px-2 text-sm disabled:opacity-50"
          />
          <label className="flex min-h-tap items-center gap-1.5 text-sm">
            <input type="checkbox" checked={r.closed} onChange={(e) => set(i, { closed: e.target.checked })} className="h-4 w-4 accent-brand-700" />
            {t('business.closed')}
          </label>
        </div>
      ))}
      <button type="button" onClick={copyFirst} className="self-start text-sm font-semibold text-brand-700 hover:underline">
        {t('form.copyMonday')}
      </button>
    </fieldset>
  );
}
