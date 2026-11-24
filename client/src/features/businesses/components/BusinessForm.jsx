import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { LocateFixed, Send } from 'lucide-react';
import { Card } from '../../../components/ui/Card.jsx';
import { Input } from '../../../components/ui/Input.jsx';
import { Button } from '../../../components/ui/Button.jsx';
import { ImageUpload } from '../../../components/ui/ImageUpload.jsx';
import { CategoryPicker } from '../../categories/components/CategoryPicker.jsx';
import { useCategoryTree } from '../../categories/api.js';
import { FoodFieldsEditor, foodToState, stateToFood, validateFood } from '../../food/components/FoodFieldsEditor.jsx';
import { TENALI_AREAS } from '../../../config/areas.js';
import { getCurrentPosition } from '../../../lib/geo.js';
import { HoursEditor, hoursToRows, rowsToHours } from './HoursEditor.jsx';
import { OwnerPicker } from './OwnerPicker.jsx';
import { KINDS } from '../api.js';

const MAX_PHOTOS = 8;
const TENALI = { lat: 16.2379, lng: 80.6444 };
const PHONE_RX = /^\+?[\d\s-]{7,20}$/;

/**
 * Modes:
 *  - "admin":      everything, including status, kind and owner
 *  - "submission": a user's own listing before approval (draft / pending / rejected):
 *                  identity, category, address and location editable; no status/owner
 *  - "owner":      an approved listing: only description, tags, contact, hours, photos
 */
const showsListingFields = (mode) => mode === 'admin' || mode === 'submission';

function initialState(b) {
  return {
    name: b?.name ?? '',
    categoryId: b?.category?.id ?? '',
    subcategoryId: b?.subcategory?.id ?? '',
    kind: b?.kind ?? 'shop',
    status: ['draft', 'published', 'hidden'].includes(b?.status) ? b.status : 'draft',
    description: b?.description ?? '',
    tags: (b?.tags ?? []).join(', '),
    line: b?.address?.line ?? '',
    area: b?.address?.area ?? '',
    pincode: b?.address?.pincode ?? '',
    lat: b?.location?.lat ?? TENALI.lat,
    lng: b?.location?.lng ?? TENALI.lng,
    phone: b?.contact?.phone ?? '',
    whatsapp: b?.contact?.whatsapp ?? '',
    email: b?.contact?.email ?? '',
    website: b?.contact?.website ?? '',
    hours: hoursToRows(b?.openingHours),
    photos: b?.photos ?? [],
    owner: b?.ownerId ? { id: b.ownerId } : null,
    foodState: foodToState(b),
  };
}

/** Client-side checks mirroring the server rules. Keys match server field paths. */
export function validateForm(s, mode, { isFood = false } = {}) {
  const e = {};
  if (showsListingFields(mode)) {
    if (s.name.trim().length < 2) e.name = 'form.v.name';
    if (!s.categoryId) e.categoryId = 'form.v.category';
    if (!s.subcategoryId) e.subcategoryId = 'form.v.subcategory';
    if (s.line.trim().length < 3) e['address.line'] = 'form.v.addressLine';
    if (!s.area) e['address.area'] = 'form.v.area';
    if (s.pincode && !/^\d{6}$/.test(s.pincode.trim())) e['address.pincode'] = 'form.v.pincode';
    if (!Number.isFinite(Number(s.lat)) || Math.abs(Number(s.lat)) > 90) e['location.lat'] = 'form.v.coords';
    if (!Number.isFinite(Number(s.lng)) || Math.abs(Number(s.lng)) > 180) e['location.lng'] = 'form.v.coords';
  }
  const phoneRequired = mode === 'submission' || (mode === 'owner' && s.phone);
  if (phoneRequired && !PHONE_RX.test(s.phone.trim())) e['contact.phone'] = 'form.v.phone';
  if (s.whatsapp && !PHONE_RX.test(s.whatsapp.trim())) e['contact.whatsapp'] = 'form.v.phone';
  if (s.website && !/^https?:\/\/\S+\.\S+/.test(s.website.trim())) e['contact.website'] = 'form.v.website';
  for (const r of s.hours) {
    if (!r.closed && Boolean(r.open) !== Boolean(r.close)) e.openingHours = 'form.v.hours';
    if (!r.closed && r.open && r.open === r.close) e.openingHours = 'form.v.hours';
  }
  if (isFood && s.foodState) {
    const foodError = validateFood(s.foodState);
    if (foodError) e.food = foodError;
  }
  return e;
}

