import { useTranslation } from 'react-i18next';
import { Leaf } from 'lucide-react';
import { ChipRow, chip } from '../../../components/ui/Chips.jsx';
import { FOOD_CUISINES, PRICE_RANGES } from '../../../config/cuisines.js';

/** /food main choice: cuisine chips (FR-FOOD-2). */
export function FoodCuisineRow({ value, onChange }) {
  const { t } = useTranslation();
  return (
    <ChipRow label={t('food.cuisine')}>
      <button type="button" className={chip(!value.cuisine)} aria-pressed={!value.cuisine} onClick={() => onChange({ cuisine: undefined })}>
        {t('food.allCuisines')}
      </button>
      {FOOD_CUISINES.map((c) => (
        <button key={c} type="button" className={chip(value.cuisine === c)} aria-pressed={value.cuisine === c} onClick={() => onChange({ cuisine: c })}>
          {t(`cuisines.${c}`)}
        </button>
      ))}
    </ChipRow>
  );
}

/** Price range and veg-friendly, shown in the Filters sheet on /food (FR-FOOD-2). */
export function useFoodSheetFilters() {
  const { t } = useTranslation();
  return [
    {
      key: 'price',
      title: t('food.priceRange'),
      active: (v) => (v.priceRange ? [{ key: 'priceRange', label: t(`food.price.${v.priceRange}`), clear: { priceRange: undefined } }] : []),
      render: (value, onChange) => (
        <div role="group" aria-label={t('food.priceRange')} className="flex flex-wrap gap-2">
          {PRICE_RANGES.map((p) => {
            const active = value.priceRange === String(p);
            return (
              <button key={p} type="button" className={chip(active)} aria-pressed={active} aria-label={t(`food.price.${p}`)} onClick={() => onChange({ priceRange: active ? undefined : String(p) })}>
                <span aria-hidden="true">{'₹'.repeat(p)}</span>
                <span aria-hidden="true" className="font-medium opacity-80">
                  {t(`food.price.${p}`)}
                </span>
              </button>
            );
          })}
        </div>
      ),
    },
    {
      key: 'veg',
      title: t('food.dietLabel'),
      active: (v) => (v.isVegFriendly === 'true' ? [{ key: 'isVegFriendly', label: t('food.vegFriendly'), clear: { isVegFriendly: undefined } }] : []),
      render: (value, onChange) => (
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            className={chip(value.isVegFriendly === 'true')}
            aria-pressed={value.isVegFriendly === 'true'}
            onClick={() => onChange({ isVegFriendly: value.isVegFriendly === 'true' ? undefined : 'true' })}
          >
            <Leaf className="h-4 w-4" aria-hidden="true" />
            {t('food.vegFriendly')}
          </button>
        </div>
      ),
    },
  ];
}
