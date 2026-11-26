import { Link } from 'react-router-dom';
import { ComingSoonBadge } from './Badge.jsx';
import { cn } from '../../lib/cn.js';

/**
 * Home category shortcut: a round icon with its name underneath. Sizes come
 * from the `.cat-grid` container (see styles/index.css), so the circle stays
 * round and scales with the space available. Coming-soon shortcuts are dimmed,
 * badged and not tappable.
 */
export function CategoryTile({ icon: Icon, label, to, comingSoon }) {
  const disabled = comingSoon || !to;
  const content = (
    <>
      <span
        data-cat-circle=""
        aria-hidden="true"
        className={cn(
          'cat-circle',
          disabled ? 'bg-gray-50 text-gray-500 ring-gray-200' : 'bg-white text-brand-700 ring-brand-200 group-hover:shadow-lift',
        )}
      >
        <Icon className="cat-icon" strokeWidth={2} />
        {disabled && <ComingSoonBadge short className="absolute -bottom-2 left-1/2 -translate-x-1/2 ring-2 ring-white" />}
      </span>
      <span className="cat-label">{label}</span>
    </>
  );

  if (disabled) {
    return (
      <div className="cat-item opacity-70" aria-disabled="true" data-coming-soon="true">
        {content}
      </div>
    );
  }
  return (
    <Link to={to} className="cat-item group">
      {content}
    </Link>
  );
}
