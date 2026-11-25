import { useTranslation } from 'react-i18next';
import { chip } from '../../businesses/components/BusinessFilters.jsx';
import { useCategories, categoryName } from '../../categories/api.js';

/** Category chips, date range (IST dates) and "show past events" for /events (FR-EVT-1). */
export function EventFilters({ value, onChange }) {
  const { t, i18n } = useTranslation();
  const { data: categories = [] } = useCategories('event');
  return (
    <div className="flex flex-col gap-3">
      {categories.length > 0 && (
        <div role="group" aria-label={t('business.category')} className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4">
          <button type="button" className={chip(!value.categoryId)} aria-pressed={!value.categoryId} onClick={() => onChange({ categoryId: undefined })}>
            {t('business.allCategories')}
          </button>
          {categories.map((c) => (
            <button
              key={c.id}
              type="button"
              className={chip(value.categoryId === c.id)}
              aria-pressed={value.categoryId === c.id}
              onClick={() => onChange({ categoryId: c.id })}
            >
              {categoryName(c, i18n.language)}
            </button>
          ))}
        </div>
      )}
      <div className="grid grid-cols-2 gap-2">
        <label className="flex flex-col gap-1 text-xs font-semibold text-ink-muted">
          {t('events.from')}
          <input
            type="date"
            value={value.from ?? ''}
            onChange={(e) => onChange({ from: e.target.value || undefined })}
            className="min-h-tap rounded-xl border border-brand-200 bg-white px-2 text-sm text-ink"
          />
        </label>
        <label className="flex flex-col gap-1 text-xs font-semibold text-ink-muted">
          {t('events.to')}
          <input
            type="date"
            value={value.to ?? ''}
            min={value.from}
            onChange={(e) => onChange({ to: e.target.value || undefined })}
            className="min-h-tap rounded-xl border border-brand-200 bg-white px-2 text-sm text-ink"
          />
        </label>
      </div>
      <label className="flex min-h-tap items-center gap-2 text-sm font-medium">
        <input
          type="checkbox"
          checked={value.includePast === 'true'}
          onChange={(e) => onChange({ includePast: e.target.checked ? 'true' : undefined })}
          className="h-5 w-5 accent-brand-700"
        />
        {t('events.showPast')}
      </label>
    </div>
  );
}
