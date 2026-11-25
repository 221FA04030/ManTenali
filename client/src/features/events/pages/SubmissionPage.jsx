import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ExternalLink, Send, Undo2 } from 'lucide-react';
import { PageHeader } from '../../../components/ui/Header.jsx';
import { Card } from '../../../components/ui/Card.jsx';
import { Button } from '../../../components/ui/Button.jsx';
import { Modal } from '../../../components/ui/Modal.jsx';
import { ListSkeleton } from '../../../components/ui/Skeleton.jsx';
import { ErrorState } from '../../../components/ui/ErrorState.jsx';
import { EmptyState } from '../../../components/ui/EmptyState.jsx';
import { useToast } from '../../../components/ui/Toast.jsx';
import { errorMessageKey } from '../../../lib/apiClient.js';
import { EventForm, eventPayload } from '../components/EventForm.jsx';
import { EvidencePanel } from '../components/EvidencePanel.jsx';
import { EvidenceUploader } from '../components/EvidenceUploader.jsx';
import { EventStatusBadge, EventWhen } from '../components/EventBits.jsx';
import { eventsApi, useEventMutation, useSubmission, MAX_EVIDENCE, EVIDENCE_KINDS } from '../api.js';

/**
 * /events/submissions/:id - the submitter's own submission: status and the
 * reviewer's note; while pending or changes are requested: edit, manage
 * evidence, resubmit or withdraw.
 */
