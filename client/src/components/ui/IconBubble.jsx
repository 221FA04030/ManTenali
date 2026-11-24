import { cn } from '../../lib/cn.js';

const TONES = {
  green: 'bg-brand-100 text-brand-800',
  traffic: 'bg-status-trafficBg text-status-traffic',
  weather: 'bg-status-weatherBg text-status-weather',
  event: 'bg-status-eventBg text-status-event',
  gray: 'bg-gray-100 text-gray-500',
};
const SIZES = { sm: 'h-10 w-10', md: 'h-12 w-12', lg: 'h-14 w-14' };
const ICON_SIZES = { sm: 'h-5 w-5', md: 'h-6 w-6', lg: 'h-7 w-7' };

/** Light rounded tile holding a line icon (UI reference icon style). */
export function IconBubble({ icon: Icon, tone = 'green', size = 'md', round = false, className }) {
  return (
    <span
      className={cn(
        'flex shrink-0 items-center justify-center',
        round ? 'rounded-full' : 'rounded-2xl',
        TONES[tone],
        SIZES[size],
        className,
      )}
      aria-hidden="true"
    >
      <Icon className={ICON_SIZES[size]} strokeWidth={2.2} />
    </span>
  );
}
