import { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { trackFeature } from '../../home/engagement/engagementStore.js';
import { EyeOff, MessagesSquare, Pencil, Send, Trash2 } from 'lucide-react';
import { PageHeader } from '../../../components/ui/Header.jsx';
import { Card } from '../../../components/ui/Card.jsx';
import { Badge } from '../../../components/ui/Badge.jsx';
import { Button } from '../../../components/ui/Button.jsx';
import { Input } from '../../../components/ui/Input.jsx';
import { Modal } from '../../../components/ui/Modal.jsx';
import { Skeleton, ListSkeleton } from '../../../components/ui/Skeleton.jsx';
import { EmptyState } from '../../../components/ui/EmptyState.jsx';
import { ErrorState } from '../../../components/ui/ErrorState.jsx';
import { useToast } from '../../../components/ui/Toast.jsx';
import { errorMessageKey } from '../../../lib/apiClient.js';
import { cldUrl } from '../../../lib/cloudinary.js';
import { formatRelative } from '../../../lib/format.js';
import { useAuth } from '../../auth/AuthContext.jsx';
import { ItemActions, ReportButton } from '../../engagement/ItemActions.jsx';
import { POST_LIMITS, postsApi, useComments, usePost, usePostMutation } from '../api.js';
import { Avatar, LikeButton, LinkedBusiness, PostHeader } from '../components/PostCard.jsx';
import { AdminModerationMenu, useLeaveAfterDelete } from '../../moderation/components/AdminModerationMenu.jsx';

/** Confirm before removing (authors) or hiding (admins) a post or comment. */
function ConfirmRemove({ open, onClose, onConfirm, loading, title, body, confirmLabel }) {
  const { t } = useTranslation();
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            {t('common.cancel')}
          </Button>
          <Button variant="danger" loading={loading} onClick={onConfirm}>
            {confirmLabel}
          </Button>
        </>
      }
    >
      <p className="text-[15px] text-ink-muted">{body}</p>
    </Modal>
  );
}

function Comment({ comment: c }) {
  const { t, i18n } = useTranslation();
  const toast = useToast();
  const [confirm, setConfirm] = useState(false);
  const remove = usePostMutation(() => postsApi.removeComment(c.id), {
    onSuccess: () => {
      setConfirm(false);
      toast.success(t(c.isMine ? 'community.commentDeleted' : 'community.commentHidden'));
    },
    onError: (err) => toast.error(t(errorMessageKey(err))),
  });
  const canRemove = c.isMine;
  return (
    <li className="flex gap-3">
      <Avatar person={c.author} size="sm" />
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <div className="rounded-2xl rounded-tl-sm bg-brand-50 px-3 py-2">
          <p className="text-sm font-bold text-ink">{c.author?.name ?? t('community.someone')}</p>
          <p className="whitespace-pre-line break-words text-[15px] text-ink">{c.text}</p>
        </div>
        <div className="flex flex-wrap items-center gap-x-3 px-1 text-[13px] text-ink-muted">
          <time dateTime={c.createdAt}>{formatRelative(c.createdAt, i18n.language)}</time>
          {canRemove ? (
            <button type="button" onClick={() => setConfirm(true)} className="inline-flex min-h-tap items-center gap-1 px-1 font-semibold hover:text-ink">
              {c.isMine ? <Trash2 className="h-3.5 w-3.5" aria-hidden="true" /> : <EyeOff className="h-3.5 w-3.5" aria-hidden="true" />}
              {t(c.isMine ? 'community.delete' : 'community.hide')}
            </button>
          ) : (
            <ReportButton targetType="comment" targetId={c.id} title={t('community.commentBy', { name: c.author?.name ?? '' })} compact />
          )}
          {!c.isMine && <AdminModerationMenu type="comment" id={c.id} title={c.text.slice(0, 80)} className="-my-2" />}
        </div>
      </div>
      <ConfirmRemove
        open={confirm}
        onClose={() => setConfirm(false)}
        onConfirm={() => remove.mutate()}
        loading={remove.isPending}
        title={t(c.isMine ? 'community.deleteCommentTitle' : 'community.hideCommentTitle')}
        body={t(c.isMine ? 'community.deleteCommentBody' : 'community.hideBody')}
        confirmLabel={t(c.isMine ? 'community.delete' : 'community.hide')}
      />
    </li>
  );
}

