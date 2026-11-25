import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Card } from '../../../components/ui/Card.jsx';
import { Input } from '../../../components/ui/Input.jsx';
import { Button } from '../../../components/ui/Button.jsx';
import { ImageUpload } from '../../../components/ui/ImageUpload.jsx';
import { useCategories, categoryName, withCurrentCategory } from '../../categories/api.js';
import { istNowLocal } from '../../../lib/dates.js';
import { MAX_PINNED, NEWS_TYPE_KEYS, NOTICE_TYPES } from '../api.js';

const LOCAL_RX = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/;
const YEAR_MS = 366 * 86_400_000;
const toMs = (local) => Date.parse(`${local}:00Z`); // comparison only (both IST)

export function newsToState(n) {
  return {
    title: n?.title ?? '',
    summary: n?.summary ?? '',
    body: n?.body ?? '',
    type: n?.type ?? 'news',
    categoryId: n?.categoryId ?? n?.category?.id ?? '',
    coverImage: n?.coverImage ?? null,
    sourceName: n?.sourceName ?? '',
    sourceUrl: n?.sourceUrl ?? '',
    validUntil: n?.validUntilLocal ?? '',
    isPinned: Boolean(n?.isPinned),
    status: 'draft',
  };
}

/**
 * Client checks mirroring the server. "Show until" must be in the future and
 * within a year, but only when it is new or changed (`originalValidUntil`), so an
 * expired notice can still be edited.
 */
export function validateNews(s, { now = new Date(), originalValidUntil = '' } = {}) {
  const e = {};
  if (s.title.trim().length < 3) e.title = 'news.v.title';
  if (s.summary.trim().length < 10) e.summary = 'news.v.summary';
  if (s.sourceName.trim().length < 2) e.sourceName = 'news.v.source';
  if (s.sourceUrl.trim() && !/^https:\/\/\S+\.\S+/.test(s.sourceUrl.trim())) e.sourceUrl = 'news.v.sourceUrl';
  if (s.validUntil && s.validUntil !== originalValidUntil) {
    if (!LOCAL_RX.test(s.validUntil)) e.validUntil = 'news.v.validUntil';
    else if (s.validUntil <= istNowLocal(now)) e.validUntil = 'news.v.validUntilPast';
    else if (toMs(s.validUntil) - toMs(istNowLocal(now)) > YEAR_MS) e.validUntil = 'news.v.validUntilFar';
  }
  return e;
}

/** State -> API body. On edits, cleared optional fields are sent as null. */
export function newsPayload(s, { editing = false } = {}) {
  const clear = editing ? null : undefined;
  const p = {
    title: s.title.trim(),
    summary: s.summary.trim(),
    body: s.body.trim(),
    type: s.type,
    categoryId: s.categoryId || clear,
    coverImage: s.coverImage ?? clear,
    sourceName: s.sourceName.trim(),
    sourceUrl: s.sourceUrl.trim() || clear,
    validUntil: s.validUntil || clear,
    isPinned: s.isPinned,
  };
  if (!editing) p.status = s.status;
  return Object.fromEntries(Object.entries(p).filter(([, v]) => v !== undefined));
}

/** Admin news form (create and edit). `onSubmit(state)`. */
export function NewsForm({ item, onSubmit, submitting, serverErrors = {} }) {
  const { t, i18n } = useTranslation();
  const [s, setS] = useState(() => newsToState(item));
  const [errors, setErrors] = useState({});
  const { data: active = [] } = useCategories('news');
  const categories = withCurrentCategory(active, item?.category);
  const set = (patch) => setS((p) => ({ ...p, ...patch }));
  const field = (name) => ({ value: s[name], onChange: (e) => set({ [name]: e.target.value }) });
  const err = (k) => (errors[k] ? t(errors[k]) : serverErrors[k]);
  const isNotice = NOTICE_TYPES.includes(s.type);

  return (
    <form
      noValidate
      className="flex flex-col gap-4"
      onSubmit={(e) => {
        e.preventDefault();
        const found = validateNews(s, { originalValidUntil: item?.validUntilLocal ?? '' });
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
        <Input as="select" label={`${t('news.type')} *`} error={err('type')} {...field('type')}>
          {NEWS_TYPE_KEYS.map((k) => (
            <option key={k} value={k}>
              {t(`news.types.${k}`)}
            </option>
          ))}
        </Input>
        <Input label={`${t('news.f.title')} *`} maxLength={140} error={err('title')} {...field('title')} />
        <Input as="textarea" label={`${t('news.f.summary')} *`} maxLength={300} hint={t('news.f.summaryHint')} error={err('summary')} {...field('summary')} />
        <Input as="textarea" label={t('news.f.body')} maxLength={5000} hint={t('news.f.bodyHint')} error={err('body')} {...field('body')} />
        <Input as="select" label={t('business.category')} error={err('categoryId')} {...field('categoryId')}>
          <option value="">{t('news.f.noCategory')}</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.inactive ? t('form.inactiveCategory', { name: categoryName(c, i18n.language) }) : categoryName(c, i18n.language)}
            </option>
          ))}
        </Input>
      </Card>

      <Card className="flex flex-col gap-4">
        <h2 className="text-base font-bold">{t('news.f.trust')}</h2>
        <Input label={`${t('news.f.sourceName')} *`} maxLength={100} placeholder={t('news.f.sourcePlaceholder')} hint={t('news.f.sourceHint')} error={err('sourceName')} {...field('sourceName')} />
        <Input label={t('news.f.sourceUrl')} type="url" placeholder="https://" error={err('sourceUrl')} {...field('sourceUrl')} />
        <div className="flex flex-col gap-2">
          <Input
            label={t('news.f.validUntil')}
            type="datetime-local"
            hint={isNotice && !s.validUntil ? t('news.f.validUntilSuggest') : t('news.f.validUntilHint')}
            error={err('validUntil')}
            {...field('validUntil')}
          />
          {s.validUntil && (
            <Button variant="soft" className="self-start" onClick={() => set({ validUntil: '' })}>
              {t('news.f.clearValidUntil')}
            </Button>
          )}
        </div>
      </Card>

      <Card className="flex flex-col gap-4">
        <ImageUpload purpose="news_cover" label={t('news.f.cover')} value={s.coverImage} onChange={(coverImage) => set({ coverImage })} />
        <label className="flex min-h-tap items-start gap-2 text-[15px]">
          <input type="checkbox" checked={s.isPinned} onChange={(e) => set({ isPinned: e.target.checked })} className="mt-0.5 h-5 w-5 accent-brand-700" />
          <span>
            {t('news.f.pin')}
            <span className="block text-xs text-ink-soft">{t('news.f.pinHint', { max: MAX_PINNED })}</span>
          </span>
        </label>
        {!item && (
          <Input as="select" label={t('form.status')} {...field('status')}>
            <option value="draft">{t('status.draft')}</option>
            <option value="published">{t('status.published')}</option>
          </Input>
        )}
      </Card>

      <Button type="submit" size="lg" fullWidth loading={submitting}>
        {t('common.save')}
      </Button>
    </form>
  );
}