/** Build the API payload. Each mode sends only the fields it may change. */
export function toPayload(s, mode, original, { isFood = false } = {}) {
  const payload = {
    description: s.description.trim(),
    tags: s.tags
      .split(',')
      .map((x) => x.trim())
      .filter(Boolean),
    contact: { phone: s.phone.trim(), whatsapp: s.whatsapp.trim(), email: s.email.trim(), website: s.website.trim() },
    openingHours: rowsToHours(s.hours),
    photos: s.photos,
  };
  // Food details only for food businesses (the server rejects them otherwise).
  if (isFood && s.foodState) Object.assign(payload, stateToFood(s.foodState));
  if (!showsListingFields(mode)) return payload;
  Object.assign(payload, {
    name: s.name.trim(),
    categoryId: s.categoryId,
    subcategoryId: s.subcategoryId,
    address: { line: s.line.trim(), area: s.area.trim(), pincode: s.pincode.trim() },
    location: { lat: Number(s.lat), lng: Number(s.lng) },
  });
  if (mode !== 'admin') return payload;
  Object.assign(payload, { kind: s.kind, status: s.status });
  const originalOwner = original?.ownerId ?? null;
  const nextOwner = s.owner?.id ?? null;
  if (!original) {
    if (nextOwner) payload.ownerId = nextOwner;
  } else if (nextOwner !== originalOwner) {
    payload.ownerId = nextOwner;
  }
  return payload;
}

/**
 * Shared create/edit form. `onSubmit(payload, { submit })` - in submission
 * mode `submit` is true when the user chose "Submit for review".
 */
