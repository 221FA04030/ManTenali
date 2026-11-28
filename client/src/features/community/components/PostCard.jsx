import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { BadgeCheck, Heart, MapPin, MessageCircle, Store } from 'lucide-react';
import { Badge, SampleBadge } from '../../../components/ui/Badge.jsx';
import { useToast } from '../../../components/ui/Toast.jsx';
import { errorMessageKey } from '../../../lib/apiClient.js';
import { cldUrl } from '../../../lib/cloudinary.js';
import { cn } from '../../../lib/cn.js';
import { formatRelative } from '../../../lib/format.js';
import { useAuth } from '../../auth/AuthContext.jsx';
import { kindInfo, useLike } from '../api.js';
import { AdminModerationMenu } from '../../moderation/components/AdminModerationMenu.jsx';

/** Round avatar: the person's photo, or their first initial. */
export function Avatar({ person, size = 'md' }) {
  const box = size === 'sm' ? 'h-8 w-8 text-sm' : 'h-10 w-10 text-base';
  if (person?.avatarUrl) return <img src={cldUrl(person.avatarUrl, { w: 80, h: 80 })} alt="" className={cn('shrink-0 rounded-full object-cover', box)} />;
  return (
    <span aria-hidden="true" className={cn('flex shrink-0 items-center justify-center rounded-full bg-brand-100 font-bold text-brand-800', box)}>
      {(person?.name ?? '?').trim().charAt(0).toUpperCase()}
    </span>
  );
}

export function KindBadge({ kind }) {
  const { t } = useTranslation();
  const { icon } = kindInfo(kind);
  return (
    <Badge tone={kind === 'question' ? 'blue' : kind === 'update' ? 'amber' : 'green'} icon={icon}>
      {t(`community.kinds.${kind}`)}
    </Badge>
  );
}

/**
 * Name, time and area above a post, with the type and sample badges on their
 * own row so the name never gets squeezed on narrow cards.
 */
export function PostHeader({ post }) {
  const { t, i18n } = useTranslation();
  return (
    <div className="flex items-start gap-3">
      <Avatar person={post.author} />
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <span className="truncate font-bold leading-snug text-ink">{post.author?.name ?? t('community.someone')}</span>
        <span className="flex flex-wrap items-center gap-x-1.5 text-[13px] leading-snug text-ink-muted">
          <time dateTime={post.createdAt} className="whitespace-nowrap">
            {formatRelative(post.createdAt, i18n.language)}
          </time>
          {post.editedAt && <span className="whitespace-nowrap">· {t('community.edited')}</span>}
          {post.area && (
            <span className="inline-flex min-w-0 items-center gap-0.5">
              <span aria-hidden="true">·</span>
              <MapPin className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
              <span className="truncate">{post.area}</span>
            </span>
          )}
        </span>
        <span className="flex flex-wrap gap-1">
          <KindBadge kind={post.kind} />
          {post.isSeed && <SampleBadge />}
        </span>
      </div>
    </div>
  );
}

/** The business a post is about (only shown while that listing is public). */
export function LinkedBusiness({ business }) {
  const { t } = useTranslation();
  if (!business) return null;
  return (
    <Link
      to={`/businesses/${business.slug}`}
      className="flex min-h-tap items-center gap-2 rounded-xl bg-brand-50 px-3 py-2 text-sm font-semibold text-brand-800 ring-1 ring-brand-100 hover:bg-brand-100"
    >
      <Store className="h-4 w-4 shrink-0" aria-hidden="true" />
      <span className="min-w-0 truncate">{business.name}</span>
      {business.isVerified && <BadgeCheck className="h-4 w-4 shrink-0" aria-label={t('badge.verified')} />}
      {business.area && <span className="ml-auto min-w-0 max-w-[40%] shrink truncate text-xs font-medium text-ink-muted">{business.area}</span>}
    </Link>
  );
}

/** Like button: visitors are sent to log in first. */
export function LikeButton({ post }) {
  const { t } = useTranslation();
  const toast = useToast();
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const like = useLike(post);
  const onClick = () => {
    if (!user) return navigate(`/login?next=${encodeURIComponent(location.pathname + location.search)}`);
    like.mutate(undefined, { onError: (err) => toast.error(t(errorMessageKey(err))) });
    return undefined;
  };
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={like.isPending}
      aria-pressed={post.likedByMe}
      className={cn(
        'inline-flex min-h-tap items-center gap-1.5 rounded-full px-3 text-sm font-semibold transition-colors hover:bg-brand-50 disabled:opacity-60',
        post.likedByMe ? 'text-red-700' : 'text-ink-muted',
      )}
    >
      <Heart className={cn('h-5 w-5', post.likedByMe && 'fill-current')} aria-hidden="true" />
      {/* Name "Like, 2 likes" (one string, includes the visible number - WCAG 2.5.3); liked state is aria-pressed. */}
      <span aria-hidden="true">{post.likeCount}</span>
      <span className="sr-only">{t('community.likeName', { count: post.likeCount })}</span>
    </button>
  );
}

/** Feed card: header, text (clamped), photo, linked business, like and comment counts. */
export function PostCard({ post, headingLevel = 'h3' }) {
  const { t } = useTranslation();
  const Heading = headingLevel;
  return (
    <article className="flex flex-col gap-3 rounded-card bg-white p-4 shadow-card ring-1 ring-brand-100">
      <div className="flex items-start gap-1">
        <div className="min-w-0 flex-1">
          <PostHeader post={post} />
        </div>
        <AdminModerationMenu type="post" id={post.id} title={post.text.slice(0, 80)} className="-mr-2 -mt-2" />
      </div>
      <Link to={`/community/${post.id}`} className="group flex flex-col gap-3">
        <Heading className="sr-only">{t('community.cardHeading', { kind: t(`community.kinds.${post.kind}`), name: post.author?.name ?? t('community.someone') })}</Heading>
        <p className="line-clamp-5 whitespace-pre-line text-[15px] leading-relaxed text-ink group-hover:text-brand-900">{post.text}</p>
        {post.photo && (
          <img src={cldUrl(post.photo.url, { w: 720, h: 405 })} alt="" loading="lazy" className="aspect-video w-full rounded-xl object-cover" />
        )}
      </Link>
      <LinkedBusiness business={post.business} />
      <div className="-mx-2 -mb-2 flex items-center gap-1 border-t border-brand-50 pt-1">
        <LikeButton post={post} />
        <Link
          to={`/community/${post.id}#comments`}
          className="inline-flex min-h-tap items-center gap-1.5 rounded-full px-3 text-sm font-semibold text-ink-muted hover:bg-brand-50"
        >
          <MessageCircle className="h-5 w-5" aria-hidden="true" />
          <span aria-hidden="true">{post.commentCount}</span>
          <span className="sr-only">{t('community.commentsName', { count: post.commentCount })}</span>
        </Link>
      </div>
    </article>
  );
}