export default function SubmissionPage() {
  const { id } = useParams();
  const { t } = useTranslation();
  const toast = useToast();
  const { data: e, isPending, isError, error, refetch } = useSubmission(id);
  const [uploads, setUploads] = useState([]);
  const [newKind, setNewKind] = useState('document');
  const [confirmWithdraw, setConfirmWithdraw] = useState(false);
  const [serverErrors, setServerErrors] = useState({});

  const onError = (err) => toast.error(err.status === 409 ? err.message : t(errorMessageKey(err)));
  const save = useEventMutation((state) => eventsApi.updateSubmission(id, eventPayload(state, { editing: true })), {
    onSuccess: () => {
      setServerErrors({});
      toast.success(t('form.saved'));
    },
    onError: (err) => {
      setServerErrors(err.fieldErrors ?? {});
      onError(err);
    },
  });
  const addEvidence = useEventMutation((item) => eventsApi.addEvidence(id, item), {
    onSuccess: (_, item) => setUploads((u) => u.filter((x) => x.publicId !== item.publicId)),
    onError,
  });
  const removeEvidence = useEventMutation((ev) => eventsApi.removeEvidence(id, ev.id), { onError });
  const resubmit = useEventMutation(() => eventsApi.resubmit(id), { onSuccess: () => toast.success(t('events.resubmitted')), onError });
  const withdraw = useEventMutation(() => eventsApi.withdraw(id), {
    onSuccess: () => {
      setConfirmWithdraw(false);
      toast.success(t('events.withdrawn'));
    },
    onError,
  });

  if (isPending) return <ListSkeleton rows={3} />;
  if (isError) {
    return (
      <>
        <PageHeader title={t('events.mySubmissions')} />
        <div className="p-4">
          {error?.status === 404 ? <EmptyState title={t('events.notFound')} body={t('states.notFoundBody')} /> : <ErrorState error={error} onRetry={refetch} />}
        </div>
      </>
    );
  }

  const activeEvidence = e.evidence.filter((x) => x.status === 'active');

  return (
    <>
      <PageHeader title={e.title} />
      <div className="flex flex-col gap-4 p-4">
        <Card className="flex flex-col gap-2">
          <div className="flex items-center justify-between gap-2">
            <EventStatusBadge status={e.status} />
            <span className="text-xs text-ink-soft">{t('events.revision', { n: e.revision })}</span>
          </div>
          <p className="text-sm text-ink-muted">
            <EventWhen startLocal={e.startLocal} endLocal={e.endLocal} allDay={e.allDay} />
          </p>
          <p className="text-sm text-ink-muted">{t(`events.statusHelp.${e.status}`)}</p>
          {e.review?.note && ['changes_requested', 'rejected'].includes(e.status) && (
            <div className={`rounded-xl p-3 text-sm ${e.status === 'rejected' ? 'bg-red-50 text-red-900' : 'bg-blue-50 text-blue-900'}`}>
              <p className="font-semibold">{e.status === 'rejected' ? t('events.rejectedBecause') : t('events.changesRequested')}</p>
              <p className="mt-1 whitespace-pre-line">{e.review.note}</p>
            </div>
          )}
          {e.status === 'published' && (
            <Link to={`/events/${e.slug}`} className="inline-flex min-h-tap items-center gap-2 text-sm font-semibold text-brand-700">
              <ExternalLink className="h-4 w-4" aria-hidden="true" /> {t('events.viewPublic')}
            </Link>
          )}
          {e.canEdit && (
            <div className="mt-2 flex flex-wrap gap-2">
              {e.status === 'changes_requested' && (
                <Button onClick={() => resubmit.mutate()} loading={resubmit.isPending}>
                  <Send className="h-4 w-4" aria-hidden="true" /> {t('events.resubmit')}
                </Button>
              )}
              <Button variant="secondary" className="text-red-700" onClick={() => setConfirmWithdraw(true)}>
                <Undo2 className="h-4 w-4" aria-hidden="true" /> {t('events.withdraw')}
              </Button>
            </div>
          )}
        </Card>

        <Card className="flex flex-col gap-3">
          <h2 className="text-base font-bold">{t('evidence.title')}</h2>
          <EvidencePanel eventId={id} evidence={activeEvidence} canRemove={e.canEdit && activeEvidence.length > 1} onRemove={(ev) => removeEvidence.mutate(ev)} removing={removeEvidence.isPending} />
          {e.canEdit && activeEvidence.length < MAX_EVIDENCE && (
            <label className="flex flex-col gap-1 text-sm font-semibold">
              {t('evidence.kindForNew')}
              <select value={newKind} onChange={(ev) => setNewKind(ev.target.value)} className="min-h-tap rounded-xl border border-brand-200 bg-white px-2 text-sm font-normal">
                {EVIDENCE_KINDS.map((k) => (
                  <option key={k} value={k}>
                    {t(`evidence.kinds.${k}`)}
                  </option>
                ))}
              </select>
            </label>
          )}
          {e.canEdit && activeEvidence.length < MAX_EVIDENCE && (
            <EvidenceUploader
              items={uploads}
              onChange={setUploads}
              max={MAX_EVIDENCE - activeEvidence.length}
              onUploaded={(item) => addEvidence.mutate({ publicId: item.publicId, kind: newKind, filename: item.name })}
            />
          )}
          {e.canEdit && activeEvidence.length <= 1 && <p className="text-xs text-ink-soft">{t('evidence.keepOne')}</p>}
        </Card>

        {e.canEdit && (
          <EventForm
            key={`${e.id}-${e.revision}-${e.status}`}
            event={e}
            mode="submission"
            onSubmit={(state) => save.mutate(state)}
            submitting={save.isPending}
            submitLabel={t('common.save')}
            serverErrors={serverErrors}
          />
        )}
      </div>

      <Modal
        open={confirmWithdraw}
        onClose={() => setConfirmWithdraw(false)}
        title={t('events.withdrawTitle')}
        footer={
          <>
            <Button variant="secondary" onClick={() => setConfirmWithdraw(false)}>
              {t('common.cancel')}
            </Button>
            <Button variant="danger" loading={withdraw.isPending} onClick={() => withdraw.mutate()}>
              {t('events.withdraw')}
            </Button>
          </>
        }
      >
        <p className="text-sm text-ink-muted">{t('events.withdrawBody')}</p>
      </Modal>
    </>
  );
}