export function BusinessForm({ mode, business, onSubmit, submitting, serverErrors = {}, canSubmitForReview = false }) {
  const { t } = useTranslation();
  const [s, setS] = useState(() => initialState(business));
  const [clientErrors, setClientErrors] = useState({});
  const [locating, setLocating] = useState(false);
  const set = (patch) => setS((prev) => ({ ...prev, ...patch }));
  const field = (name) => ({ value: s[name], onChange: (e) => set({ [name]: e.target.value }) });
  const err = (key) => (clientErrors[key] ? t(clientErrors[key]) : serverErrors[key]);
  const admin = mode === 'admin';
  const listing = showsListingFields(mode);
  const submission = mode === 'submission';
  const { tree } = useCategoryTree('business');
  const mainSlug = tree.find((m) => m.id === s.categoryId)?.slug;
  // Food fields: admins follow the chosen kind; submissions follow the main
  // category (Food & Dining becomes kind "food"); owners the listing's kind.
  const isFood = admin ? s.kind === 'food' : submission ? (mainSlug ? mainSlug === 'food-dining' : business?.kind === 'food') : business?.kind === 'food';

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

  const send = (submit) => {
    const errors = validateForm(s, mode, { isFood });
    setClientErrors(errors);
    if (Object.keys(errors).length) {
      const first = document.querySelector('[aria-invalid="true"]');
      first?.focus?.();
      return;
    }
    onSubmit(toPayload(s, mode, business, { isFood }), { submit });
  };

  return (
    <form
      noValidate
      className="flex flex-col gap-4"
      onSubmit={(e) => {
        e.preventDefault();
        send(false);
      }}
    >
      {Object.keys(clientErrors).length > 0 && (
        <p role="alert" className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-800">
          {t('form.fixErrors')}
        </p>
      )}

      {listing && (
        <Card className="flex flex-col gap-4">
          <h2 className="text-base font-bold">{t('form.basics')}</h2>
          <Input label={t('form.name')} required maxLength={120} error={err('name')} {...field('name')} />
          <CategoryPicker
            categoryId={s.categoryId}
            subcategoryId={s.subcategoryId}
            onChange={(patch) => set(patch)}
            errors={{ categoryId: err('categoryId'), subcategoryId: err('subcategoryId') }}
          />
          {admin && (
            <>
              <Input as="select" label={t('business.kind')} error={err('kind')} {...field('kind')}>
                {KINDS.map((k) => (
                  <option key={k} value={k}>
                    {t(`business.kinds.${k}`)}
                  </option>
                ))}
              </Input>
              <Input as="select" label={t('form.status')} hint={t('form.statusHint')} error={err('status')} {...field('status')}>
                {['draft', 'published', 'hidden'].map((st) => (
                  <option key={st} value={st}>
                    {t(`status.${st}`)}
                  </option>
                ))}
              </Input>
            </>
          )}
        </Card>
      )}

      <Card className="flex flex-col gap-4">
        <h2 className="text-base font-bold">{t('business.about')}</h2>
        <Input as="textarea" label={t('form.description')} maxLength={2000} error={err('description')} {...field('description')} />
        <Input label={t('form.tags')} hint={t('form.tagsHint')} error={err('tags')} {...field('tags')} />
      </Card>

      {listing && (
        <Card className="flex flex-col gap-4">
          <h2 className="text-base font-bold">{t('business.address')}</h2>
          <Input label={t('form.addressLine')} maxLength={200} error={err('address.line')} {...field('line')} />
          <Input as="select" label={t('location.area')} error={err('address.area')} {...field('area')}>
            <option value="">{t('form.choose')}</option>
            {[...new Set([...TENALI_AREAS, s.area].filter(Boolean))].map((a) => (
              <option key={a} value={a}>
                {a}
              </option>
            ))}
          </Input>
          <Input label={t('form.pincode')} inputMode="numeric" maxLength={6} error={err('address.pincode')} {...field('pincode')} />
          <p className="text-xs text-ink-soft">{t('form.locationHint')}</p>
          <div className="grid grid-cols-2 gap-3">
            <Input label={t('form.lat')} type="number" step="0.00001" error={err('location.lat')} {...field('lat')} />
            <Input label={t('form.lng')} type="number" step="0.00001" error={err('location.lng')} {...field('lng')} />
          </div>
          <Button variant="soft" size="sm" onClick={fillMyLocation} loading={locating} className="self-start">
            <LocateFixed className="h-4 w-4" aria-hidden="true" />
            {t('form.useMyLocation')}
          </Button>
        </Card>
      )}

      <Card className="flex flex-col gap-4">
        <h2 className="text-base font-bold">{t('form.contact')}</h2>
        <Input
          label={submission ? `${t('form.phone')} *` : t('form.phone')}
          type="tel"
          inputMode="tel"
          error={err('contact.phone')}
          {...field('phone')}
        />
        <Input label={t('business.whatsapp')} type="tel" inputMode="tel" error={err('contact.whatsapp')} {...field('whatsapp')} />
        <Input label={t('auth.email')} type="email" error={err('contact.email')} {...field('email')} />
        <Input label={t('form.website')} type="url" placeholder="https://" error={err('contact.website')} {...field('website')} />
      </Card>

      <Card>
        <HoursEditor rows={s.hours} onChange={(hours) => set({ hours })} />
        {err('openingHours') && <p className="mt-2 text-sm text-red-700">{err('openingHours')}</p>}
      </Card>

      {isFood && (
        <Card>
          <FoodFieldsEditor value={s.foodState} onChange={(foodState) => set({ foodState })} error={err('food')} />
        </Card>
      )}

      <Card className="flex flex-col gap-3">
        <h2 className="text-base font-bold">{t('form.photos', { max: MAX_PHOTOS })}</h2>
        <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {s.photos.map((p, i) => (
            <li key={p.publicId}>
              <ImageUpload
                purpose="business_photo"
                value={p}
                alt={`${s.name} ${i + 1}`}
                onChange={(img) => set({ photos: img ? s.photos.map((x, j) => (j === i ? img : x)) : s.photos.filter((_, j) => j !== i) })}
              />
            </li>
          ))}
          {s.photos.length < MAX_PHOTOS && (
            <li key={`new-${s.photos.length}`}>
              <ImageUpload purpose="business_photo" value={null} label={t('form.addPhoto')} onChange={(img) => img && set({ photos: [...s.photos, img] })} />
            </li>
          )}
        </ul>
        {err('photos') && <p className="text-sm text-red-700">{err('photos')}</p>}
      </Card>

      {admin && (
        <Card>
          <OwnerPicker value={s.owner} onChange={(owner) => set({ owner })} />
        </Card>
      )}

      {submission && canSubmitForReview ? (
        <div className="flex flex-col gap-2 sm:flex-row-reverse">
          <Button size="lg" fullWidth loading={submitting} onClick={() => send(true)}>
            <Send className="h-4 w-4" aria-hidden="true" />
            {t('submit.submitForReview')}
          </Button>
          <Button type="submit" variant="secondary" size="lg" fullWidth disabled={submitting}>
            {business ? t('common.save') : t('submit.saveDraft')}
          </Button>
        </div>
      ) : (
        <Button type="submit" size="lg" loading={submitting} fullWidth>
          {t('common.save')}
        </Button>
      )}
    </form>
  );
}
