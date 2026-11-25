import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Info } from 'lucide-react';
import { PageHeader } from '../../../components/ui/Header.jsx';
import { Card } from '../../../components/ui/Card.jsx';
import { useToast } from '../../../components/ui/Toast.jsx';
import { errorMessageKey } from '../../../lib/apiClient.js';
import { EventForm, eventPayload } from '../components/EventForm.jsx';
import { EvidenceUploader } from '../components/EvidenceUploader.jsx';
import { eventsApi, useEventMutation, MAX_EVIDENCE } from '../api.js';

/** Evidence must be uploaded (at least one) before submitting. */
export function evidenceErrors(items) {
  if (items.some((i) => i.status === 'uploading')) return { evidence: 'evidence.v.wait' };
  if (!items.some((i) => i.status === 'done')) return { evidence: 'evidence.v.required' };
  return {};
}

/** /events/submit - anyone signed in submits an event with private evidence for review. */
export default function SubmitEventPage() {
  const { t } = useTranslation();
  const toast = useToast();
  const navigate = useNavigate();
  const [evidence, setEvidence] = useState([]);
  const [serverErrors, setServerErrors] = useState({});
  const extra = evidenceErrors(evidence);

  const mutation = useEventMutation(
    (state) =>
      eventsApi.submit({
        ...eventPayload(state),
        evidence: evidence
          .filter((i) => i.status === 'done')
          .map((i) => ({ publicId: i.publicId, kind: i.kind, note: i.note.trim() || undefined, filename: i.name })),
      }),
    {
      onSuccess: (e) => {
        toast.success(t('events.submitted'));
        navigate(`/events/submissions/${e.id}`, { replace: true });
      },
      onError: (err) => {
        setServerErrors(err.fieldErrors ?? {});
        toast.error([409, 429].includes(err.status) ? err.message : t(errorMessageKey(err)));
      },
    },
  );

  return (
    <>
      <PageHeader title={t('events.submitTitle')} />
      <div className="flex flex-col gap-4 p-4">
        <div className="flex gap-3 rounded-card bg-brand-50 p-4 text-sm text-ink-muted ring-1 ring-brand-100">
          <Info className="h-5 w-5 shrink-0 text-brand-700" aria-hidden="true" />
          <p>{t('events.submitIntro')}</p>
        </div>
        <EventForm
          mode="submission"
          onSubmit={(state) => mutation.mutate(state)}
          submitting={mutation.isPending}
          submitLabel={t('events.submitForReview')}
          serverErrors={serverErrors}
          extraErrors={extra}
        >
          <Card className="flex flex-col gap-3">
            <h2 className="text-base font-bold">{t('evidence.title')} *</h2>
            <EvidenceUploader items={evidence} onChange={setEvidence} max={MAX_EVIDENCE} />
            {extra.evidence && <p className="text-sm text-ink-muted">{t(extra.evidence)}</p>}
            {serverErrors['evidence'] && <p className="text-sm text-red-700">{serverErrors['evidence']}</p>}
          </Card>
        </EventForm>
      </div>
    </>
  );
}
