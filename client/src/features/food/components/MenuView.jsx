import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { formatINR } from '../../../lib/format.js';
import { VegMark } from './FoodBits.jsx';

/** Menu with sections, INR prices and veg/non-veg markers (FR-FOOD-1). */
export function MenuView({ menu }) {
  const { t, i18n } = useTranslation();
  const [vegOnly, setVegOnly] = useState(false);
  if (!menu?.length) return <p className="text-sm text-ink-muted">{t('food.noMenu')}</p>;

  const hasNonVeg = menu.some((s) => s.items.some((i) => !i.isVeg));
  const sections = menu
    .map((s) => ({ ...s, items: vegOnly ? s.items.filter((i) => i.isVeg) : s.items }))
    .filter((s) => s.items.length > 0);

  return (
    <div className="flex flex-col gap-4">
      {hasNonVeg && (
        <label className="flex min-h-tap items-center gap-2 self-start text-sm font-medium">
          <input type="checkbox" checked={vegOnly} onChange={(e) => setVegOnly(e.target.checked)} className="h-4 w-4 accent-brand-700" />
          {t('food.vegOnly')}
        </label>
      )}
      {sections.map((s, si) => (
        <section key={`${s.section}-${si}`} aria-label={s.section}>
          <h3 className="mb-1.5 text-sm font-bold uppercase tracking-wide text-brand-800">{s.section}</h3>
          <ul className="divide-y divide-brand-50">
            {s.items.map((item, ii) => (
              <li key={`${item.name}-${ii}`} className="flex items-center gap-3 py-2">
                <VegMark isVeg={item.isVeg} />
                <span className="flex-1 text-[15px]">{item.name}</span>
                <span className="font-semibold tabular-nums">{formatINR(item.price, i18n.language)}</span>
              </li>
            ))}
          </ul>
        </section>
      ))}
      <p className="text-xs text-ink-soft">{t('food.menuNote')}</p>
    </div>
  );
}
