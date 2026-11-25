import { useId, useRef } from 'react';
import { FileText, Image as ImageIcon, LoaderCircle, Paperclip, RotateCw, Trash2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { uploadEvidence, checkEvidenceFile, EVIDENCE_TYPES } from '../../media/api.js';
import { errorMessageKey } from '../../../lib/apiClient.js';
import { EVIDENCE_KINDS } from '../api.js';

let counter = 0;
const sizeLabel = (bytes) => (bytes >= 1024 * 1024 ? `${(bytes / (1024 * 1024)).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`);

/**
 * Pick and upload PRIVATE evidence files, with per-file progress, kind and note.
 * `items` / `onChange` hold { key, name, size, type, kind, note, progress, status, error, publicId }.
 * `onUploaded(item)` (optional) is called when a file finishes uploading.
 */
export function EvidenceUploader({ items, onChange, max, onUploaded, disabled }) {
  const { t } = useTranslation();
  const inputId = useId();
  const inputRef = useRef(null);
  const filesRef = useRef(new Map()); // key -> File (for retries)
  const latest = useRef(items);
  latest.current = items;

  const patch = (key, p) => {
    latest.current = latest.current.map((i) => (i.key === key ? { ...i, ...p } : i));
    onChange(latest.current);
  };

  async function start(item) {
    const file = filesRef.current.get(item.key);
    try {
      const res = await uploadEvidence(file, { onProgress: (progress) => patch(item.key, { progress }) });
      const done = { ...item, ...res, status: 'done', progress: 100, error: null };
      patch(item.key, done);
      onUploaded?.(done);
    } catch (err) {
      const key = err?.message?.startsWith('evidence.') ? err.message : err?.code === 'SERVICE_UNAVAILABLE' ? 'evidence.v.notConfigured' : errorMessageKey(err);
      patch(item.key, { status: 'error', error: key });
    }
  }

  function pick(fileList) {
    const room = max - latest.current.length;
    const chosen = Array.from(fileList ?? []).slice(0, Math.max(0, room));
    const added = chosen.map((file) => {
      counter += 1;
      const key = `ev${counter}`;
      filesRef.current.set(key, file);
      const problem = checkEvidenceFile(file);
      return {
        key,
        name: file.name,
        size: file.size,
        type: file.type,
        kind: file.type === 'application/pdf' ? 'document' : 'poster',
        note: '',
        progress: 0,
        status: problem ? 'error' : 'uploading',
        error: problem,
      };
    });
    const next = [...latest.current, ...added];
    latest.current = next; // progress can arrive before the next render
    onChange(next);
    added.filter((a) => a.status === 'uploading').forEach(start);
    if (inputRef.current) inputRef.current.value = '';
  }

  const canAdd = !disabled && items.length < max;

  return (
    <div className="flex flex-col gap-3">
      <p className="text-xs text-ink-soft">{t('evidence.hint', { max })}</p>
      <p className="rounded-xl bg-amber-50 px-3 py-2 text-xs text-amber-900">{t('evidence.privacyNote')}</p>
      <ul className="flex flex-col gap-2">
        {items.map((it) => (
          <li key={it.key} className="rounded-2xl bg-brand-50 p-3">
            <div className="flex items-center gap-2">
              {it.type === 'application/pdf' ? (
                <FileText className="h-5 w-5 shrink-0 text-brand-700" aria-hidden="true" />
              ) : (
                <ImageIcon className="h-5 w-5 shrink-0 text-brand-700" aria-hidden="true" />
              )}
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-semibold">{it.name}</span>
                <span className="block text-xs text-ink-soft">{sizeLabel(it.size)}</span>
              </span>
              {it.status === 'uploading' && <LoaderCircle className="h-4 w-4 animate-spin text-brand-700" aria-hidden="true" />}
              {it.status === 'error' && filesRef.current.get(it.key) && !checkEvidenceFile(filesRef.current.get(it.key)) && (
                <button
                  type="button"
                  onClick={() => {
                    patch(it.key, { status: 'uploading', error: null, progress: 0 });
                    start(it);
                  }}
                  aria-label={`${t('evidence.retry')} ${it.name}`}
                  className="flex min-h-tap min-w-tap items-center justify-center rounded-full text-brand-700 hover:bg-white"
                >
                  <RotateCw className="h-4 w-4" aria-hidden="true" />
                </button>
              )}
              {!onUploaded && (
                <button
                  type="button"
                  onClick={() => onChange(latest.current.filter((i) => i.key !== it.key))}
                  aria-label={`${t('evidence.remove')} ${it.name}`}
                  className="flex min-h-tap min-w-tap items-center justify-center rounded-full text-red-700 hover:bg-white"
                >
                  <Trash2 className="h-4 w-4" aria-hidden="true" />
                </button>
              )}
            </div>
            {it.status === 'uploading' && (
              <div className="mt-2 h-2 overflow-hidden rounded-full bg-white" role="progressbar" aria-label={it.name} aria-valuenow={it.progress} aria-valuemin={0} aria-valuemax={100}>
                <div className="h-full bg-brand-700 transition-all" style={{ width: `${it.progress}%` }} />
              </div>
            )}
            {it.status === 'error' && (
              <p role="alert" className="mt-1 text-sm text-red-700">
                {t(it.error)}
              </p>
            )}
            {!onUploaded && it.status !== 'error' && (
              <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
                <select
                  aria-label={`${t('evidence.kind')} - ${it.name}`}
                  value={it.kind}
                  onChange={(e) => patch(it.key, { kind: e.target.value })}
                  className="min-h-tap rounded-xl border border-brand-200 bg-white px-2 text-sm"
                >
                  {EVIDENCE_KINDS.map((k) => (
                    <option key={k} value={k}>
                      {t(`evidence.kinds.${k}`)}
                    </option>
                  ))}
                </select>
                <input
                  aria-label={`${t('evidence.note')} - ${it.name}`}
                  placeholder={t('evidence.notePlaceholder')}
                  maxLength={200}
                  value={it.note}
                  onChange={(e) => patch(it.key, { note: e.target.value })}
                  className="min-h-tap rounded-xl border border-brand-200 bg-white px-3 text-sm"
                />
              </div>
            )}
          </li>
        ))}
      </ul>
      {canAdd && (
        <label
          htmlFor={inputId}
          className="inline-flex min-h-tap cursor-pointer items-center gap-2 self-start rounded-full bg-brand-100 px-4 text-sm font-semibold text-brand-800 hover:bg-brand-200"
        >
          <Paperclip className="h-4 w-4" aria-hidden="true" />
          {t('evidence.add')}
        </label>
      )}
      <input
        ref={inputRef}
        id={inputId}
        type="file"
        multiple
        accept={EVIDENCE_TYPES.join(',')}
        className="sr-only"
        aria-label={t('evidence.add')}
        disabled={!canAdd}
        onChange={(e) => pick(e.target.files)}
      />
    </div>
  );
}
