import { BadgeCheck, FlaskConical } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { cn } from '../../lib/cn.js';

const TONES = {
  green: 'bg-brand-100 text-brand-800',
  gray: 'bg-gray-100 text-gray-700',
  amber: 'bg-amber-100 text-amber-900',
  red: 'bg-red-100 text-red-800',
  blue: 'bg-blue-100 text-blue-800',
  solid: 'bg-brand-700 text-white',
};

export function Badge({ tone = 'green', className, children, icon: Icon }) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-semibold leading-4',
        TONES[tone],
        className,
      )}
    >
      {Icon && <Icon className="h-3 w-3" aria-hidden="true" />}
      {children}
    </span>
  );
}

export function VerifiedBadge() {
  const { t } = useTranslation();
  return (
    <Badge tone="green" icon={BadgeCheck}>
      {t('badge.verified')}
    </Badge>
  );
}

export function SampleBadge() {
  const { t } = useTranslation();
  return (
    <Badge tone="amber" icon={FlaskConical}>
      {t('badge.sample')}
    </Badge>
  );
}

/** Verified / Sample data badge for any content item (spec: seed content is labelled). */
export function TrustBadge({ isVerified, isSeed }) {
  if (isSeed) return <SampleBadge />;
  if (isVerified) return <VerifiedBadge />;
  return null;
}

export function ComingSoonBadge({ short = false, className }) {
  const { t } = useTranslation();
  return (
    <Badge tone="gray" className={className}>
      {short ? t('badge.soon') : t('badge.comingSoon')}
    </Badge>
  );
}
