import { useTranslation } from 'react-i18next';
import { Plus, Trash2 } from 'lucide-react';
import { Input } from '../../../components/ui/Input.jsx';
import { Button } from '../../../components/ui/Button.jsx';
import { FOOD_CUISINES, MAX_CUISINES, PRICE_RANGES } from '../../../config/cuisines.js';
import { cn } from '../../../lib/cn.js';

export const emptyItem = () => ({ name: '', price: '', isVeg: true });
export const emptySection = () => ({ section: '', items: [emptyItem()] });

/** API food -> editor state (prices as strings for inputs). */
export function foodToState(b) {
  return {
    priceRange: b?.priceRange ? String(b.priceRange) : '',
    cuisines: b?.food?.cuisines ?? [],
    isVegFriendly: Boolean(b?.food?.isVegFriendly),
    menu: (b?.food?.menu ?? []).map((s) => ({
      section: s.section,
      items: s.items.map((i) => ({ name: i.name, price: String(i.price), isVeg: Boolean(i.isVeg) })),
    })),
  };
}

/** Editor state -> API fields { priceRange, food }. Blank menu rows are dropped. */
export function stateToFood(s) {
  const menu = s.menu
    .map((sec) => ({
      section: sec.section.trim(),
      items: sec.items
        .filter((i) => i.name.trim() || String(i.price).trim())
        .map((i) => ({ name: i.name.trim(), price: Number(i.price), isVeg: Boolean(i.isVeg) })),
    }))
    .filter((sec) => sec.section || sec.items.length);
  return {
    priceRange: s.priceRange ? Number(s.priceRange) : null,
    food: { cuisines: s.cuisines, isVegFriendly: s.isVegFriendly, menu },
  };
}

/** Returns an error key or null for the food part of the form. */
export function validateFood(s) {
  const { food } = stateToFood(s);
  for (const sec of food.menu) {
    if (!sec.section) return 'food.v.section';
    if (!sec.items.length) return 'food.v.items';
    for (const i of sec.items) {
      if (!i.name) return 'food.v.itemName';
      if (!Number.isFinite(i.price) || i.price < 0 || i.price > 100000) return 'food.v.price';
    }
  }
  return null;
}

