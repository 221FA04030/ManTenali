import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { EyeOff, MessageSquareText, Pencil, Trash2 } from 'lucide-react';
import { Card } from '../../../components/ui/Card.jsx';
import { Button } from '../../../components/ui/Button.jsx';
import { Input } from '../../../components/ui/Input.jsx';
import { Modal } from '../../../components/ui/Modal.jsx';
import { ListSkeleton } from '../../../components/ui/Skeleton.jsx';
import { ErrorState } from '../../../components/ui/ErrorState.jsx';
import { SampleBadge } from '../../../components/ui/Badge.jsx';
import { useToast } from '../../../components/ui/Toast.jsx';
import { errorMessageKey } from '../../../lib/apiClient.js';
import { formatDate } from '../../../lib/format.js';
import { useAuth } from '../../auth/AuthContext.jsx';
import { ReportButton } from '../../engagement/ItemActions.jsx';
import { reviewsApi, useBusinessReviews, useMyReviewFor, useReviewMutation } from '../api.js';
import { StarInput, Stars } from './Stars.jsx';

const linkBtn = 'inline-flex min-h-tap items-center gap-1 px-1 text-[13px] font-semibold text-ink-muted hover:text-ink';

function ReviewForm({ businessId, review, onDone }) {
  const { t } = useTranslation();
  const toast = useToast();
  const [rating, setRating] = useState(review?.rating ?? 0);
  const [comment, setComment] = useState(review?.comment ?? '');
  const [error, setError] = useState(null);
  const mutation = useReviewMutation(
    () => (review ? reviewsApi.update(review.id, { rating, comment: comment.trim() }) : reviewsApi.create(businessId, { rating, ...(comment.trim() ? { comment: comment.trim() } : {}) })),
    {
      onSuccess: () => {
        toast.success(t(review ? 'reviews.updated' : 'reviews.posted'));
        onDone?.();
      },
      onError: (err) => toast.error(err.status === 409 || err.status === 403 ? err.message : t(errorMessageKey(err))),
    },
  );
  return (
    <form
      noValidate
      className="flex flex-col gap-3"
      onSubmit={(e) => {
        e.preventDefault();
        if (!rating) return setError(t('reviews.chooseRating'));
        setError(null);
        mutation.mutate();
        return undefined;
      }}
    >
      <StarInput value={rating} onChange={setRating} error={error} name={`rating-${review?.id ?? 'new'}`} />
      <Input as="textarea" label={t('reviews.comment')} maxLength={1000} value={comment} onChange={(e) => setComment(e.target.value)} hint={t('reviews.commentHint')} />
      <div className="flex gap-2">
        {review && (
          <Button variant="secondary" onClick={onDone}>
            {t('common.cancel')}
          </Button>
        )}
        <Button type="submit" loading={mutation.isPending} className="flex-1">
          {review ? t('common.save') : t('reviews.post')}
        </Button>
      </div>
    </form>
  );
}

function ReviewItem({ review, actions }) {
  const { t, i18n } = useTranslation();
  return (
    <li className="flex flex-col gap-1 py-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-semibold">{review.author?.name ?? t('reviews.someone')}</span>
        <Stars value={review.rating} />
        {review.isSeed && <SampleBadge />}
      </div>
      {review.comment && <p className="whitespace-pre-line text-[15px] leading-relaxed text-ink-muted">{review.comment}</p>}
      <div className="flex flex-wrap items-center gap-x-3 text-xs text-ink-soft">
        <span>
          {formatDate(review.createdAt, i18n.language)}
          {review.isEdited && ` • ${t('reviews.edited')}`}
        </span>
        {actions}
      </div>
    </li>
  );
}

