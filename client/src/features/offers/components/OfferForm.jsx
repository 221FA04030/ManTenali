import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Send } from 'lucide-react';
import { Card } from '../../../components/ui/Card.jsx';
import { Input } from '../../../components/ui/Input.jsx';
import { Button } from '../../../components/ui/Button.jsx';
import { ImageUpload } from '../../../components/ui/ImageUpload.jsx';
import { addOneYear, isIsoDate, istToday } from '../../../lib/dates.js';

const COUPON_RX = /^[A-Za-z0-9][A-Za-z0-9-]{1,28}[A-Za-z0-9]$/;

export function offerToState(o) {
  return {
    title: o?.title ?? '',
    discountLabel: o?.discountLabel ?? '',
    description: o?.description ?? '',
    couponCode: o?.couponCode ?? '',
    terms: o?.terms ?? '',
    redemptionInstructions: o?.redemptionInstructions ?? '',
    image: o?.image ?? null,
    validFrom: o?.validFromDate ?? istToday(),
    validTo: o?.validToDate ?? '',
  };
}

/**
 * Client checks mirroring the server: required fields, lengths, coupon format,
 * dates (end on/after start, at most one year, not already over).
 * `original` = the offer being edited (an unchanged end date may be in the past).
 */
export function validateOffer(s, original, today = istToday()) {
  const e = {};
  if (s.title.trim().length < 3) e.title = 'offers.v.title';
  if (!s.discountLabel.trim()) e.discountLabel = 'offers.v.discountLabel';
  if (s.terms.trim().length < 10) e.terms = 'offers.v.terms';
  if (s.couponCode.trim() && !COUPON_RX.test(s.couponCode.trim())) e.couponCode = 'offers.v.coupon';
  if (!isIsoDate(s.validFrom)) e.validFrom = 'offers.v.date';
  if (!isIsoDate(s.validTo)) e.validTo = 'offers.v.date';
  if (!e.validFrom && !e.validTo) {
    if (s.validTo < s.validFrom) e.validTo = 'offers.v.endBeforeStart';
    else if (s.validTo >= addOneYear(s.validFrom)) e.validTo = 'offers.v.maxYear';
    else if (s.validTo < today && s.validTo !== original?.validToDate) e.validTo = 'offers.v.endPast';
  }
  return e;
}

/** State -> API payload. `businessId` only on create; `status` when publishing / saving a draft. */
export function offerPayload(s, { businessId, status, original } = {}) {
  const p = {
    title: s.title.trim(),
    discountLabel: s.discountLabel.trim(),
    description: s.description.trim(),
    couponCode: s.couponCode.trim() ? s.couponCode.trim().toUpperCase() : original ? null : undefined,
    terms: s.terms.trim(),
    redemptionInstructions: s.redemptionInstructions.trim(),
    image: s.image ?? (original ? null : undefined),
    validFrom: s.validFrom,
    validTo: s.validTo,
  };
  if (businessId) p.businessId = businessId;
  if (status) p.status = status;
  return Object.fromEntries(Object.entries(p).filter(([, v]) => v !== undefined));
}

/**
 * Reusable offer form for owners and admins. `onSubmit(payloadState, { publish })`.
 * Disabled with an explanation when the business can't receive offers.
 */
export function OfferForm({ offer, canPublish = true, disabledReason, onSubmit, submitting, serverErrors = {} }) {
  const { t } = useTranslation();
  const [s, setS] = useState(() => offerToState(offer));
  const [errors, setErrors] = useState({});
  const field = (name) => ({ value: s[name], onChange: (e) => setS((p) => ({ ...p, [name]: e.target.value })) });
  const err = (k) => (errors[k] ? t(errors[k]) : serverErrors[k]);
  const isNew = !offer;
  const isPublished = offer?.status === 'published';

  const send = (publish) => {
    const found = validateOffer(s, offer);
    setErrors(found);
    if (Object.keys(found).length) return;
    onSubmit(s, { publish });
  };

  if (disabledReason) {
    return <p className="rounded-xl bg-amber-50 p-3 text-sm text-amber-900">{disabledReason}</p>;
  }

  return (
    <form
      noValidate
      className="flex flex-col gap-4"
      onSubmit={(e) => {
        e.preventDefault();
        send(isPublished);
      }}
    >
      {Object.keys(errors).length > 0 && (
        <p role="alert" className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-800">
          {t('form.fixErrors')}
        </p>
      )}
      <Card className="flex flex-col gap-4">
        <Input label={`${t('offers.f.title')} *`} maxLength={120} error={err('title')} {...field('title')} />
        <Input
          label={`${t('offers.f.discountLabel')} *`}
          maxLength={40}
          placeholder={t('offers.f.discountPlaceholder')}
          error={err('discountLabel')}
          {...field('discountLabel')}
        />
        <Input as="textarea" label={t('offers.f.description')} maxLength={1000} error={err('description')} {...field('description')} />
        <Input
          label={t('offers.f.couponCode')}
          maxLength={30}
          hint={t('offers.f.couponHint')}
          autoCapitalize="characters"
          error={err('couponCode')}
          {...field('couponCode')}
        />
      </Card>

      <Card className="flex flex-col gap-4">
        <h2 className="text-base font-bold">{t('offers.validity')}</h2>
        <p className="text-xs text-ink-soft">{t('offers.f.datesHint')}</p>
        <div className="grid grid-cols-2 gap-3">
          <Input label={`${t('offers.f.validFrom')} *`} type="date" error={err('validFrom')} {...field('validFrom')} />
          <Input label={`${t('offers.f.validTo')} *`} type="date" min={s.validFrom || undefined} error={err('validTo')} {...field('validTo')} />
        </div>
      </Card>

      <Card className="flex flex-col gap-4">
        <Input as="textarea" label={`${t('offers.f.terms')} *`} maxLength={1000} error={err('terms')} {...field('terms')} />
        <Input
          as="textarea"
          label={t('offers.f.redemption')}
          maxLength={500}
          placeholder={t('offers.f.redemptionPlaceholder')}
          error={err('redemptionInstructions')}
          {...field('redemptionInstructions')}
        />
        <ImageUpload
          purpose="offer_image"
          label={t('offers.f.image')}
          value={s.image}
          onChange={(image) => setS((p) => ({ ...p, image }))}
        />
        {err('image') && <p className="text-sm text-red-700">{err('image')}</p>}
      </Card>

      {isNew || !isPublished ? (
        <div className="flex flex-col gap-2 sm:flex-row-reverse">
          <Button size="lg" fullWidth loading={submitting} disabled={!canPublish} onClick={() => send(true)}>
            <Send className="h-4 w-4" aria-hidden="true" />
            {t('offers.publish')}
          </Button>
          <Button type="submit" variant="secondary" size="lg" fullWidth disabled={submitting}>
            {isNew ? t('offers.saveDraft') : t('common.save')}
          </Button>
        </div>
      ) : (
        <Button type="submit" size="lg" fullWidth loading={submitting}>
          {t('common.save')}
        </Button>
      )}
    </form>
  );
}
