import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { SlidersHorizontal } from 'lucide-react';
import { useCategoryTree, categoryName } from '../../categories/api.js';
import { KINDS } from '../api.js';
import { Modal } from '../../../components/ui/Modal.jsx';
import { Button } from '../../../components/ui/Button.jsx';
import { ChipRow, RemovableChip, chip } from '../../../components/ui/Chips.jsx';
import { cn } from '../../../lib/cn.js';

// Shared chip style (also used by the news, community, events and offers pages).
export { chip };

/** Category chips, then sub-category chips once a category is chosen. */
function CategoryRows({ value, onChange }) {
  const { t, i18n } = useTranslation();
  const { tree } = useCategoryTree('business');
  const selectedMain = tree.find((m) => m.id === value.categoryId);
  if (!tree.length) return null;
  return (
    <>
      <ChipRow label={t('business.category')}>
        <button type="button" className={chip(!value.categoryId)} aria-pressed={!value.categoryId} onClick={() => onChange({ categoryId: undefined, subcategoryId: undefined })}>
          {t('business.allCategories')}
        </button>
        {tree.map((c) => (
          <button key={c.id} type="button" className={chip(value.categoryId === c.id)} aria-pressed={value.categoryId === c.id} onClick={() => onChange({ categoryId: c.id, subcategoryId: undefined })}>
            {categoryName(c, i18n.language)}
          </button>
        ))}
      </ChipRow>
      {selectedMain?.children.length > 0 && (
        <ChipRow label={t('form.subcategory')} className="pt-0">
          <button type="button" className={subChip(!value.subcategoryId)} aria-pressed={!value.subcategoryId} onClick={() => onChange({ subcategoryId: undefined })}>
            {t('business.allIn', { name: categoryName(selectedMain, i18n.language) })}
          </button>
          {selectedMain.children.map((c) => (
            <button key={c.id} type="button" className={subChip(value.subcategoryId === c.id)} aria-pressed={value.subcategoryId === c.id} onClick={() => onChange({ subcategoryId: c.id })}>
              {categoryName(c, i18n.language)}
            </button>
          ))}
        </ChipRow>
      )}
    </>
  );
}

/** Sub-category chips: lighter and smaller, so the two levels read as a hierarchy. */
const subChip = (active) =>
  cn(
    'inline-flex min-h-[36px] shrink-0 select-none items-center whitespace-nowrap rounded-full px-3.5 text-[13px] font-semibold transition duration-150 active:scale-[0.97]',
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2',
    active ? 'bg-primary-light text-primary-dark ring-1 ring-primary' : 'bg-transparent text-meta ring-1 ring-gray-200 hover:text-label hover:ring-primary/40',
  );

/**
 * Directory controls (business list and /food). Two tiers: the main choices as
 * chips (categories, or cuisines via `primary`), and everything else in a
 * "Filters" sheet, with the active ones shown as removable chips. `value` holds
 * the URL-backed filters; `onChange(patch)` updates them.
 */