function Comments({ post }) {
  const { t } = useTranslation();
  const toast = useToast();
  const { user } = useAuth();
  const location = useLocation();
  const query = useComments(post.id);
  const items = query.data?.pages.flatMap((pg) => pg.data) ?? [];
  const [text, setText] = useState('');
  const [error, setError] = useState(false);
  const add = usePostMutation((body) => postsApi.addComment(post.id, body), {
    onSuccess: () => {
      setText('');
      trackFeature('community', 'action', `comment:${post.id}`);
    },
    onError: (err) => toast.error(t(errorMessageKey(err))),
  });
  const submit = (e) => {
    e.preventDefault();
    if (!text.trim()) return setError(true);
    setError(false);
    add.mutate({ text: text.trim() });
    return undefined;
  };

  return (
    <section id="comments" aria-labelledby="comments-title" className="flex scroll-mt-20 flex-col gap-3">
      <h2 id="comments-title" className="text-base font-bold">
        {t('community.commentsTitle', { count: post.commentCount })}
      </h2>
      {query.isPending ? (
        <ListSkeleton rows={2} />
      ) : query.isError ? (
        <ErrorState error={query.error} onRetry={() => query.refetch()} />
      ) : items.length === 0 ? (
        <p className="text-sm text-ink-muted">{t('community.noComments')}</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {items.map((c) => (
            <Comment key={c.id} comment={c} />
          ))}
        </ul>
      )}
      {query.hasNextPage && (
        <Button variant="secondary" onClick={() => query.fetchNextPage()} loading={query.isFetchingNextPage}>
          {t('common.loadMore')}
        </Button>
      )}
      {user ? (
        <form noValidate onSubmit={submit} className="flex items-end gap-2">
          <Input
            as="textarea"
            rows={2}
            className="flex-1"
            label={t('community.addComment')}
            maxLength={POST_LIMITS.commentMax}
            value={text}
            onChange={(e) => setText(e.target.value)}
            error={error ? t('community.v.commentEmpty') : undefined}
          />
          <Button type="submit" loading={add.isPending} aria-label={t('community.sendComment')} className="mb-[2px] min-w-tap px-3">
            <Send className="h-5 w-5" aria-hidden="true" />
          </Button>
        </form>
      ) : (
        <Link
          to={`/login?next=${encodeURIComponent(location.pathname)}`}
          className="inline-flex min-h-tap items-center justify-center rounded-full bg-brand-700 px-4 font-semibold text-white hover:bg-brand-800"
        >
          {t('community.loginToComment')}
        </Link>
      )}
    </section>
  );
}

