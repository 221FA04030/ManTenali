import { useEffect, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { MessagesSquare, X } from 'lucide-react';
import { PageHeader } from '../../../components/ui/Header.jsx';
import { Card } from '../../../components/ui/Card.jsx';
import { Input } from '../../../components/ui/Input.jsx';
import { Button } from '../../../components/ui/Button.jsx';
import { ImageUpload } from '../../../components/ui/ImageUpload.jsx';
import { ListSkeleton } from '../../../components/ui/Skeleton.jsx';
import { EmptyState } from '../../../components/ui/EmptyState.jsx';
import { ErrorState } from '../../../components/ui/ErrorState.jsx';
import { useToast } from '../../../components/ui/Toast.jsx';
import { errorMessageKey } from '../../../lib/apiClient.js';
import { cn } from '../../../lib/cn.js';
import { TENALI_AREAS } from '../../../config/areas.js';
import { useAuth } from '../../auth/AuthContext.jsx';
import { useBusiness } from '../../businesses/api.js';
import { POST_KINDS, POST_LIMITS, postsApi, usePost, usePostMutation } from '../api.js';
import { LinkedBusiness } from '../components/PostCard.jsx';

const EMPTY = { kind: 'recommendation', text: '', area: '', photo: null };

function PostForm({ post, business, onDone }) {
  const { t } = useTranslation();
  const toast = useToast();
  const { user } = useAuth();
  const [s, setS] = useState(() =>
    post ? { kind: post.kind, text: post.text, area: post.area ?? '', photo: post.photo } : { ...EMPTY, area: user?.preferredArea ?? '' },
  );
  const [linked, setLinked] = useState(post ? post.business : business);
  const [error, setError] = useState(null);
  const set = (patch) => setS((prev) => ({ ...prev, ...patch }));
  useEffect(() => {
    if (!post && business) setLinked(business);
  }, [post, business]);

  const mutation = usePostMutation((body) => (post ? postsApi.update(post.id, body) : postsApi.create(body)), {
    onSuccess: (saved) => {
      toast.success(t(post ? 'community.updated' : 'community.posted'));
      onDone(saved);
    },
    onError: (err) => toast.error(err.status === 429 || err.status === 409 ? err.message : t(errorMessageKey(err))),
  });

  const submit = (e) => {
    e.preventDefault();
    const text = s.text.trim();
    if (text.length < POST_LIMITS.textMin) return setError(t('community.v.textShort', { min: POST_LIMITS.textMin }));
    setError(null);
    mutation.mutate({
      kind: s.kind,
      text,
      area: s.area || null,
      photo: s.photo ? { url: s.photo.url, publicId: s.photo.publicId } : null,
      businessId: linked?.id ?? null,
    });
    return undefined;
  };

  const areas = [...new Set([...TENALI_AREAS, s.area].filter(Boolean))];
  return (
    <form noValidate onSubmit={submit} className="flex flex-col gap-4">
      <Card className="flex flex-col gap-4">
        <fieldset className="flex flex-col gap-2">
          <legend className="mb-1 text-sm font-semibold text-ink">{t('community.f.kind')}</legend>
          <div className="grid grid-cols-3 gap-2">
            {POST_KINDS.map(({ key, icon: Icon }) => (
              <label
                key={key}
                className={cn(
                  'flex min-h-[64px] cursor-pointer flex-col items-center justify-center gap-1 rounded-xl px-2 text-center text-[13px] font-semibold ring-1 transition-colors has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-brand-700',
                  s.kind === key ? 'bg-brand-700 text-white ring-brand-700' : 'bg-white text-ink ring-brand-200 hover:bg-brand-50',
                )}
              >
                <input type="radio" name="post-kind" value={key} checked={s.kind === key} onChange={() => set({ kind: key })} className="sr-only" />
                <Icon className="h-5 w-5" aria-hidden="true" />
                {t(`community.kinds.${key}`)}
              </label>
            ))}
          </div>
          <p className="text-xs text-ink-soft">{t(`community.kindHints.${s.kind}`)}</p>
        </fieldset>
        <Input
          as="textarea"
          label={`${t('community.f.text')} *`}
          rows={6}
          maxLength={POST_LIMITS.textMax}
          value={s.text}
          onChange={(e) => set({ text: e.target.value })}
          placeholder={t(`community.placeholders.${s.kind}`)}
          error={error ?? undefined}
          hint={t('community.f.textHint', { used: s.text.length, max: POST_LIMITS.textMax })}
        />
        <Input as="select" label={t('community.f.area')} value={s.area} onChange={(e) => set({ area: e.target.value })}>
          <option value="">{t('community.f.noArea')}</option>
          {areas.map((a) => (
            <option key={a} value={a}>
              {a}
            </option>
          ))}
        </Input>
        {linked && (
          <div className="flex flex-col gap-1.5">
            <span className="text-sm font-semibold text-ink">{t('community.f.business')}</span>
            <div className="flex items-center gap-2">
              <div className="min-w-0 flex-1">
                <LinkedBusiness business={linked} />
              </div>
              <button
                type="button"
                onClick={() => setLinked(null)}
                className="flex min-h-tap min-w-tap items-center justify-center rounded-full text-ink-muted hover:bg-brand-50"
                aria-label={t('community.f.unlinkBusiness')}
              >
                <X className="h-5 w-5" aria-hidden="true" />
              </button>
            </div>
          </div>
        )}
        <ImageUpload purpose="post_photo" label={t('community.f.photo')} value={s.photo} onChange={(photo) => set({ photo })} />
        <p className="text-xs text-ink-soft">{t('community.f.rules')}</p>
      </Card>
      <Button type="submit" loading={mutation.isPending} fullWidth size="lg">
        {t(post ? 'community.saveChanges' : 'community.publish')}
      </Button>
    </form>
  );
}

/** /community/new (optionally ?business=<slug>) and /community/:id/edit. */
export default function PostEditorPage() {
  const { t } = useTranslation();
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const existing = usePost(id);
  const bizSlug = id ? undefined : (searchParams.get('business') ?? undefined);
  const biz = useBusiness(bizSlug);
  const business = biz.data ? { id: biz.data.id, slug: biz.data.slug, name: biz.data.name, area: biz.data.address?.area ?? null, isVerified: biz.data.isVerified } : null;
  const title = t(id ? 'community.editTitle' : 'community.newTitle');
  const done = (saved) => navigate(`/community/${saved.id}`, { replace: true });

  let body;
  if (id && existing.isPending) body = <ListSkeleton rows={2} />;
  else if (id && existing.isError)
    body = existing.error?.status === 404 ? <EmptyState icon={MessagesSquare} title={t('community.notFound')} body={t('community.notFoundBody')} /> : <ErrorState error={existing.error} onRetry={existing.refetch} />;
  else if (id && !existing.data.isMine) body = <EmptyState icon={MessagesSquare} title={t('community.notFound')} body={t('community.notFoundBody')} />;
  else if (bizSlug && biz.isPending) body = <ListSkeleton rows={2} />;
  else body = <PostForm post={id ? existing.data : null} business={business} onDone={done} />;

  return (
    <>
      <PageHeader title={title} />
      <div className="flex flex-col gap-4 p-4">{body}</div>
    </>
  );
}
