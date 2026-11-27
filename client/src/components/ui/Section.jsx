import { Link } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { cn } from '../../lib/cn.js';

/**
 * A flat page section in the reference layout: an optional grey band above it,
 * a bold title with a grey subtitle, and "SEE ALL" with a round arrow.
 */
export function Section({ id, title, subtitle, to, seeAllLabel, band = true, children, className }) {
  const { t } = useTranslation();
  return (
    <section aria-labelledby={id} className={cn(band && 'border-t-8 border-gray-100', 'pb-5 pt-5', className)}>
      <div className="mb-3.5 flex items-start justify-between gap-3 px-4">
        <div className="min-w-0">
          <h2 id={id} className="text-[19px] font-bold leading-snug text-heading">
            {title}
          </h2>
          {subtitle && <p className="mt-0.5 text-[13px] text-meta">{subtitle}</p>}
        </div>
        {to && (
          <Link
            to={to}
            aria-label={`${seeAllLabel ?? t('common.viewAll')} - ${title}`}
            className="group inline-flex min-h-tap shrink-0 items-center gap-2 text-[12px] font-bold uppercase tracking-wide text-label hover:text-primary"
          >
            {seeAllLabel ?? t('common.viewAll')}
            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-white transition-transform group-hover:translate-x-0.5">
              <ChevronRight className="h-4 w-4" aria-hidden="true" strokeWidth={2.75} />
            </span>
          </Link>
        )}
      </div>
      {children}
    </section>
  );
}

/** A sideways-scrolling list (the reference's "Top Picks" / "Popular Brands" rows). */
export function Rail({ label, children, className }) {
  return (
    <ul aria-label={label} className={cn('no-scrollbar flex snap-x gap-4 overflow-x-auto px-4 pb-1', className)}>
      {children}
    </ul>
  );
}
