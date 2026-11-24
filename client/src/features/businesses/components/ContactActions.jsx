import { MessageCircle, Navigation, Phone } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { directionsUrl, telUrl, whatsappUrl } from '../../../lib/geo.js';
import { cn } from '../../../lib/cn.js';

const base =
  'inline-flex min-h-tap flex-[1_1_auto] items-center justify-center gap-1.5 whitespace-nowrap rounded-full px-3 text-sm font-semibold transition-colors';

/**
 * One-tap contact actions (FR-UX-1): call, WhatsApp, directions.
 * `onAction(type)` lets Step 9 record contact_click analytics.
 */
export function ContactActions({ contact, location, name, size = 'md', onAction }) {
  const { t } = useTranslation();
  const actions = [];
  if (contact?.phone) actions.push({ key: 'call', href: telUrl(contact.phone), icon: Phone, label: t('business.call') });
  if (contact?.whatsapp)
    actions.push({ key: 'whatsapp', href: whatsappUrl(contact.whatsapp), icon: MessageCircle, label: t('business.whatsapp'), external: true });
  if (location) actions.push({ key: 'directions', href: directionsUrl(location), icon: Navigation, label: t('business.directions'), external: true });
  if (!actions.length) return null;

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
