import { useTranslation } from 'react-i18next';
import { Input } from '../../../components/ui/Input.jsx';
import { useCategoryTree, categoryName } from '../api.js';

/**
 * Main category + subcategory selects. Subcategory options are filtered by
 * the selected main category; changing the main category clears the sub.
 */
export function CategoryPicker({ categoryId, subcategoryId, onChange, errors = {} }) {
  const { t, i18n } = useTranslation();
  const { tree, isPending } = useCategoryTree('business');
  const main = tree.find((m) => m.id === categoryId);
  const subs = main?.children ?? [];

  return (
    <div className="flex flex-col gap-4">
      <Input
        as="select"
        label={t('form.mainCategory')}
        value={categoryId}
        disabled={isPending}
        error={errors.categoryId}
        onChange={(e) => onChange({ categoryId: e.target.value, subcategoryId: '' })}
      >
        <option value="">{t('form.choose')}</option>
        {tree.map((m) => (
          <option key={m.id} value={m.id}>
            {categoryName(m, i18n.language)}
          </option>
        ))}
      </Input>
      <Input
        as="select"
        label={t('form.subcategory')}
        value={subcategoryId}
        disabled={!main || subs.length === 0}
        hint={!main ? t('form.subcategoryHint') : undefined}
        error={errors.subcategoryId}
        onChange={(e) => onChange({ categoryId, subcategoryId: e.target.value })}
      >
        <option value="">{t('form.choose')}</option>
        {subs.map((s) => (
          <option key={s.id} value={s.id}>
            {categoryName(s, i18n.language)}
          </option>
        ))}
      </Input>
    </div>
  );
}
