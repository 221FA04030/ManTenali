import { Link } from 'react-router-dom';
import { ComingSoonBadge } from './Badge.jsx';
import { IconBubble } from './IconBubble.jsx';
import { cn } from '../../lib/cn.js';

const base =
  'relative flex h-full min-h-[104px] flex-col items-center justify-center gap-2 rounded-tile bg-white px-1.5 py-3 text-center shadow-card ring-1 ring-brand-100';

/** Home grid tile. Coming-soon tiles are dimmed, badged and not tappable. */
export function CategoryTile({ icon, label, to, comingSoon }) {
  const content = (
    <>
      <IconBubble icon={icon} size="md" round tone={comingSoon ? 'gray' : 'green'} />
      <span className="text-[12.5px] font-semibold leading-tight text-ink sm:text-sm">{label}</span>
    </>
  );

  if (comingSoon || !to) {
    return (
      <div className={cn(base, 'opacity-60')} aria-disabled="true" data-coming-soon="true">
        <ComingSoonBadge short className="absolute -top-2 right-1" />
        {content}
      </div>
    );
  }
  return (
    <Link
      to={to}
      className={cn(base, 'transition-transform hover:-translate-y-0.5 hover:shadow-lift active:scale-[0.98]')}
    >
      {content}
    </Link>
  );
}
