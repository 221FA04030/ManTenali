import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Check, History, MessageSquareWarning, Pencil, X } from 'lucide-react';
import { PageHeader } from '../../../components/ui/Header.jsx';
import { Card } from '../../../components/ui/Card.jsx';
import { Button } from '../../../components/ui/Button.jsx';
import { Input } from '../../../components/ui/Input.jsx';
import { Modal } from '../../../components/ui/Modal.jsx';
import { ImageUpload } from '../../../components/ui/ImageUpload.jsx';
import { ListSkeleton } from '../../../components/ui/Skeleton.jsx';
import { ErrorState } from '../../../components/ui/ErrorState.jsx';
import { useToast } from '../../../components/ui/Toast.jsx';
import { errorMessageKey } from '../../../lib/apiClient.js';
import { formatDateTime } from '../../../lib/format.js';
import { categoryName } from '../../categories/api.js';
import { EvidencePanel } from '../../events/components/EvidencePanel.jsx';
import { EventStatusBadge, EventWhen } from '../../events/components/EventBits.jsx';
import { eventsApi, useEventMutation, useEventReview } from '../../events/api.js';

/** /admin/event-submissions/:id - review details and private evidence; approve, request changes or reject. */
export default function AdminEventReviewPage() {
  const { id } = useParams();
  const { t, i18n } = useTranslation();
  const lang = i18n.language;
  const toast = useToast();
  const navigate = useNavigate();
  const { data: e, isPending, isError, error, refetch } = useEventReview(id);
  const [dialog, setDialog] = useState(null); // 'reject' | 'changes'
  const [text, setText] = useState('');
  const [textError, setTextError] = useState(null);
  const [banner, setBanner] = useState(null);

  const done = (msgKey) => () => {
    setDialog(null);
    toast.success(t(msgKey));
    navigate('/admin/event-submissions');
  };
  const onError = (err) => toast.error(err.status === 409 ? err.message : t(errorMessageKey(err)));
  const approve = useEventMutation(() => eventsApi.approve(id, banner ? { bannerImage: banner } : {}), { onSuccess: done('eventReview.approved'), onError });
  const reject = useEventMutation(() => eventsApi.reject(id, text.trim()), { onSuccess: done('eventReview.rejected'), onError });
  const changes = useEventMutation(() => eventsApi.requestChanges(id, text.trim()), { onSuccess: done('eventReview.changesSent'), onError });

  const confirm = () => {
    if (text.trim().length < 5) {
      setTextError(t('eventReview.textRequired'));
      return;
    }
    setTextError(null);
    (dialog === 'reject' ? reject : changes).mutate();
  };

  if (isPending) return <ListSkeleton rows={3} />;
  if (isError) return <ErrorState error={error} onRetry={refetch} />;
  const pending = e.status === 'pending_review';

  return (
    <>
      <PageHeader
        title={t('eventReview.detailTitle')}
        actions={
          !['rejected', 'withdrawn', 'archived'].includes(e.status) && (
            <Link to={`/admin/events/${e.id}/edit`} aria-label={t('business.edit')} className="flex min-h-tap min-w-tap items-center justify-center rounded-full text-white hover:bg-white/15">
              <Pencil className="h-5 w-5" aria-hidden="true" />
            </Link>
          )
        }
      />
      <div className="flex flex-col gap-4 p-4">
        <Card className="flex flex-col gap-2">
          <div className="flex items-center justify-between gap-2">
            <EventStatusBadge status={e.status} />
            <span className="text-xs text-ink-soft">{t('events.revision', { n: e.revision })}</span>
          </div>
          <h2 className="text-xl font-bold leading-snug">{e.title}</h2>
          <p className="text-sm text-ink-muted">{categoryName(e.category, lang)}</p>
          <p className="text-[15px]">
            <EventWhen startLocal={e.startLocal} endLocal={e.endLocal} allDay={e.allDay} />
          </p>
          <p className="text-sm">{[e.venue.name, e.venue.address, e.venue.area].join(', ')}</p>
          <p className="text-sm text-ink-muted">{t('events.organizedBy', { name: e.organizerName })}</p>
          {e.priceInfo && <p className="text-sm">{e.priceInfo}</p>}
          {e.bookingUrl && (
            <a href={e.bookingUrl} target="_blank" rel="noopener noreferrer nofollow" className="break-all text-sm text-brand-700 underline">
              {e.bookingUrl}
            </a>
          )}
          {e.business && <p className="text-sm">{t('events.linkedBusiness')}: {e.business.name}</p>}
          {e.description && <p className="whitespace-pre-line text-sm text-ink-muted">{e.description}</p>}
          {e.submitter && (
            <p className="mt-1 rounded-xl bg-brand-50 p-2 text-sm">
              {t('review.submittedBy')}: <span className="font-semibold">{e.submitter.name}</span>
              {e.submitter.email && ` • ${e.submitter.email}`}
              {e.submittedAt && ` • ${formatDateTime(e.submittedAt, lang)}`}
            </p>
          )}
        </Card>

        <Card className="flex flex-col gap-3">
          <h3 className="font-bold">{t('evidence.title')}</h3>
          <p className="text-xs text-ink-soft">{t('evidence.adminNote')}</p>
          {e.evidence.length === 0 ? <p className="text-sm text-ink-muted">{t('evidence.none')}</p> : <EvidencePanel eventId={e.id} evidence={e.evidence} />}
        </Card>

        <Card>
          <h3 className="mb-2 flex items-center gap-2 font-bold">
            <History className="h-5 w-5 text-brand-700" aria-hidden="true" /> {t('eventReview.history')}
          </h3>
          <ol className="flex flex-col gap-2">
            {e.moderationLog.map((l, i) => (
              <li key={i} className="border-l-2 border-brand-200 pl-3 text-sm">
                <span className="font-semibold">{t(`eventReview.actions.${l.action}`, { defaultValue: l.action })}</span>
                <span className="text-ink-soft">
                  {' '}
                  • {formatDateTime(l.at, lang)}
                  {l.actor && ` • ${l.actor}`}
                </span>
                {l.note && <span className="block text-ink-muted">{l.note}</span>}
              </li>
            ))}
          </ol>
        </Card>

        {pending && (
          <Card className="flex flex-col gap-3">
            <ImageUpload purpose="event_banner" label={t('eventReview.bannerOptional')} value={banner} onChange={setBanner} />
            <Button loading={approve.isPending} onClick={() => approve.mutate()} fullWidth>
              <Check className="h-4 w-4" aria-hidden="true" /> {t('review.approve')}
            </Button>
            <div className="grid grid-cols-2 gap-2">
              <Button variant="secondary" onClick={() => { setText(''); setDialog('changes'); }}>
                <MessageSquareWarning className="h-4 w-4" aria-hidden="true" /> {t('eventReview.requestChanges')}
              </Button>
              <Button variant="danger" onClick={() => { setText(''); setDialog('reject'); }}>
                <X className="h-4 w-4" aria-hidden="true" /> {t('review.reject')}
              </Button>
            </div>
          </Card>
        )}
      </div>

      <Modal
        open={Boolean(dialog)}
        onClose={() => setDialog(null)}
        title={dialog === 'reject' ? t('eventReview.rejectTitle') : t('eventReview.changesTitle')}
        footer={
          <>
            <Button variant="secondary" onClick={() => setDialog(null)}>
              {t('common.cancel')}
            </Button>
            <Button variant={dialog === 'reject' ? 'danger' : 'primary'} loading={reject.isPending || changes.isPending} onClick={confirm}>
              {dialog === 'reject' ? t('review.reject') : t('eventReview.send')}
            </Button>
          </>
        }
      >
        <Input
          as="textarea"
          label={dialog === 'reject' ? t('eventReview.rejectLabel') : t('eventReview.changesLabel')}
          maxLength={1000}
          value={text}
          error={textError}
          onChange={(ev) => setText(ev.target.value)}
        />
      </Modal>
    </>
  );
}
