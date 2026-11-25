import { useTranslation } from 'react-i18next';
import { chip } from '../../businesses/components/BusinessFilters.jsx';
import { useCategoryTree, categoryName } from '../../categories/api.js';

/** Category / subcategory chips and sort for the offers feed. */
export function OffersFilters({ value, onChange }) {
  const { t, i18n } = useTranslation();
  const { tree } = useCategoryTree('business');
  const selectedMain = tree.find((m) => m.id === value.categoryId);

  return (
    <div className="flex flex-col gap-3">
      {tree.length > 0 && (
        <div role="group" aria-label={t('business.category')} className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4">
          <button
            type="button"
            className={chip(!value.categoryId)}
            aria-pressed={!value.categoryId}
            onClick={() => onChange({ categoryId: undefined, subcategoryId: undefined })}
          >
            {t('business.allCategories')}
          </button>
          {tree.map((c) => (
            <button
              key={c.id}
              type="button"
              className={chip(value.categoryId === c.id)}
              aria-pressed={value.categoryId === c.id}
              onClick={() => onChange({ categoryId: c.id, subcategoryId: undefined })}
            >
              {categoryName(c, i18n.language)}
            </button>
          ))}
        </div>
      )}
      {selectedMain?.children.length > 0 && (
        <div role="group" aria-label={t('form.subcategory')} className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4">
          <button type="button" className={chip(!value.subcategoryId)} aria-pressed={!value.subcategoryId} onClick={() => onChange({ subcategoryId: undefined })}>
            {t('business.allIn', { name: categoryName(selectedMain, i18n.language) })}
          </button>
          {selectedMain.children.map((c) => (
            <button
              key={c.id}
              type="button"
              className={chip(value.subcategoryId === c.id)}
              aria-pressed={value.subcategoryId === c.id}
              onClick={() => onChange({ subcategoryId: c.id })}
            >
              {categoryName(c, i18n.language)}
            </button>
          ))}
        </div>
      )}
      <label className="flex items-center justify-end gap-2 text-sm text-ink-muted">
        {t('business.sortBy')}
        <select
          value={value.sort ?? 'endingSoon'}
          onChange={(e) => onChange({ sort: e.target.value === 'endingSoon' ? undefined : e.target.value })}
          className="min-h-[40px] rounded-full bg-white px-3 text-sm font-medium text-ink ring-1 ring-brand-200"
        >
          <option value="endingSoon">{t('offers.sort.endingSoon')}</option>
          <option value="newest">{t('offers.sort.newest')}</option>
        </select>
      </label>
    </div>
  );
}
