import { Link } from 'react-router-dom';
import { ComingSoonBadge } from './Badge.jsx';
import { cn } from '../../lib/cn.js';

/**
 * Home category shortcut (DOCS/refrence.jpeg): a light-green rounded square
 * with the icon, and the name underneath. Sizes come from `.cat-grid` (see
 * styles/index.css), so the tile stays square and the label always fits.
 * Coming-soon shortcuts are dimmed, badged and not tappable.
 */
export function CategoryTile({ icon: Icon, label, to, comingSoon }) {
  const disabled = comingSoon || !to;
  const content = (
    <>
      <span data-cat-tile="" aria-hidden="true" className={cn('cat-tile', disabled ? 'bg-gray-100 text-gray-500' : 'bg-primary-light text-primary')}>
        <Icon className="cat-icon" strokeWidth={1.75} />
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
