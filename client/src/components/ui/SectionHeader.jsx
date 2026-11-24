import { ArrowRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

export function SectionHeader({ icon: Icon, title, to, actionLabel }) {
  const { t } = useTranslation();
  return (
    <div className="mb-3 flex items-center justify-between gap-2">
      <h2 className="flex items-center gap-2 text-lg font-bold text-ink">
        {Icon && <Icon className="h-5 w-5 text-brand-700" aria-hidden="true" strokeWidth={2.5} />}
        {title}
      </h2>
      {to && (
        <Link
          to={to}
          className="inline-flex min-h-tap items-center gap-1 text-sm font-semibold text-brand-700 hover:text-brand-800"
        >
          {actionLabel ?? t('common.viewAll')}
          <ArrowRight className="h-4 w-4" aria-hidden="true" />
        </Link>
      )}
    </div>
  );
}
