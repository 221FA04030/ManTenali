import { useTranslation } from 'react-i18next';
import { useCategoryTree, categoryName } from '../../categories/api.js';
import { KINDS } from '../api.js';
import { cn } from '../../../lib/cn.js';

const chip = (active) =>
  cn(
    'inline-flex min-h-[40px] shrink-0 items-center rounded-full px-3.5 text-sm font-medium ring-1 transition-colors',
    active ? 'bg-brand-700 text-white ring-brand-700' : 'bg-white text-ink ring-brand-200 hover:bg-brand-50',
  );

/**
 * Filters for the business list. `value` holds URL-backed filters;
 * `onChange(patch)` updates them. `nearMe` enables distance sorting.
 */
export function BusinessFilters({ value, onChange, nearMe, hideKind }) {
  const { t, i18n } = useTranslation();
  const { tree } = useCategoryTree('business');
  const selectedMain = tree.find((m) => m.id === value.categoryId);

  return (
    <div className="flex flex-col gap-3">
      {!hideKind && (
        <div role="group" aria-label={t('business.kind')} className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4">
          <button type="button" className={chip(!value.kind)} aria-pressed={!value.kind} onClick={() => onChange({ kind: undefined })}>
            {t('business.allKinds')}
          </button>
          {KINDS.map((k) => (
            <button key={k} type="button" className={chip(value.kind === k)} aria-pressed={value.kind === k} onClick={() => onChange({ kind: k })}>
              {t(`business.kinds.${k}`)}
            </button>
          ))}
        </div>
      )}

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
          <button
            type="button"
            className={chip(!value.subcategoryId)}
            aria-pressed={!value.subcategoryId}
            onClick={() => onChange({ subcategoryId: undefined })}
          >
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

      <div className="flex flex-wrap items-center gap-2">
        <button type="button" className={chip(value.openNow)} aria-pressed={Boolean(value.openNow)} onClick={() => onChange({ openNow: value.openNow ? undefined : 'true' })}>
          {t('business.openNow')}
        </button>
        <button
          type="button"
          className={chip(value.isVerified)}
          aria-pressed={Boolean(value.isVerified)}
          onClick={() => onChange({ isVerified: value.isVerified ? undefined : 'true' })}
        >
          {t('badge.verified')}
        </button>
        <label className="ml-auto flex items-center gap-2 text-sm text-ink-muted">
          {t('business.sortBy')}
          <select
            value={value.sort ?? (nearMe ? 'distance' : 'newest')}
            onChange={(e) => onChange({ sort: e.target.value })}
            className="min-h-[40px] rounded-full bg-white px-3 text-sm font-medium text-ink ring-1 ring-brand-200"
          >
            {nearMe && <option value="distance">{t('business.sort.distance')}</option>}
            <option value="newest">{t('business.sort.newest')}</option>
            <option value="rating">{t('business.sort.rating')}</option>
          </select>
        </label>
      </div>
    </div>
  );
}
