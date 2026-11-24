import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Check, Clock, MapPin, Phone, X } from 'lucide-react';
import { PageHeader } from '../../../components/ui/Header.jsx';
import { Card } from '../../../components/ui/Card.jsx';
import { Badge } from '../../../components/ui/Badge.jsx';
import { Button } from '../../../components/ui/Button.jsx';
import { Input } from '../../../components/ui/Input.jsx';
import { Modal } from '../../../components/ui/Modal.jsx';
import { ListSkeleton } from '../../../components/ui/Skeleton.jsx';
import { ErrorState } from '../../../components/ui/ErrorState.jsx';
import { useToast } from '../../../components/ui/Toast.jsx';
import { errorMessageKey } from '../../../lib/apiClient.js';
import { cldUrl } from '../../../lib/cloudinary.js';
import { formatDateTime } from '../../../lib/format.js';
import { directionsUrl } from '../../../lib/geo.js';
import { categoryName } from '../../categories/api.js';
import { HoursTable } from '../../businesses/components/HoursTable.jsx';
import { businessesApi, useBusinessMutation, useSubmission, OWNER_STATUS_KEY, STATUS_TONE } from '../../businesses/api.js';

/** /admin/submissions/:id - review one submission: details, photos, approve / reject with reason. */
export default function AdminSubmissionDetailPage() {
  const { id } = useParams();
  const { t, i18n } = useTranslation();
  const lang = i18n.language;
  const toast = useToast();
  const navigate = useNavigate();
  const [rejectOpen, setRejectOpen] = useState(false);
  const [reason, setReason] = useState('');
  const [reasonError, setReasonError] = useState(null);
  const { data: b, isPending, isError, error, refetch } = useSubmission(id);

  const onError = (err) => toast.error(err.status === 409 ? err.message : t(errorMessageKey(err)));
  const approve = useBusinessMutation(() => businessesApi.approve(id), {
    onSuccess: () => {
      toast.success(t('review.approved'));
      navigate('/admin/submissions');
    },
    onError,
  });
  const reject = useBusinessMutation(() => businessesApi.reject(id, reason.trim()), {
    onSuccess: () => {
      setRejectOpen(false);
      toast.success(t('review.rejected'));
      navigate('/admin/submissions');
    },
    onError: (err) => {
      if (err.fieldErrors?.reason) setReasonError(err.fieldErrors.reason);
      onError(err);
    },
  });

  const confirmReject = () => {
    if (reason.trim().length < 5) {
      setReasonError(t('review.reasonRequired'));
      return;
    }
    setReasonError(null);
    reject.mutate();
  };

  return (
    <>
      <PageHeader title={t('review.detailTitle')} />
      <div className="flex flex-col gap-4 p-4">
        {isPending ? (
          <ListSkeleton rows={3} />
        ) : isError ? (
          <ErrorState error={error} onRetry={refetch} />
        ) : (
          <>
            <Card className="flex flex-col gap-2">
              <div className="flex flex-wrap gap-1.5">
                <Badge tone={STATUS_TONE[b.status]}>{t(OWNER_STATUS_KEY[b.status])}</Badge>
              </div>
              <h2 className="text-xl font-bold leading-snug">{b.name}</h2>
              <p className="text-sm text-ink-muted">
                {[categoryName(b.category, lang), categoryName(b.subcategory, lang)].filter(Boolean).join(' › ')}
              </p>
              <dl className="mt-1 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-sm">
                <dt className="text-ink-soft">{t('review.submittedBy')}</dt>
                <dd>{b.owner?.name ?? '—'}</dd>
                <dt className="text-ink-soft">{t('review.submittedAt')}</dt>
                <dd>{b.submittedAt ? formatDateTime(b.submittedAt, lang) : '—'}</dd>
                {b.reviewedAt && (
                  <>
                    <dt className="text-ink-soft">{t('review.reviewedAt')}</dt>
                    <dd>
                      {formatDateTime(b.reviewedAt, lang)}
                      {b.reviewedBy?.name && ` • ${b.reviewedBy.name}`}
                    </dd>
                  </>
                )}
              </dl>
              {b.status === 'rejected' && b.rejectionReason && (
                <p className="mt-2 rounded-xl bg-red-50 p-3 text-sm text-red-900">
                  <span className="font-semibold">{t('submit.rejectedBecause')} </span>
                  {b.rejectionReason}
                </p>
              )}
            </Card>

            {b.photos.length > 0 ? (
              <div className="no-scrollbar -mx-4 flex snap-x gap-2 overflow-x-auto px-4">
                {b.photos.map((p, i) => (
                  <a key={p.publicId} href={p.url} target="_blank" rel="noopener noreferrer" className="shrink-0 snap-center">
                    <img src={cldUrl(p.url, { w: 480, h: 320 })} alt={`${b.name} ${i + 1}`} className="h-40 w-60 rounded-card object-cover" />
                  </a>
                ))}
              </div>
            ) : (
              <p className="text-sm text-ink-soft">{t('review.noPhotos')}</p>
            )}

            <Card className="flex flex-col gap-2 text-[15px]">
              {b.description && <p className="whitespace-pre-line text-ink-muted">{b.description}</p>}
              <p className="flex items-start gap-2">
                <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-brand-700" aria-hidden="true" />
                <span>
                  {b.address.line}, {b.address.area}
                  {b.address.pincode && `, ${b.address.pincode}`}
                  {b.location && (
                    <a href={directionsUrl(b.location)} target="_blank" rel="noopener noreferrer" className="ml-2 text-sm font-semibold text-brand-700">
                      {t('business.openInMaps')}
                    </a>
                  )}
                </span>
              </p>
              {b.contact.phone && (
                <p className="flex items-center gap-2">
                  <Phone className="h-4 w-4 text-brand-700" aria-hidden="true" /> {b.contact.phone}
                </p>
              )}
            </Card>

            <Card>
              <h3 className="mb-2 flex items-center gap-2 font-bold">
                <Clock className="h-5 w-5 text-brand-700" aria-hidden="true" /> {t('business.hours')}
              </h3>
              <HoursTable hours={b.openingHours} />
            </Card>

            {b.status === 'pending' && (
              <div className="sticky bottom-24 flex gap-2 rounded-card bg-white/95 p-3 shadow-lift ring-1 ring-brand-100">
                <Button variant="danger" fullWidth onClick={() => setRejectOpen(true)} disabled={approve.isPending}>
                  <X className="h-4 w-4" aria-hidden="true" /> {t('review.reject')}
                </Button>
                <Button fullWidth loading={approve.isPending} onClick={() => approve.mutate()}>
                  <Check className="h-4 w-4" aria-hidden="true" /> {t('review.approve')}
                </Button>
              </div>
            )}
          </>
        )}
      </div>

      <Modal
        open={rejectOpen}
        onClose={() => setRejectOpen(false)}
        title={t('review.rejectTitle')}
        footer={
          <>
            <Button variant="secondary" onClick={() => setRejectOpen(false)}>
              {t('common.cancel')}
            </Button>
            <Button variant="danger" loading={reject.isPending} onClick={confirmReject}>
              {t('review.reject')}
            </Button>
          </>
        }
      >
        <Input
          as="textarea"
          label={t('review.reason')}
          hint={t('review.reasonHint')}
          maxLength={500}
          value={reason}
          error={reasonError}
          onChange={(e) => setReason(e.target.value)}
        />
      </Modal>
    </>
  );
}
