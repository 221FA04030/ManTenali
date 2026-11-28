import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Camera, Heart, MapPin, MessageCircle } from 'lucide-react';
import { Section } from '../../../components/ui/Section.jsx';
import { Skeleton } from '../../../components/ui/Skeleton.jsx';
import { ErrorState } from '../../../components/ui/ErrorState.jsx';
import { postsApi } from '../../community/api.js';
import { cldUrl } from '../../../lib/cloudinary.js';
import { formatRelative } from '../../../lib/format.js';
import { cn } from '../../../lib/cn.js';

/** Posts fetched for Home: recent ones with a photo, one small page. */
const FEED_LIMIT = 12;
/** Each row is repeated until it has at least this many cards, so the loop always fills the screen. */
const MIN_CARDS_PER_LOOP = 6;
/** Seconds each card takes to pass by: slow and calm. Row 2 is a little slower. */
const SECONDS_PER_CARD = 7;
/** After a touch, wait this long before the rows move again. */
const RESUME_AFTER_TOUCH_MS = 2500;

const prefersReducedMotion = () =>
  typeof window !== 'undefined' && typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/** Under ['posts', ...] so any like, comment or new post refreshes it. */
function useHomeCommunityPosts() {
  return useQuery({
    queryKey: ['posts', 'home-photos'],
    queryFn: () => postsApi.feed({ withPhoto: 'true', limit: FEED_LIMIT }),
    select: (res) => (res.data ?? []).filter((p) => p.photo?.url),
    staleTime: 60_000,
  });
}

function Avatar({ author }) {
  if (author?.avatarUrl) {
    return <img src={cldUrl(author.avatarUrl, { w: 48, h: 48 })} alt="" loading="lazy" className="h-6 w-6 shrink-0 rounded-full object-cover" />;
  }
  return (
    <span aria-hidden="true" className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary-light text-[11px] font-semibold text-primary-dark">
      {(author?.name ?? '?').trim().charAt(0).toUpperCase()}
    </span>
  );
}

/** One post: the photo first, then who posted it, when, and its likes and comments. */
export function CommunityPostCard({ post, copy = false, onImageError }) {
  const { t, i18n } = useTranslation();
  const name = post.author?.name ?? t('community.someone', { defaultValue: 'Someone' });
  return (
    <Link
      to={`/community/${post.id}`}
      aria-hidden={copy || undefined}
      tabIndex={copy ? -1 : undefined}
      aria-label={copy ? undefined : t('home.communityPosts.open', { name, text: post.text })}
      draggable={false}
      className="block w-[clamp(10.5rem,44vw,12.5rem)] shrink-0 overflow-hidden rounded-card bg-white shadow-card ring-1 ring-line transition-transform hover:-translate-y-0.5 focus-visible:ring-2 focus-visible:ring-primary"
    >
      <span className="relative block aspect-square w-full overflow-hidden bg-photo-placeholder">
        <img
          src={cldUrl(post.photo.url, { w: 400, h: 400 })}
          alt=""
          width={400}
          height={400}
          loading="lazy"
          decoding="async"
          draggable={false}
          onError={() => onImageError?.(post.id)}
          className="h-full w-full object-cover"
        />
        <span aria-hidden="true" className="absolute inset-x-0 bottom-0 h-2/3 bg-gradient-to-t from-black/70 via-black/25 to-transparent" />
        {post.area && (
          <span className="absolute left-2 top-2 inline-flex max-w-[85%] items-center gap-1 rounded-full bg-white/90 px-2 py-0.5 text-[11px] font-medium text-primary-dark backdrop-blur-sm">
            <MapPin className="h-3 w-3 shrink-0" aria-hidden="true" />
            <span className="truncate">{post.area}</span>
          </span>
        )}
        <span className="absolute inset-x-2.5 bottom-2 line-clamp-2 text-[13px] font-medium leading-snug text-white [text-shadow:0_1px_2px_rgba(0,0,0,0.4)]">
          {post.text}
        </span>
      </span>
      <span className="flex items-center gap-2 px-2.5 pb-2 pt-2">
        <Avatar author={post.author} />
        <span className="flex min-w-0 flex-1 flex-col">
          <span className="truncate text-[12px] font-semibold leading-tight text-heading">{name}</span>
          <span className="truncate text-[11px] leading-tight text-meta">{formatRelative(post.createdAt, i18n.language)}</span>
        </span>
      </span>
      <span className="flex items-center gap-3 border-t border-line px-2.5 py-1.5 text-[12px] text-meta">
        <span className="inline-flex items-center gap-1" aria-label={t('home.communityPosts.likes', { count: post.likeCount })}>
          <Heart className={cn('h-3.5 w-3.5', post.likedByMe && 'fill-rose-500 text-rose-500')} aria-hidden="true" />
          <span aria-hidden="true">{post.likeCount}</span>
        </span>
        <span className="inline-flex items-center gap-1" aria-label={t('home.communityPosts.comments', { count: post.commentCount })}>
          <MessageCircle className="h-3.5 w-3.5" aria-hidden="true" />
          <span aria-hidden="true">{post.commentCount}</span>
        </span>
      </span>
    </Link>
  );
}

