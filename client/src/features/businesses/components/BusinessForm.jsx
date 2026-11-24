import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { LocateFixed } from 'lucide-react';
import { Card } from '../../../components/ui/Card.jsx';
import { Input } from '../../../components/ui/Input.jsx';
import { Button } from '../../../components/ui/Button.jsx';
import { ImageUpload } from '../../../components/ui/ImageUpload.jsx';
import { useCategories, categoryName } from '../../categories/api.js';
import { TENALI_AREAS } from '../../../config/areas.js';
import { getCurrentPosition } from '../../../lib/geo.js';
import { HoursEditor, hoursToRows, rowsToHours } from './HoursEditor.jsx';
import { OwnerPicker } from './OwnerPicker.jsx';
import { KINDS } from '../api.js';

const MAX_PHOTOS = 8;
const TENALI = { lat: 16.2379, lng: 80.6444 };

function initialState(b) {
  return {
    name: b?.name ?? '',
    categoryId: b?.category?.id ?? '',
    kind: b?.kind ?? 'shop',
    status: b?.status ?? 'draft',
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
  };
}

/** Build the API payload. Owners only send the fields they're allowed to edit. */
export function toPayload(s, mode, original) {
  const payload = {
    description: s.description.trim(),
    tags: s.tags.split(',').map((x) => x.trim()).filter(Boolean),
    contact: { phone: s.phone.trim(), whatsapp: s.whatsapp.trim(), email: s.email.trim(), website: s.website.trim() },
    openingHours: rowsToHours(s.hours),
    photos: s.photos,
  };
  if (mode !== 'admin') return payload;
  Object.assign(payload, {
    name: s.name.trim(),
    categoryId: s.categoryId,
    kind: s.kind,
    status: s.status,
    address: { line: s.line.trim(), area: s.area.trim(), pincode: s.pincode.trim() },
    location: { lat: Number(s.lat), lng: Number(s.lng) },
  });
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
 * Shared create/edit form. mode="admin" shows identity, placement, status and
 * owner fields; mode="owner" shows only what owners may change (FR-BUS-5).
 */
export function BusinessForm({ mode, business, onSubmit, submitting, serverErrors = {} }) {
  const { t, i18n } = useTranslation();
  const [s, setS] = useState(() => initialState(business));
  const [locating, setLocating] = useState(false);
  const { data: categories = [] } = useCategories('business', { enabled: mode === 'admin' });
  const set = (patch) => setS((prev) => ({ ...prev, ...patch }));
  const field = (name) => ({ value: s[name], onChange: (e) => set({ [name]: e.target.value }) });
  const err = (key) => serverErrors[key];
  const admin = mode === 'admin';

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
        onSubmit(toPayload(s, mode, business));
      }}
    >
      {admin && (
        <Card className="flex flex-col gap-4">
          <h2 className="text-base font-bold">{t('form.basics')}</h2>
          <Input label={t('form.name')} required error={err('name')} {...field('name')} />
          <Input as="select" label={t('business.category')} error={err('categoryId')} {...field('categoryId')}>
            <option value="">{t('form.choose')}</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {categoryName(c, i18n.language)}
              </option>
            ))}
          </Input>
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
        </Card>
      )}

      <Card className="flex flex-col gap-4">
        <h2 className="text-base font-bold">{t('business.about')}</h2>
        <Input as="textarea" label={t('form.description')} maxLength={2000} error={err('description')} {...field('description')} />
        <Input label={t('form.tags')} hint={t('form.tagsHint')} error={err('tags')} {...field('tags')} />
      </Card>

      {admin && (
        <Card className="flex flex-col gap-4">
          <h2 className="text-base font-bold">{t('business.address')}</h2>
          <Input label={t('form.addressLine')} error={err('address.line')} {...field('line')} />
          <Input as="select" label={t('location.area')} error={err('address.area')} {...field('area')}>
            <option value="">{t('form.choose')}</option>
            {[...new Set([...TENALI_AREAS, s.area].filter(Boolean))].map((a) => (
              <option key={a} value={a}>
                {a}
              </option>
            ))}
          </Input>
          <Input label={t('form.pincode')} inputMode="numeric" maxLength={6} error={err('address.pincode')} {...field('pincode')} />
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
        <Input label={t('form.phone')} type="tel" inputMode="tel" error={err('contact.phone')} {...field('phone')} />
        <Input label={t('business.whatsapp')} type="tel" inputMode="tel" error={err('contact.whatsapp')} {...field('whatsapp')} />
        <Input label={t('auth.email')} type="email" error={err('contact.email')} {...field('email')} />
        <Input label={t('form.website')} type="url" placeholder="https://" error={err('contact.website')} {...field('website')} />
      </Card>

      <Card>
        <HoursEditor rows={s.hours} onChange={(hours) => set({ hours })} />
        {err('openingHours') && <p className="mt-2 text-sm text-red-700">{err('openingHours')}</p>}
      </Card>

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

      <Button type="submit" size="lg" loading={submitting} fullWidth>
        {t('common.save')}
      </Button>
    </form>
  );
}
