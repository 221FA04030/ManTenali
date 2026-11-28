import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Archive, RotateCcw, Trash2, TriangleAlert } from 'lucide-react';
import { Modal } from '../../../components/ui/Modal.jsx';
import { Button } from '../../../components/ui/Button.jsx';
import { Input } from '../../../components/ui/Input.jsx';

const REASON_MAX = 500;
const ICONS = { archive: Archive, restore: RotateCcw, delete: Trash2 };

/**
 * Confirmation for one moderation action. Archive takes an optional reason;
 * delete says it can't be undone and needs an explicit tick before the button
 * works (the server also requires `confirm: true`).
 */
export function ModerationConfirmationDialog({ open, action, title, onClose, onConfirm, loading }) {
  const { t } = useTranslation();
  const [reason, setReason] = useState('');
  const [understood, setUnderstood] = useState(false);
  useEffect(() => {
    if (open) {
      setReason('');
      setUnderstood(false);
    }
  }, [open, action]);
  if (!action) return null;
  const Icon = ICONS[action];
  const needsTick = action === 'delete';
  return (
    <Modal
      open={open}
      onClose={loading ? () => {} : onClose}
      title={t(`moderation.confirm.${action}.title`)}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={loading}>
            {t('common.cancel')}
          </Button>
          <Button
            variant={action === 'delete' ? 'danger' : 'primary'}
            loading={loading}
            disabled={needsTick && !understood}
            onClick={() => onConfirm(reason.trim() || undefined)}
          >
            <Icon className="h-4 w-4" aria-hidden="true" />
            {t(`moderation.confirm.${action}.button`)}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-3">
        {title && <p className="line-clamp-3 break-words font-bold text-ink">{title}</p>}
        {action === 'delete' ? (
          <p role="alert" className="flex gap-2 rounded-xl bg-red-50 p-3 text-[14px] text-red-900 ring-1 ring-red-200">
            <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
            <span>{t('moderation.confirm.delete.body')}</span>
          </p>
        ) : (
          <p className="text-[15px] text-ink-muted">{t(`moderation.confirm.${action}.body`)}</p>
        )}
        {action !== 'restore' && (
          <Input
            as="textarea"
            label={t('moderation.reasonLabel')}
            hint={t('moderation.reasonHint')}
            value={reason}
            maxLength={REASON_MAX}
            onChange={(e) => setReason(e.target.value)}
          />
        )}
        {needsTick && (
          <label className="flex min-h-tap cursor-pointer items-start gap-3 text-[15px] text-ink">
            <input
              type="checkbox"
              checked={understood}
              onChange={(e) => setUnderstood(e.target.checked)}
              className="mt-1 h-5 w-5 shrink-0 accent-red-600"
            />
            <span>{t('moderation.confirm.delete.tick')}</span>
          </label>
        )}
      </div>
    </Modal>
  );
}