export function BusinessFilters({ value, onChange, nearMe, fixedKind, primary, sheetExtras = [], total, loading }) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);

  // Filters kept in the sheet, each with its label and how to remove it.
  const sheetFilters = [
    ...(!fixedKind && value.kind ? [{ key: 'kind', label: t(`business.kinds.${value.kind}`), clear: { kind: undefined } }] : []),
    ...(value.openNow ? [{ key: 'openNow', label: t('business.openNow'), clear: { openNow: undefined } }] : []),
    ...(value.isVerified ? [{ key: 'isVerified', label: t('badge.verified'), clear: { isVerified: undefined } }] : []),
    ...sheetExtras.flatMap((x) => x.active(value)),
  ];
  const clearAll = Object.assign({}, ...sheetFilters.map((f) => f.clear));

  return (
    <div className="flex flex-col gap-2">
      {primary ?? (!fixedKind && <CategoryRows value={value} onChange={onChange} />)}

      <div className="flex items-center gap-2 pt-1">
        <button
          type="button"
          onClick={() => setOpen(true)}
          className={cn(chip(sheetFilters.length > 0), 'px-3.5')}
          aria-haspopup="dialog"
          aria-label={sheetFilters.length ? t('filters.buttonCount', { count: sheetFilters.length }) : t('filters.button')}
        >
          <SlidersHorizontal className="h-4 w-4" aria-hidden="true" />
          {t('filters.button')}
          {sheetFilters.length > 0 && (
            <span aria-hidden="true" className="ml-0.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-white px-1 text-xs font-bold text-primary">
              {sheetFilters.length}
            </span>
          )}
        </button>
        <label className="ml-auto flex min-w-0 items-center">
          <span className="sr-only">{t('business.sortBy')}</span>
          <select
            value={value.sort ?? (nearMe ? 'distance' : 'newest')}
            onChange={(e) => onChange({ sort: e.target.value })}
            className="min-h-[40px] max-w-full rounded-full bg-white pl-3.5 pr-8 text-sm font-semibold text-label ring-1 ring-gray-200 focus:outline-none focus:ring-2 focus:ring-primary"
          >
            {nearMe && <option value="distance">{t('business.sort.distance')}</option>}
            <option value="newest">{t('business.sort.newest')}</option>
            <option value="rating">{t('business.sort.rating')}</option>
          </select>
        </label>
      </div>

      <p className="min-h-5 text-sm text-meta" aria-live="polite">
        {!loading && total !== undefined ? t('business.count', { count: total }) : ''}
      </p>

      {sheetFilters.length > 0 && (
        <div className="flex flex-wrap gap-2" aria-label={t('filters.active')} role="group">
          {sheetFilters.map((f) => (
            <RemovableChip key={f.key} label={f.label} removeLabel={t('filters.remove', { name: f.label })} onRemove={() => onChange(f.clear)} />
          ))}
          {sheetFilters.length > 1 && (
            <button type="button" onClick={() => onChange(clearAll)} className="min-h-[36px] px-2 text-[13px] font-semibold text-primary hover:underline">
              {t('filters.clear')}
            </button>
          )}
        </div>
      )}

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={t('filters.title')}
        footer={
          <>
            <Button variant="secondary" onClick={() => onChange(clearAll)} disabled={!sheetFilters.length}>
              {t('filters.clear')}
            </Button>
            <Button onClick={() => setOpen(false)}>
              {loading || total === undefined ? t('filters.done') : t('filters.show', { count: total })}
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-5">
          {!fixedKind && (
            <section className="flex flex-col gap-2">
              <h3 className="text-sm font-bold text-heading">{t('business.kind')}</h3>
              <div role="group" aria-label={t('business.kind')} className="flex flex-wrap gap-2">
                <button type="button" className={chip(!value.kind)} aria-pressed={!value.kind} onClick={() => onChange({ kind: undefined })}>
                  {t('business.allKinds')}
                </button>
                {KINDS.map((k) => (
                  <button key={k} type="button" className={chip(value.kind === k)} aria-pressed={value.kind === k} onClick={() => onChange({ kind: k })}>
                    {t(`business.kinds.${k}`)}
                  </button>
                ))}
              </div>
            </section>
          )}
          <section className="flex flex-col gap-2">
            <h3 className="text-sm font-bold text-heading">{t('filters.showOnly')}</h3>
            <div className="flex flex-wrap gap-2">
              <button type="button" className={chip(value.openNow)} aria-pressed={Boolean(value.openNow)} onClick={() => onChange({ openNow: value.openNow ? undefined : 'true' })}>
                {t('business.openNow')}
              </button>
              <button type="button" className={chip(value.isVerified)} aria-pressed={Boolean(value.isVerified)} onClick={() => onChange({ isVerified: value.isVerified ? undefined : 'true' })}>
                {t('badge.verified')}
              </button>
            </div>
          </section>
          {sheetExtras.map((x) => (
            <section key={x.key} className="flex flex-col gap-2">
              <h3 className="text-sm font-bold text-heading">{x.title}</h3>
              {x.render(value, onChange)}
            </section>
          ))}
        </div>
      </Modal>
    </div>
  );
}
