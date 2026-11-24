import { useTranslation } from 'react-i18next';
import { Leaf } from 'lucide-react';
import { chip } from '../../businesses/components/BusinessFilters.jsx';
import { FOOD_CUISINES, PRICE_RANGES } from '../../../config/cuisines.js';

/** Cuisine, price range and veg-friendly filters for /food (FR-FOOD-2). */
export function FoodFilters({ value, onChange }) {
  const { t } = useTranslation();
  return (
    <>
      <div role="group" aria-label={t('food.cuisine')} className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4">
        <button type="button" className={chip(!value.cuisine)} aria-pressed={!value.cuisine} onClick={() => onChange({ cuisine: undefined })}>
          {t('food.allCuisines')}
        </button>
        {FOOD_CUISINES.map((c) => (
          <button key={c} type="button" className={chip(value.cuisine === c)} aria-pressed={value.cuisine === c} onClick={() => onChange({ cuisine: c })}>
            {t(`cuisines.${c}`)}
          </button>
        ))}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <div role="group" aria-label={t('food.priceRange')} className="flex gap-1.5">
          {PRICE_RANGES.map((p) => {
            const active = value.priceRange === String(p);
            return (
              <button
                key={p}
                type="button"
                className={chip(active)}
                aria-pressed={active}
                aria-label={t(`food.price.${p}`)}
                onClick={() => onChange({ priceRange: active ? undefined : String(p) })}
              >
                {'₹'.repeat(p)}
              </button>
            );
          })}
        </div>
        <button
          type="button"
          className={chip(value.isVegFriendly === 'true')}
          aria-pressed={value.isVegFriendly === 'true'}
          onClick={() => onChange({ isVegFriendly: value.isVegFriendly === 'true' ? undefined : 'true' })}
        >
          <Leaf className="mr-1 h-4 w-4" aria-hidden="true" />
          {t('food.vegFriendly')}
        </button>
      </div>
    </>
  );
}