/** Price range, cuisines, veg-friendly and an editable menu (FR-FOOD-1). */
export function FoodFieldsEditor({ value, onChange, error }) {
  const { t } = useTranslation();
  const set = (patch) => onChange({ ...value, ...patch });
  const setSection = (si, patch) => set({ menu: value.menu.map((s, j) => (j === si ? { ...s, ...patch } : s)) });
  const setItem = (si, ii, patch) =>
    setSection(si, { items: value.menu[si].items.map((it, j) => (j === ii ? { ...it, ...patch } : it)) });
  const toggleCuisine = (c) => {
    const has = value.cuisines.includes(c);
    if (!has && value.cuisines.length >= MAX_CUISINES) return;
    set({ cuisines: has ? value.cuisines.filter((x) => x !== c) : [...value.cuisines, c] });
  };

  return (
    <div className="flex flex-col gap-4">
      <h2 className="text-base font-bold">{t('food.details')}</h2>
      <Input as="select" label={t('food.priceRange')} value={value.priceRange} onChange={(e) => set({ priceRange: e.target.value })}>
        <option value="">{t('form.choose')}</option>
        {PRICE_RANGES.map((p) => (
          <option key={p} value={p}>
            {'₹'.repeat(p)} - {t(`food.price.${p}`)}
          </option>
        ))}
      </Input>

      <fieldset>
        <legend className="mb-2 text-sm font-semibold">{t('food.cuisinesLabel', { max: MAX_CUISINES })}</legend>
        <div className="flex flex-wrap gap-2">
          {FOOD_CUISINES.map((c) => {
            const on = value.cuisines.includes(c);
            return (
              <button
                key={c}
                type="button"
                aria-pressed={on}
                onClick={() => toggleCuisine(c)}
                disabled={!on && value.cuisines.length >= MAX_CUISINES}
                className={cn(
                  'min-h-[40px] rounded-full px-3 text-sm font-medium ring-1 disabled:opacity-40',
                  on ? 'bg-brand-700 text-white ring-brand-700' : 'bg-white text-ink ring-brand-200 hover:bg-brand-50',
                )}
              >
                {t(`cuisines.${c}`)}
              </button>
            );
          })}
        </div>
      </fieldset>

      <label className="flex min-h-tap items-center gap-2 text-[15px]">
        <input
          type="checkbox"
          checked={value.isVegFriendly}
          onChange={(e) => set({ isVegFriendly: e.target.checked })}
          className="h-5 w-5 accent-brand-700"
        />
        {t('food.vegFriendlyLabel')}
      </label>

      <fieldset className="flex flex-col gap-3">
        <legend className="mb-1 text-sm font-semibold">{t('food.menu')}</legend>
        <p className="text-xs text-ink-soft">{t('food.menuHint')}</p>
        {value.menu.map((sec, si) => (
          <div key={si} className="flex flex-col gap-2 rounded-2xl bg-brand-50 p-3">
            <div className="flex items-end gap-2">
              <Input
                className="flex-1"
                label={t('food.sectionName', { n: si + 1 })}
                placeholder={t('food.sectionPlaceholder')}
                maxLength={60}
                value={sec.section}
                onChange={(e) => setSection(si, { section: e.target.value })}
              />
              <button
                type="button"
                onClick={() => set({ menu: value.menu.filter((_, j) => j !== si) })}
                aria-label={t('food.removeSection', { n: si + 1 })}
                className="flex min-h-tap min-w-tap items-center justify-center rounded-full text-red-700 hover:bg-red-50"
              >
                <Trash2 className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>
            {sec.items.map((item, ii) => (
              <div key={ii} className="grid grid-cols-[1fr_5.5rem_auto_auto] items-center gap-2">
                <input
                  aria-label={t('food.itemName', { n: ii + 1 })}
                  placeholder={t('food.itemPlaceholder')}
                  maxLength={80}
                  value={item.name}
                  onChange={(e) => setItem(si, ii, { name: e.target.value })}
                  className="min-h-tap min-w-0 rounded-xl border border-brand-200 bg-white px-3 text-sm"
                />
                <input
                  aria-label={t('food.itemPrice', { n: ii + 1 })}
                  placeholder="₹"
                  type="number"
                  inputMode="decimal"
                  min={0}
                  value={item.price}
                  onChange={(e) => setItem(si, ii, { price: e.target.value })}
                  className="min-h-tap min-w-0 rounded-xl border border-brand-200 bg-white px-2 text-sm"
                />
                <label className="flex min-h-tap items-center gap-1 text-xs">
                  <input
                    type="checkbox"
                    checked={item.isVeg}
                    onChange={(e) => setItem(si, ii, { isVeg: e.target.checked })}
                    className="h-4 w-4 accent-green-700"
                  />
                  {t('food.veg')}
                </label>
                <button
                  type="button"
                  onClick={() => setSection(si, { items: sec.items.filter((_, j) => j !== ii) })}
                  aria-label={t('food.removeItem', { n: ii + 1 })}
                  className="flex min-h-tap min-w-[36px] items-center justify-center rounded-full text-ink-muted hover:bg-white"
                >
                  <Trash2 className="h-4 w-4" aria-hidden="true" />
                </button>
              </div>
            ))}
            <button
              type="button"
              onClick={() => setSection(si, { items: [...sec.items, emptyItem()] })}
              className="inline-flex min-h-tap items-center gap-1 self-start text-sm font-semibold text-brand-700"
            >
              <Plus className="h-4 w-4" aria-hidden="true" /> {t('food.addItem')}
            </button>
          </div>
        ))}
        <Button variant="soft" size="sm" className="self-start" onClick={() => set({ menu: [...value.menu, emptySection()] })}>
          <Plus className="h-4 w-4" aria-hidden="true" /> {t('food.addSection')}
        </Button>
        {error && (
          <p role="alert" className="text-sm text-red-700">
            {error}
          </p>
        )}
      </fieldset>
    </div>
  );
}
