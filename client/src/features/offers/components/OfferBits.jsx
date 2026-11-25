import { useState } from 'react';
import { Check, Clock, Copy } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Badge } from '../../../components/ui/Badge.jsx';
import { useToast } from '../../../components/ui/Toast.jsx';
import { endsIn, formatIsoDate } from '../../../lib/dates.js';
import { OFFER_STATUS_TONE } from '../api.js';

/** "Ends in 3 days" (IST calendar days). */
export function EndsIn({ validToDate, className }) {
  const { t } = useTranslation();
  const e = endsIn(validToDate);
  return (
    <span className={className ?? 'inline-flex items-center gap-1 text-xs font-semibold text-amber-800'}>
      <Clock className="h-3.5 w-3.5" aria-hidden="true" />
      {t(e.key, { count: e.count })}
    </span>
  );
}

/** "Valid 1 Nov 2026 – 30 Nov 2026 (IST)". */
export function ValidityDates({ from, to }) {
  const { t, i18n } = useTranslation();
  return (
    <span>
      {t('offers.validRange', { from: formatIsoDate(from, i18n.language), to: formatIsoDate(to, i18n.language) })}
    </span>
  );
}

export function OfferStatusBadge({ status }) {
  const { t } = useTranslation();
  return <Badge tone={OFFER_STATUS_TONE[status] ?? 'gray'}>{t(`offers.status.${status}`)}</Badge>;
}

/** Coupon code with a copy button (falls back to selecting the text). */
export function CouponCode({ code }) {
  const { t } = useTranslation();
  const toast = useToast();
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      toast.success(t('offers.copied'));
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.info(t('offers.copyManually'));
    }
  };

  return (
    <div className="flex items-center gap-2 rounded-2xl border-2 border-dashed border-brand-400 bg-brand-50 p-2 pl-4">
      <span className="flex-1">
        <span className="block text-xs text-ink-soft">{t('offers.couponCode')}</span>
        <span className="font-mono text-lg font-bold tracking-wider text-brand-800" data-testid="coupon-code">
          {code}
        </span>
      </span>
      <button
        type="button"
        onClick={copy}
        className="inline-flex min-h-tap items-center gap-1.5 rounded-full bg-brand-700 px-4 text-sm font-semibold text-white hover:bg-brand-800"
      >
        {copied ? <Check className="h-4 w-4" aria-hidden="true" /> : <Copy className="h-4 w-4" aria-hidden="true" />}
        {copied ? t('offers.copiedShort') : t('offers.copy')}
      </button>
    </div>
  );
}
