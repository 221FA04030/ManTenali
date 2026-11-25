import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Modal } from '../../../components/ui/Modal.jsx';
import { Button } from '../../../components/ui/Button.jsx';
import { Input } from '../../../components/ui/Input.jsx';
import { useToast } from '../../../components/ui/Toast.jsx';
import { errorMessageKey } from '../../../lib/apiClient.js';
import { MIN_DETAILS, reasonsFor, useCreateReport } from '../api.js';

/** FR-REP-1: report a business, review, offer, event or news item with a reason. */
export function ReportDialog({ open, onClose, targetType, targetId }) {
  const { t } = useTranslation();
  const toast = useToast();
  const [reason, setReason] = useState('');
  const [details, setDetails] = useState('');
  const [error, setError] = useState(null);
  const close = () => {
    setReason('');
    setDetails('');
    setError(null);
    onClose();
  };
  const mutation = useCreateReport({
    onSuccess: () => {
      toast.success(t('report.sent'));
      close();
    },
    onError: (err) => toast.error(err.status === 409 ? t('report.duplicate') : t(errorMessageKey(err))),
  });
  const submit = () => {
    if (!reason) return setError('reason');
    if (reason === 'other' && details.trim().length < MIN_DETAILS) return setError('details');
    setError(null);
    mutation.mutate({ targetType, targetId, reason, ...(details.trim() ? { details: details.trim() } : {}) });
    return undefined;
  };
  return (
    <Modal
      open={open}
      onClose={close}
      title={t(`report.title.${targetType}`)}
      footer={
        <>
          <Button variant="secondary" onClick={close}>
            {t('common.cancel')}
          </Button>
          <Button variant="danger" loading={mutation.isPending} onClick={submit}>
            {t('report.send')}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <fieldset className="flex flex-col gap-1.5">
          <legend className="mb-1 text-sm font-semibold text-ink">{t('report.reasonLabel')}</legend>
          {reasonsFor(targetType).map((r) => (
            <label key={r} className="flex min-h-tap items-center gap-3 rounded-xl px-2 text-[15px] hover:bg-brand-50">
              <input type="radio" name="report-reason" value={r} checked={reason === r} onChange={() => setReason(r)} className="h-5 w-5 accent-brand-700" />
              {t(`report.reasons.${r}`)}
            </label>
          ))}
          {error === 'reason' && <p className="text-sm text-red-700">{t('report.chooseReason')}</p>}
        </fieldset>
        <Input
          as="textarea"
          label={reason === 'other' ? `${t('report.details')} *` : t('report.details')}
          maxLength={1000}
          value={details}
          onChange={(e) => setDetails(e.target.value)}
          hint={t('report.detailsHint')}
          error={error === 'details' ? t('report.detailsRequired', { min: MIN_DETAILS }) : undefined}
        />
        <p className="text-xs text-ink-soft">{t('report.privacy')}</p>
      </div>
    </Modal>
  );
}
