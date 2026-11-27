import { ChevronRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

/** Section title with an optional "VIEW ALL" link and round arrow (reference layout). */
export function SectionHeader({ id, icon: Icon, title, to, actionLabel }) {
  const { t } = useTranslation();
  return (
    <div className="mb-3.5 flex items-center justify-between gap-2">
      <h2 id={id} className="flex items-center gap-2 text-[19px] font-bold leading-snug text-heading">
        {Icon && <Icon className="h-5 w-5 text-primary" aria-hidden="true" strokeWidth={2.5} />}
        {title}
      </h2>
      {to && (
        <Link
          to={to}
          className="group inline-flex min-h-tap shrink-0 items-center gap-2 text-[12px] font-bold uppercase tracking-wide text-label hover:text-primary"
        >
          {actionLabel ?? t('common.viewAll')}
          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-white transition-transform group-hover:translate-x-0.5">
            <ChevronRight className="h-4 w-4" aria-hidden="true" strokeWidth={2.75} />
          </span>
        </Link>
      )}
    </div>
  );
}