/** My own review: shown first, with edit and delete; a hidden one is explained. */
function MyReview({ businessId, review }) {
  const { t } = useTranslation();
  const toast = useToast();
  const [editing, setEditing] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const remove = useReviewMutation(() => reviewsApi.remove(review.id), {
    onSuccess: () => {
      setConfirm(false);
      toast.success(t('reviews.deleted'));
    },
    onError: (err) => toast.error(t(errorMessageKey(err))),
  });
  if (editing) return <ReviewForm businessId={businessId} review={review} onDone={() => setEditing(false)} />;
  return (
    <div className="rounded-xl bg-brand-50 px-3 ring-1 ring-brand-100">
      <p className="pt-3 text-xs font-bold uppercase tracking-wide text-brand-800">{t('reviews.yourReview')}</p>
      {review.status === 'hidden' && <p className="mt-1 rounded-lg bg-amber-50 p-2 text-sm text-amber-900">{t('reviews.hiddenNote')}</p>}
      <ul>
        <ReviewItem
          review={review}
          actions={
            <>
              {review.status !== 'hidden' && (
                <button type="button" className={linkBtn} onClick={() => setEditing(true)}>
                  <Pencil className="h-3.5 w-3.5" aria-hidden="true" /> {t('business.edit')}
                </button>
              )}
              <button type="button" className={`${linkBtn} text-red-700`} onClick={() => setConfirm(true)}>
                <Trash2 className="h-3.5 w-3.5" aria-hidden="true" /> {t('reviews.delete')}
              </button>
            </>
          }
        />
      </ul>
      <Modal
        open={confirm}
        onClose={() => setConfirm(false)}
        title={t('reviews.deleteTitle')}
        footer={
          <>
            <Button variant="secondary" onClick={() => setConfirm(false)}>
              {t('common.cancel')}
            </Button>
            <Button variant="danger" loading={remove.isPending} onClick={() => remove.mutate()}>
              {t('reviews.delete')}
            </Button>
          </>
        }
      >
        <p className="text-sm text-ink-muted">{t('reviews.deleteBody')}</p>
      </Modal>
    </div>
  );
}

/**
 * FR-REV-1 on the business page: average and count, my review (write, edit,
 * delete), everyone else's reviews newest first with Report, and Hide for admins.
 */
export function ReviewsSection({ business }) {
  const { t } = useTranslation();
  const toast = useToast();
  const location = useLocation();
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
  const ownsIt = Boolean(user && business.canManage && !isAdmin);
  const mine = useMyReviewFor(business.id);
  const list = useBusinessReviews(business.id);
  const hide = useReviewMutation((id) => reviewsApi.remove(id), {
    onSuccess: () => toast.success(t('reviews.hidden')),
    onError: (err) => toast.error(t(errorMessageKey(err))),
  });
  const others = (list.data?.pages.flatMap((p) => p.data) ?? []).filter((r) => r.id !== mine.data?.id);

  return (
    <Card className="flex flex-col gap-3" aria-labelledby="reviews-title">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 id="reviews-title" className="flex items-center gap-2 text-base font-bold">
          <MessageSquareText className="h-5 w-5 text-brand-700" aria-hidden="true" /> {t('reviews.title')}
        </h2>
        {business.ratingCount > 0 && (
          <span className="flex items-center gap-1.5 text-sm">
            <Stars value={business.ratingAvg} />
            <span className="font-semibold">{business.ratingAvg.toFixed(1)}</span>
            <span className="text-ink-muted">({t('business.ratings', { count: business.ratingCount })})</span>
          </span>
        )}
      </div>

      {!user ? (
        <Link to={`/login?next=${encodeURIComponent(location.pathname)}`} className="inline-flex min-h-tap items-center justify-center rounded-full bg-brand-100 px-4 text-sm font-semibold text-brand-800 hover:bg-brand-200">
          {t('reviews.loginToReview')}
        </Link>
      ) : ownsIt ? (
        <p className="text-sm text-ink-muted">{t('reviews.ownBusiness')}</p>
      ) : mine.isPending ? null : mine.data ? (
        <MyReview businessId={business.id} review={mine.data} />
      ) : (
        <ReviewForm businessId={business.id} />
      )}

      {list.isPending ? (
        <ListSkeleton rows={2} />
      ) : list.isError ? (
        <ErrorState error={list.error} onRetry={() => list.refetch()} />
      ) : others.length === 0 ? (
        !mine.data && <p className="text-sm text-ink-muted">{t('reviews.none')}</p>
      ) : (
        <ul className="divide-y divide-brand-100">
          {others.map((r) => (
            <ReviewItem
              key={r.id}
              review={r}
              actions={
                <>
                  <ReportButton targetType="review" targetId={r.id} title={r.author?.name ?? ''} compact />
                  {isAdmin && (
                    <button type="button" className={linkBtn} onClick={() => hide.mutate(r.id)} aria-label={`${t('reviews.hide')} - ${r.author?.name ?? ''}`}>
                      <EyeOff className="h-3.5 w-3.5" aria-hidden="true" /> {t('reviews.hide')}
                    </button>
                  )}
                </>
              }
            />
          ))}
        </ul>
      )}
      {list.hasNextPage && (
        <Button variant="secondary" onClick={() => list.fetchNextPage()} loading={list.isFetchingNextPage} fullWidth>
          {t('common.loadMore')}
        </Button>
      )}
    </Card>
  );
}
