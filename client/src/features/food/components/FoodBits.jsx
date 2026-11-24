import { Leaf } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Badge } from '../../../components/ui/Badge.jsx';
import { cn } from '../../../lib/cn.js';

/** "₹₹" with the unused rupee signs dimmed, plus an accessible label. */
export function PriceRange({ value, className }) {
  const { t } = useTranslation();
  if (!value) return null;
  return (
    <span className={cn('inline-flex shrink-0 items-center whitespace-nowrap font-semibold', className)} title={t(`food.price.${value}`)}>
      <span className="sr-only">{t(`food.price.${value}`)}</span>
      <span aria-hidden="true">
        {[1, 2, 3].map((n) => (
          <span key={n} className={n <= value ? 'text-brand-800' : 'text-ink-soft/40'}>
            ₹
          </span>
        ))}
      </span>
    </span>
  );
}

export function VegFriendlyBadge() {
  const { t } = useTranslation();
  return (
    <Badge tone="green" icon={Leaf}>
      {t('food.vegFriendly')}
    </Badge>
  );
}

/** Indian food-label style marker: green square-dot = veg, red = non-veg. */
export function VegMark({ isVeg }) {
  const { t } = useTranslation();
  return (
    <span
      role="img"
      aria-label={isVeg ? t('food.veg') : t('food.nonVeg')}
      title={isVeg ? t('food.veg') : t('food.nonVeg')}
      className={cn(
        'inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-[3px] border-2',
        isVeg ? 'border-green-700' : 'border-red-700',
      )}
    >
      <span className={cn('h-1.5 w-1.5 rounded-full', isVeg ? 'bg-green-700' : 'bg-red-700')} />
    </span>
  );
}

/** "South Indian, Andhra" in the current language. */
export function useCuisineLabels() {
  const { t } = useTranslation();
  return (cuisines = []) => cuisines.map((c) => t(`cuisines.${c}`)).join(', ');
}