/** /community/:id - the full post, like / save / share / report, and its comments. */
export default function PostDetailPage() {
  const { id } = useParams();
  const { t } = useTranslation();
  const toast = useToast();
  const navigate = useNavigate();
  const location = useLocation();
  const { data: p, isPending, isError, error, refetch } = usePost(id);
  const [confirm, setConfirm] = useState(false);
  const leave = useLeaveAfterDelete('/community');
  const remove = usePostMutation(() => postsApi.remove(id), {
    onSuccess: (res) => {
      setConfirm(false);
      toast.success(t(res.status === 'hidden' ? 'community.postHidden' : 'community.postDeleted'));
      if (res.status === 'removed') navigate('/community', { replace: true });
    },
    onError: (err) => toast.error(t(errorMessageKey(err))),
  });
  // "#comments" links from the feed land on the comments once they are on the page.
  useEffect(() => {
    if (p && location.hash === '#comments') document.getElementById('comments')?.scrollIntoView();
  }, [p, location.hash]);

  if (isPending) {
    return (
      <>
        <PageHeader title={t('pages.community')} />
        <div className="flex flex-col gap-3 p-4">
          <Skeleton className="h-40 w-full rounded-card" />
          <ListSkeleton rows={2} />
        </div>
      </>
    );
  }
  if (isError) {
    return (
      <>
        <PageHeader title={t('pages.community')} />
        <div className="p-4">
          {error?.status === 404 ? (
            <EmptyState icon={MessagesSquare} title={t('community.notFound')} body={t('community.notFoundBody')} />
          ) : (
            <ErrorState error={error} onRetry={refetch} />
          )}
        </div>
      </>
    );
  }

  const isPublic = !p.status || p.status === 'published';
  const title = `${t(`community.kinds.${p.kind}`)} - ${p.author?.name ?? ''}`;
  return (
    <>
      <PageHeader title={t('pages.community')} />
      <article className="flex flex-col gap-5 p-4">
        {!isPublic && (
          <p className="flex items-center gap-2 rounded-xl bg-amber-50 p-3 text-sm text-amber-900">
            <Badge tone="gray">{t(`community.status.${p.status}`)}</Badge> {t('community.adminPreview')}
          </p>
        )}
        <Card className="flex flex-col gap-4">
          <div className="flex items-start gap-1">
            <div className="min-w-0 flex-1">
              <PostHeader post={p} />
            </div>
            <AdminModerationMenu type="post" id={p.id} title={p.text.slice(0, 80)} onDone={leave} className="-mr-2 -mt-2" />
          </div>
          <h2 className="sr-only">{title}</h2>
          <p className="whitespace-pre-line break-words text-base leading-relaxed text-ink">{p.text}</p>
          {p.photo && <img src={cldUrl(p.photo.url, { w: 960 })} alt="" className="max-h-[70vh] w-full rounded-xl object-cover" />}
          <LinkedBusiness business={p.business} />
          <div className="-mx-2 flex flex-wrap items-center gap-1 border-t border-brand-50 pt-2">
            <LikeButton post={p} />
            {p.isMine && isPublic && (
              <span className="ml-auto flex gap-1">
                {p.isMine && (
                  <Link
                    to={`/community/${p.id}/edit`}
                    className="inline-flex min-h-tap items-center gap-1.5 rounded-full px-3 text-sm font-semibold text-ink-muted hover:bg-brand-50 hover:text-ink"
                  >
                    <Pencil className="h-4 w-4" aria-hidden="true" /> {t('community.edit')}
                  </Link>
                )}
                <button
                  type="button"
                  onClick={() => setConfirm(true)}
                  className="inline-flex min-h-tap items-center gap-1.5 rounded-full px-3 text-sm font-semibold text-red-700 hover:bg-red-50"
                >
                  {p.isMine ? <Trash2 className="h-4 w-4" aria-hidden="true" /> : <EyeOff className="h-4 w-4" aria-hidden="true" />}
                  {t(p.isMine ? 'community.delete' : 'community.hide')}
                </button>
              </span>
            )}
          </div>
        </Card>
        {isPublic && <ItemActions targetType="post" targetId={p.id} title={title} canReport={!p.isMine} />}
        {isPublic && <Comments post={p} />}
      </article>
      <ConfirmRemove
        open={confirm}
        onClose={() => setConfirm(false)}
        onConfirm={() => remove.mutate()}
        loading={remove.isPending}
        title={t(p.isMine ? 'community.deletePostTitle' : 'community.hidePostTitle')}
        body={t(p.isMine ? 'community.deletePostBody' : 'community.hideBody')}
        confirmLabel={t(p.isMine ? 'community.delete' : 'community.hide')}
      />
    </>
  );
}
