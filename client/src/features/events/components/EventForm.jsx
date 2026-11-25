import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { LocateFixed } from 'lucide-react';
import { Card } from '../../../components/ui/Card.jsx';
import { Input } from '../../../components/ui/Input.jsx';
import { Button } from '../../../components/ui/Button.jsx';
import { ImageUpload } from '../../../components/ui/ImageUpload.jsx';
import { useCategories, categoryName } from '../../categories/api.js';
import { businessesApi } from '../../businesses/api.js';
import { TENALI_AREAS } from '../../../config/areas.js';
import { getCurrentPosition } from '../../../lib/geo.js';
import { istNowLocal, isIsoDate } from '../../../lib/dates.js';

const LOCAL_RX = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/;
const MAX_DAYS = 90;
const toMs = (local) => Date.parse(`${local}:00Z`); // comparison only (both IST)

export function eventToState(e) {
  return {
    title: e?.title ?? '',
    categoryId: e?.category?.id ?? '',
    description: e?.description ?? '',
    allDay: Boolean(e?.allDay),
    startAt: e?.startLocal ?? '',
    endAt: e?.endLocal ?? '',
    venueName: e?.venue?.name ?? '',
    venueAddress: e?.venue?.address ?? '',
    area: e?.venue?.area ?? '',
    lat: e?.location?.lat ?? '',
    lng: e?.location?.lng ?? '',
    bookingUrl: e?.bookingUrl ?? '',
    priceInfo: e?.priceInfo ?? '',
    organizerName: e?.organizerName ?? '',
    businessId: e?.businessId ?? e?.business?.id ?? '',
    bannerImage: e?.bannerImage ?? null,
    status: 'draft',
  };
}

/** Client checks mirroring the server (IST date-times, 90-day cap, not already over). */
export function validateEvent(s, { now = new Date(), requireFuture = true } = {}) {
  const e = {};
  if (s.title.trim().length < 3) e.title = 'events.v.title';
  if (!s.categoryId) e.categoryId = 'events.v.category';
  const startOk = s.allDay ? isIsoDate(s.startAt.slice(0, 10)) : LOCAL_RX.test(s.startAt);
  const endOk = s.allDay ? isIsoDate(s.endAt.slice(0, 10)) : LOCAL_RX.test(s.endAt);
  if (!startOk) e.startAt = 'events.v.date';
  if (!endOk) e.endAt = 'events.v.date';
  if (startOk && endOk) {
    const start = s.allDay ? `${s.startAt.slice(0, 10)}T00:00` : s.startAt;
    const end = s.allDay ? `${s.endAt.slice(0, 10)}T23:59` : s.endAt;
    if (end < start) e.endAt = 'events.v.endBeforeStart';
    else if (toMs(end) - toMs(start) > MAX_DAYS * 86_400_000) e.endAt = 'events.v.tooLong';
    else if (requireFuture && end <= istNowLocal(now)) e.endAt = 'events.v.over';
  }
  if (s.venueName.trim().length < 2) e['venue.name'] = 'events.v.venueName';
  if (s.venueAddress.trim().length < 3) e['venue.address'] = 'events.v.venueAddress';
  if (!s.area) e['venue.area'] = 'events.v.area';
  if (s.organizerName.trim().length < 2) e.organizerName = 'events.v.organizer';
  if (s.bookingUrl.trim() && !/^https:\/\/\S+\.\S+/.test(s.bookingUrl.trim())) e.bookingUrl = 'events.v.bookingUrl';
  const hasLat = String(s.lat).trim() !== '';
  const hasLng = String(s.lng).trim() !== '';
  if ((hasLat || hasLng) && !(hasLat && hasLng && Number.isFinite(Number(s.lat)) && Number.isFinite(Number(s.lng)))) e.location = 'events.v.location';
  return e;
}

/** State -> API body. On edits, cleared optional fields are sent as null. */
export function eventPayload(s, { editing = false, admin = false } = {}) {
  const clear = editing ? null : undefined;
  const p = {
    title: s.title.trim(),
    categoryId: s.categoryId,
    description: s.description.trim(),
    allDay: s.allDay,
    startAt: s.allDay ? `${s.startAt.slice(0, 10)}T00:00` : s.startAt,
    endAt: s.allDay ? `${s.endAt.slice(0, 10)}T23:59` : s.endAt,
    venue: { name: s.venueName.trim(), address: s.venueAddress.trim(), area: s.area },
    location: s.lat !== '' && s.lng !== '' ? { lat: Number(s.lat), lng: Number(s.lng) } : clear,
    bookingUrl: s.bookingUrl.trim() || clear,
    priceInfo: s.priceInfo.trim(),
    businessId: s.businessId || clear,
    organizerName: s.organizerName.trim(),
  };
  if (admin) {
    p.bannerImage = s.bannerImage ?? clear;
    if (!editing) p.status = s.status;
  }
  return Object.fromEntries(Object.entries(p).filter(([, v]) => v !== undefined));
}

/**
 * Event form for submitters and admins. `children` renders extra sections
 * (e.g. the evidence uploader) before the buttons. `onSubmit(state)`.
 */
