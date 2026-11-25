import { useState } from 'react';
import { Download, Eye, FileText, Image as ImageIcon, Trash2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Badge } from '../../../components/ui/Badge.jsx';
import { Modal } from '../../../components/ui/Modal.jsx';
import { useToast } from '../../../components/ui/Toast.jsx';
import { errorMessageKey } from '../../../lib/apiClient.js';
import { eventsApi } from '../api.js';

const sizeLabel = (bytes) => (bytes >= 1024 * 1024 ? `${(bytes / (1024 * 1024)).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`);

/**
 * Private evidence list for the submitter (own submission) or an admin.
 * Links are requested on demand (5-minute, signed) and never stored.
 * Images preview only as <img>; PDFs are download-only (never shown inline).
 */
export function EvidencePanel({ eventId, evidence, canRemove, onRemove, removing }) {
  const { t } = useTranslation();
  const toast = useToast();
  const [preview, setPreview] = useState(null);
  const [busy, setBusy] = useState(null);

  async function open(ev, mode) {
    setBusy(`${ev.id}-${mode}`);
    try {
      const links = await eventsApi.evidenceAccess(eventId, ev.id);
      if (mode === 'preview' && links.previewUrl) setPreview({ url: links.previewUrl, name: ev.filename ?? t(`evidence.kinds.${ev.kind}`) });
      else window.open(links.downloadUrl, '_blank', 'noopener,noreferrer');
    } catch (err) {
      toast.error(t(err?.code === 'SERVICE_UNAVAILABLE' ? 'evidence.v.notConfigured' : errorMessageKey(err)));
    } finally {
      setBusy(null);
    }
  }

  const btn = 'inline-flex min-h-[40px] items-center gap-1.5 rounded-full px-3 text-[13px] font-semibold ring-1 ring-brand-200 hover:bg-brand-50 disabled:opacity-50';

  return (
    <>
      <ul className="flex flex-col gap-2">
        {evidence.map((ev) => (
          <li key={ev.id} className={`rounded-2xl bg-brand-50 p-3 ${ev.status === 'removed' ? 'opacity-60' : ''}`}>
            <div className="flex items-start gap-2">
              {ev.isImage ? (
                <ImageIcon className="mt-0.5 h-5 w-5 shrink-0 text-brand-700" aria-hidden="true" />
              ) : (
                <FileText className="mt-0.5 h-5 w-5 shrink-0 text-brand-700" aria-hidden="true" />
              )}
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-semibold">{t(`evidence.kinds.${ev.kind}`)}</span>
                <span className="block truncate text-xs text-ink-soft">
                  {[ev.filename, ev.format.toUpperCase(), sizeLabel(ev.bytes), ev.pages ? t('evidence.pages', { count: ev.pages }) : null]
                    .filter(Boolean)
                    .join(' • ')}
                </span>
                {ev.note && <span className="mt-1 block text-sm text-ink-muted">{ev.note}</span>}
              </span>
              {ev.status === 'removed' && <Badge tone="gray">{t('evidence.removed')}</Badge>}
            </div>
            {ev.status !== 'removed' && (
              <div className="mt-2 flex flex-wrap gap-2">
                {ev.isImage && (
                  <button type="button" className={btn} disabled={busy !== null} onClick={() => open(ev, 'preview')} aria-label={`${t('evidence.preview')} ${t(`evidence.kinds.${ev.kind}`)}`}>
                    <Eye className="h-4 w-4" aria-hidden="true" /> {t('evidence.preview')}
                  </button>
                )}
                <button type="button" className={btn} disabled={busy !== null} onClick={() => open(ev, 'download')} aria-label={`${t('evidence.download')} ${t(`evidence.kinds.${ev.kind}`)}`}>
                  <Download className="h-4 w-4" aria-hidden="true" /> {t('evidence.download')}
                </button>
                {canRemove && (
                  <button
                    type="button"
                    className={`${btn} text-red-700`}
                    disabled={removing}
                    onClick={() => onRemove(ev)}
                    aria-label={`${t('evidence.remove')} ${t(`evidence.kinds.${ev.kind}`)}`}
                  >
                    <Trash2 className="h-4 w-4" aria-hidden="true" /> {t('evidence.remove')}
                  </button>
                )}
              </div>
            )}
          </li>
        ))}
      </ul>
      <Modal open={Boolean(preview)} onClose={() => setPreview(null)} title={preview?.name ?? ''}>
        {preview && <img src={preview.url} alt={preview.name} referrerPolicy="no-referrer" className="max-h-[70vh] w-full rounded-xl object-contain" />}
      </Modal>
    </>
  );
}
