import { Star } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { cn } from '../../../lib/cn.js';

/** Read-only stars with an accessible label ("4 out of 5 stars"). */
export function Stars({ value, size = 'sm', className }) {
  const { t } = useTranslation();
  const px = size === 'lg' ? 'h-5 w-5' : 'h-4 w-4';
  return (
    <span role="img" aria-label={t('reviews.starsLabel', { count: value })} className={cn('inline-flex items-center gap-0.5', className)}>
      {[1, 2, 3, 4, 5].map((n) => (
        <Star key={n} className={cn(px, n <= Math.round(value) ? 'fill-amber-400 text-amber-400' : 'text-gray-300')} aria-hidden="true" />
      ))}
    </span>
  );
}

/**
 * Star picker: a real radio group (keyboard arrows work), drawn as 44 px stars.
 * `value` 0 = none chosen.
 */
export function StarInput({ value, onChange, error, name = 'rating' }) {
  const { t } = useTranslation();
  return (
    <fieldset>
      <legend className="mb-1 text-sm font-semibold text-ink">{t('reviews.yourRating')} *</legend>
      <div className="flex gap-1">
        {[1, 2, 3, 4, 5].map((n) => (
          <label key={n} className="relative flex h-11 w-11 cursor-pointer items-center justify-center rounded-full hover:bg-amber-50">
            <input
              type="radio"
              name={name}
              value={n}
              checked={value === n}
              onChange={() => onChange(n)}
              className="peer absolute inset-0 cursor-pointer opacity-0"
              aria-label={t('reviews.starsLabel', { count: n })}
            />
            <Star
              className={cn('h-8 w-8 peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-brand-700', n <= value ? 'fill-amber-400 text-amber-400' : 'text-gray-300')}
              aria-hidden="true"
            />
          </label>
        ))}
      </div>
      {error && <p className="mt-1 text-sm text-red-700">{error}</p>}
    </fieldset>
  );
}