export function EventForm({ event, mode = 'submission', onSubmit, submitting, submitLabel, serverErrors = {}, extraErrors = {}, children, requireFuture = true }) {
  const { t, i18n } = useTranslation();
  const admin = mode === 'admin';
  const [s, setS] = useState(() => eventToState(event));
  const [errors, setErrors] = useState({});
  const [locating, setLocating] = useState(false);
  const { data: categories = [] } = useCategories('event');
  const { data: businesses } = useQuery({
    queryKey: ['businesses', 'list', 'event-link', s.area],
    queryFn: () => businessesApi.list({ area: s.area || undefined, limit: 50 }).then((r) => r.data),
  });
  const set = (patch) => setS((p) => ({ ...p, ...patch }));
  const field = (name) => ({ value: s[name], onChange: (e) => set({ [name]: e.target.value }) });
  const err = (k) => (errors[k] ? t(errors[k]) : serverErrors[k]);

  const fillMyLocation = async () => {
    setLocating(true);
    try {
      const pos = await getCurrentPosition();
      set({ lat: pos.lat, lng: pos.lng });
    } catch {
      /* keep manual values */
    } finally {
      setLocating(false);
    }
  };

  return (
    <form
      noValidate
      className="flex flex-col gap-4"
      onSubmit={(e) => {
        e.preventDefault();
        const found = { ...validateEvent(s, { requireFuture }), ...extraErrors };
        setErrors(found);
        if (Object.keys(found).length) return;
        onSubmit(s);
      }}
    >
      {Object.keys(errors).length > 0 && (
        <p role="alert" className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-800">
          {t('form.fixErrors')}
        </p>
      )}
      <Card className="flex flex-col gap-4">
        <Input label={`${t('events.f.title')} *`} maxLength={120} error={err('title')} {...field('title')} />
        <Input as="select" label={`${t('business.category')} *`} error={err('categoryId')} {...field('categoryId')}>
          <option value="">{t('form.choose')}</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {categoryName(c, i18n.language)}
            </option>
          ))}
        </Input>
        <Input as="textarea" label={t('form.description')} maxLength={2000} error={err('description')} {...field('description')} />
      </Card>

      <Card className="flex flex-col gap-4">
        <h2 className="text-base font-bold">{t('events.f.when')}</h2>
        <p className="text-xs text-ink-soft">{t('events.f.whenHint')}</p>
        <label className="flex min-h-tap items-center gap-2 text-[15px]">
          <input type="checkbox" checked={s.allDay} onChange={(e) => set({ allDay: e.target.checked })} className="h-5 w-5 accent-brand-700" />
          {t('events.allDay')}
        </label>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Input
            label={`${t('events.f.start')} *`}
            type={s.allDay ? 'date' : 'datetime-local'}
            value={s.allDay ? s.startAt.slice(0, 10) : s.startAt}
            onChange={(e) => set({ startAt: s.allDay ? `${e.target.value}T00:00` : e.target.value })}
            error={err('startAt')}
          />
          <Input
            label={`${t('events.f.end')} *`}
            type={s.allDay ? 'date' : 'datetime-local'}
            value={s.allDay ? s.endAt.slice(0, 10) : s.endAt}
            onChange={(e) => set({ endAt: s.allDay ? `${e.target.value}T23:59` : e.target.value })}
            error={err('endAt')}
          />
        </div>
      </Card>

      <Card className="flex flex-col gap-4">
        <h2 className="text-base font-bold">{t('events.f.where')}</h2>
        <Input label={`${t('events.f.venueName')} *`} maxLength={120} error={err('venue.name')} {...field('venueName')} />
        <Input label={`${t('events.f.venueAddress')} *`} maxLength={200} error={err('venue.address')} {...field('venueAddress')} />
        <Input as="select" label={`${t('location.area')} *`} error={err('venue.area')} {...field('area')}>
          <option value="">{t('form.choose')}</option>
          {[...new Set([...TENALI_AREAS, s.area].filter(Boolean))].map((a) => (
            <option key={a} value={a}>
              {a}
            </option>
          ))}
        </Input>
        <div className="grid grid-cols-2 gap-3">
          <Input label={t('form.lat')} type="number" step="0.00001" error={err('location')} {...field('lat')} />
          <Input label={t('form.lng')} type="number" step="0.00001" {...field('lng')} />
        </div>
        <Button variant="soft" size="sm" onClick={fillMyLocation} loading={locating} className="self-start">
          <LocateFixed className="h-4 w-4" aria-hidden="true" />
          {t('form.useMyLocation')}
        </Button>
      </Card>

      <Card className="flex flex-col gap-4">
        <h2 className="text-base font-bold">{t('events.f.details')}</h2>
        <Input label={`${t('events.f.organizer')} *`} maxLength={120} error={err('organizerName')} {...field('organizerName')} />
        <Input label={t('events.f.price')} maxLength={100} placeholder={t('events.f.pricePlaceholder')} error={err('priceInfo')} {...field('priceInfo')} />
        <Input label={t('events.f.booking')} type="url" placeholder="https://" error={err('bookingUrl')} {...field('bookingUrl')} />
        <Input
          as="select"
          label={t('events.f.business')}
          hint={t('events.f.businessHint')}
          error={err('businessId')}
          value={s.businessId}
          onChange={(e) => {
            const biz = (businesses ?? []).find((b) => b.id === e.target.value);
            // Default the map point to the linked business's location when none is set.
            const usePoint = biz?.location && s.lat === '' && s.lng === '';
            set({ businessId: e.target.value, ...(usePoint ? { lat: biz.location.lat, lng: biz.location.lng } : {}) });
          }}
        >
          <option value="">{t('events.f.noBusiness')}</option>
          {(businesses ?? []).map((b) => (
            <option key={b.id} value={b.id}>
              {b.name}
            </option>
          ))}
        </Input>
        {admin && (
          <ImageUpload purpose="event_banner" label={t('events.f.banner')} value={s.bannerImage} onChange={(bannerImage) => set({ bannerImage })} />
        )}
        {admin && !event && (
          <Input as="select" label={t('form.status')} {...field('status')}>
            <option value="draft">{t('events.status.draft')}</option>
            <option value="published">{t('events.status.published')}</option>
          </Input>
        )}
      </Card>

      {children}

      <Button type="submit" size="lg" fullWidth loading={submitting}>
        {submitLabel ?? t('common.save')}
      </Button>
    </form>
  );
}
