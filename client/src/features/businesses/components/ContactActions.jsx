import { MessageCircle, Navigation, Phone } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { directionsUrl, telUrl, whatsappUrl } from '../../../lib/geo.js';
import { cn } from '../../../lib/cn.js';

const base =
  'inline-flex min-h-tap flex-[1_1_auto] items-center justify-center gap-1.5 whitespace-nowrap rounded-full px-3 text-sm font-semibold transition-colors';

const tile =
  'flex min-h-[52px] min-w-0 flex-col items-center justify-center gap-0.5 rounded-xl px-1 text-[13px] font-semibold leading-tight transition duration-150 active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2';

/**
 * One-tap contact actions (FR-UX-1): call, WhatsApp, directions.
 * `onAction(type)` lets Step 9 record contact_click analytics.
 * `layout="tiles"` (inside pages): equal tiles in one row, icon above the label,
 * so all actions fit on a phone without wrapping. The default row layout is
 * what the Home page uses.
 */
export function ContactActions({ contact, location, name, size = 'md', layout = 'row', onAction }) {
  const { t } = useTranslation();
  const actions = [];
  if (contact?.phone) actions.push({ key: 'call', href: telUrl(contact.phone), icon: Phone, label: t('business.call') });
  if (contact?.whatsapp)
    actions.push({ key: 'whatsapp', href: whatsappUrl(contact.whatsapp), icon: MessageCircle, label: t('business.whatsapp'), external: true });
  if (location) actions.push({ key: 'directions', href: directionsUrl(location), icon: Navigation, label: t('business.directions'), external: true });
  if (!actions.length) return null;

  if (layout === 'tiles') {
    return (
      <div className="grid gap-2" style={{ gridTemplateColumns: `repeat(${actions.length}, minmax(0, 1fr))` }}>
        {actions.map(({ key, href, icon: Icon, label, external }, i) => (
          <a
            key={key}
            href={href}
            onClick={(e) => {
              e.stopPropagation();
              onAction?.(key);
            }}
            {...(external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
            aria-label={`${label} - ${name}`}
            className={cn(tile, i === 0 ? 'bg-primary text-white hover:bg-primary-dark' : 'bg-primary-light text-primary-dark hover:bg-[#d6ecdc]')}
          >
            <Icon className="h-[18px] w-[18px]" aria-hidden="true" />
            <span className="max-w-full truncate">{label}</span>
          </a>
        ))}
      </div>
    );
  }

  return (
    <div className="flex flex-wrap gap-2">
      {actions.map(({ key, href, icon: Icon, label, external }, i) => (
        <a
          key={key}
          href={href}
          onClick={(e) => {
            e.stopPropagation();
            onAction?.(key);
          }}
          {...(external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
          aria-label={`${label} - ${name}`}
          className={cn(
            base,
            i === 0 ? 'bg-brand-700 text-white hover:bg-brand-800' : 'bg-brand-100 text-brand-800 hover:bg-brand-200',
            size === 'sm' && 'min-h-[40px] text-[13px]',
          )}
        >
          <Icon className="h-4 w-4" aria-hidden="true" />
          {label}
        </a>
      ))}
    </div>
  );
}