/**
 * One slowly drifting row. The cards are drawn twice and the track moves by
 * exactly half its width, so the loop restarts without a visible jump (CSS
 * transform only: smooth on low-end phones, no re-renders while it moves).
 */
export function FloatingPostRow({ posts, reverse = false, slower = false, paused, onImageError }) {
  const loop = useMemo(() => {
    const times = Math.max(1, Math.ceil(MIN_CARDS_PER_LOOP / posts.length));
    return Array.from({ length: times }, (_, i) => posts.map((p) => ({ post: p, copy: i > 0 }))).flat();
  }, [posts]);
  const seconds = loop.length * SECONDS_PER_CARD * (slower ? 1.15 : 1);
  return (
    <div className="overflow-hidden py-1.5">
      <ul
        className={cn('float-track flex w-max', reverse && 'float-track-reverse')}
        style={{ animationDuration: `${seconds}s`, animationPlayState: paused ? 'paused' : 'running' }}
      >
        {[0, 1].map((half) =>
          loop.map(({ post, copy }, i) => (
            <li key={`${half}-${i}-${post.id}`} aria-hidden={half === 1 || copy || undefined} className="pl-3">
              <CommunityPostCard post={post} copy={half === 1 || copy} onImageError={onImageError} />
            </li>
          )),
        )}
      </ul>
    </div>
  );
}

function FeedSkeleton() {
  return (
    <div className="flex gap-3 overflow-hidden px-4" aria-hidden="true">
      {[0, 1, 2].map((i) => (
        <Skeleton key={i} className="h-[17rem] w-[clamp(10.5rem,44vw,12.5rem)] shrink-0 rounded-card" />
      ))}
    </div>
  );
}

/**
 * Home's Community Posts (replaces Explore Tenali): real posts with photos that
 * people uploaded, drifting slowly in one row, or two rows going opposite ways
 * when there are enough. Touching, hovering or focusing a row pauses it; people
 * who prefer reduced motion get a still row they can scroll themselves.
 */
export function CommunityPostsFeed() {
  const { t } = useTranslation();
  const feed = useHomeCommunityPosts();
  const [broken, setBroken] = useState(() => new Set());
  const [paused, setPaused] = useState(false);
  const [still] = useState(prefersReducedMotion);
  const resumeTimer = useRef(null);
  useEffect(() => () => clearTimeout(resumeTimer.current), []);

  const posts = useMemo(() => (feed.data ?? []).filter((p) => !broken.has(p.id)), [feed.data, broken]);
  const onImageError = (id) => setBroken((prev) => (prev.has(id) ? prev : new Set(prev).add(id)));
  const rows = posts.length >= 6 ? [posts.filter((_, i) => i % 2 === 0), posts.filter((_, i) => i % 2 === 1)] : [posts];

  const hold = () => {
    clearTimeout(resumeTimer.current);
    setPaused(true);
  };
  const release = (delay = 0) => {
    clearTimeout(resumeTimer.current);
    resumeTimer.current = setTimeout(() => setPaused(false), delay);
  };

  let body;
  if (feed.isPending) body = <FeedSkeleton />;
  else if (feed.isError)
    body = (
      <div className="px-4">
        <ErrorState error={feed.error} onRetry={() => feed.refetch()} />
      </div>
    );
  else if (posts.length === 0)
    body = (
      <div className="mx-4 flex flex-col items-center gap-2 rounded-card border border-dashed border-line bg-surface-soft px-6 py-7 text-center">
        <Camera className="h-7 w-7 text-primary" strokeWidth={1.75} aria-hidden="true" />
        <p className="text-sm text-meta">{t('home.communityPosts.empty')}</p>
        <Link to="/community/new" className="mt-1 rounded-full bg-primary px-4 py-2 text-sm font-semibold text-white hover:bg-primary-dark">
          {t('home.communityPosts.share')}
        </Link>
      </div>
    );
  else if (still)
    body = (
      <ul aria-label={t('home.communityPosts.label')} className="no-scrollbar flex snap-x gap-3 overflow-x-auto px-4 py-1.5">
        {posts.map((p) => (
          <li key={p.id} className="snap-start">
            <CommunityPostCard post={p} onImageError={onImageError} />
          </li>
        ))}
      </ul>
    );
  else
    body = (
      <div
        role="group"
        aria-label={t('home.communityPosts.label')}
        data-paused={paused ? 'true' : 'false'}
        onPointerEnter={(e) => e.pointerType === 'mouse' && hold()}
        onPointerLeave={(e) => e.pointerType === 'mouse' && release()}
        onPointerDown={hold}
        onPointerUp={(e) => e.pointerType !== 'mouse' && release(RESUME_AFTER_TOUCH_MS)}
        onPointerCancel={() => release(RESUME_AFTER_TOUCH_MS)}
        onFocus={hold}
        onBlur={(e) => !e.currentTarget.contains(e.relatedTarget) && release()}
      >
        {rows.map((row, i) => (
          <FloatingPostRow key={i} posts={row} reverse={i === 1} slower={i === 1} paused={paused} onImageError={onImageError} />
        ))}
      </div>
    );

  return (
    <Section id="home-community-posts" band="line" title={t('home.communityPosts.title')} subtitle={t('home.communityPosts.subtitle')} to="/community">
      {body}
    </Section>
  );
}
