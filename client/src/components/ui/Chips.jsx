import { useEffect, useRef } from 'react';
import { X } from 'lucide-react';
import { cn } from '../../lib/cn.js';

/**
 * The one chip style for inside pages (filters, categories, types): 40px tall,
 * filled green when selected, white with a light ring otherwise; hover, pressed
 * and keyboard-focus states included.
 */
export const chip = (active) =>
  cn(
    'inline-flex min-h-[40px] shrink-0 select-none items-center gap-1.5 whitespace-nowrap rounded-full px-4 text-sm font-semibold transition duration-150 active:scale-[0.97]',
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2',
    active
      ? 'bg-primary text-white shadow-sm ring-1 ring-primary hover:bg-primary-dark'
      : 'bg-white text-label ring-1 ring-gray-200 hover:bg-primary-light/60 hover:ring-primary/40',
  );

/**
 * A sideways-scrolling row of chips (a labelled group). The selected chip is
 * scrolled into view, so a choice made on another screen (e.g. "Shopping" from
 * Home) is never hidden off the edge.
 */
export function ChipRow({ label, children, className }) {
  const ref = useRef(null);
  useEffect(() => {
    const active = ref.current?.querySelector('[aria-pressed="true"]');
    active?.scrollIntoView?.({ block: 'nearest', inline: 'center' });
  });
  return (
    <div ref={ref} role="group" aria-label={label} className={cn('no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4 py-1', className)}>
      {children}
    </div>
  );
}

/** A selected filter shown as a small removable chip ("Open now ×"). */
export function RemovableChip({ label, removeLabel, onRemove }) {
  return (
    <button
      type="button"
      onClick={onRemove}
      aria-label={removeLabel}
      className="inline-flex min-h-[36px] items-center gap-1 rounded-full bg-primary-light px-3 text-[13px] font-semibold text-primary-dark ring-1 ring-primary/20 transition-colors hover:bg-[#d6ecdc] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
    >
      {label}
      <X className="h-3.5 w-3.5" aria-hidden="true" />
    </button>
  );
}
