import { useState } from 'react';
import { Search } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { cn } from '../../lib/cn.js';

/**
 * Rounded white search pill. Voice input is intentionally omitted in Phase 1
 * (spec section 11). Calls onSubmit(query) with the trimmed text and the
 * optional onChange(text) while typing (search suggestions).
 */
export function SearchBar({ defaultValue = '', onSubmit, onChange, autoFocus, className }) {
  const { t } = useTranslation();
  const [value, setValue] = useState(defaultValue);
  return (
    <form
      role="search"
      className={cn(
        'flex min-h-[52px] items-center gap-3 rounded-full bg-white px-5 shadow-lift ring-1 ring-brand-100',
        className,
      )}
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit?.(value.trim());
      }}
    >
      <Search className="h-5 w-5 shrink-0 text-brand-800" aria-hidden="true" />
      <label className="sr-only" htmlFor="mt-search">
        {t('search.label')}
      </label>
      <input
        id="mt-search"
        type="search"
        value={value}
        onChange={(e) => {
          setValue(e.target.value);
          onChange?.(e.target.value);
        }}
        placeholder={t('search.placeholder')}
        autoFocus={autoFocus}
        enterKeyHint="search"
        autoComplete="off"
        className="min-w-0 flex-1 bg-transparent py-3 text-[15px] text-ink placeholder:text-ink-muted focus:outline-none"
      />
      <button type="submit" className="sr-only">
        {t('search.submit')}
      </button>
    </form>
  );
}
