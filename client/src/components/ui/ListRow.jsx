import { Link } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';
import { ComingSoonBadge } from './Badge.jsx';
import { IconBubble } from './IconBubble.jsx';
import { cn } from '../../lib/cn.js';

const base =
  'flex min-h-[72px] w-full items-center gap-3.5 rounded-card bg-white/95 px-4 py-3 text-left shadow-card ring-1 ring-brand-100';

/**
 * Icon + title + one-line subtitle + chevron (Explore and Today in Tenali rows).
 * Coming-soon rows are dimmed, badged and not focusable/tappable.
 */
export function ListRow({ icon, tone = 'green', title, subtitle, meta, to, href, onClick, comingSoon, iconSize = 'lg', round = true }) {
  const inner = (
    <>
      <IconBubble icon={icon} tone={comingSoon ? 'gray' : tone} size={iconSize} round={round} />
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="text-[15px] font-bold leading-snug text-ink sm:text-base">{title}</span>
        {subtitle && <span className="line-clamp-2 text-[13px] leading-snug text-ink-muted sm:text-sm">{subtitle}</span>}
        {meta && <span className="mt-0.5 text-xs text-ink-soft">{meta}</span>}
      </span>
      {comingSoon ? (
        <ComingSoonBadge />
      ) : (
        <ChevronRight className="h-5 w-5 shrink-0 text-ink-muted" aria-hidden="true" />
      )}
    </>
  );

  if (comingSoon) {
    return (
      <div className={cn(base, 'opacity-60')} aria-disabled="true" data-coming-soon="true">
        {inner}
      </div>
    );
  }
  const interactive = cn(base, 'transition-shadow hover:shadow-lift active:bg-brand-50');
  if (to) return <Link to={to} className={interactive}>{inner}</Link>;
  if (href)
    return (
      <a href={href} className={interactive} target="_blank" rel="noopener noreferrer">
        {inner}
      </a>
    );
  return (
    <button type="button" onClick={onClick} className={interactive}>
      {inner}
    </button>
  );
}
