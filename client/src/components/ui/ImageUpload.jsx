import { useId, useRef, useState } from 'react';
import { ImagePlus, LoaderCircle, Trash2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { uploadImage, checkFile, ALLOWED_TYPES, UPLOAD_LIMITS } from '../../features/media/api.js';
import { errorMessageKey } from '../../lib/apiClient.js';
import { cldUrl } from '../../lib/cloudinary.js';
import { cn } from '../../lib/cn.js';

/**
 * Image picker that uploads directly to Cloudinary with a server signature.
 * `value` is { url, publicId } (or a URL string); `onChange` receives the new
 * image or null when removed.
 */
export function ImageUpload({ purpose, value, onChange, label, shape = 'wide', disabled, alt = '' }) {
  const { t } = useTranslation();
  const inputId = useId();
  const inputRef = useRef(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const url = typeof value === 'string' ? value : value?.url;
  const round = shape === 'round';
  const maxMb = Math.round(UPLOAD_LIMITS[purpose] / (1024 * 1024));

  async function handleFile(file) {
    setError(null);
    const problem = checkFile(file, purpose);
    if (problem) {
      setError(t(problem, { mb: maxMb }));
      return;
    }
    setBusy(true);
    try {
      const image = await uploadImage(file, purpose);
      onChange?.(image);
    } catch (err) {
      if (err?.code === 'SERVICE_UNAVAILABLE') setError(t('upload.notConfigured'));
      else if (err?.code === 'UPLOAD_FAILED') setError(t('upload.failed'));
      else if (err?.message?.startsWith('upload.')) setError(t(err.message, { mb: maxMb }));
      else setError(t(errorMessageKey(err)));
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  }

  return (
    <div className="flex flex-col gap-2">
      {label && (
        <label htmlFor={inputId} className="text-sm font-semibold text-ink">
          {label}
        </label>
      )}
      <div className={cn('flex items-center gap-3', !round && 'flex-col items-stretch')}>
        <div
          className={cn(
            'relative flex shrink-0 items-center justify-center overflow-hidden bg-brand-50 ring-1 ring-brand-200',
            round ? 'h-20 w-20 rounded-full' : 'aspect-[16/9] w-full rounded-2xl',
          )}
        >
          {url ? (
            <img src={cldUrl(url, round ? { w: 160, h: 160 } : { w: 800 })} alt={alt} className="h-full w-full object-cover" />
          ) : (
            <ImagePlus className="h-8 w-8 text-brand-400" aria-hidden="true" />
          )}
          {busy && (
            <span className="absolute inset-0 flex items-center justify-center bg-white/70" role="status" aria-label={t('upload.uploading')}>
              <LoaderCircle className="h-7 w-7 animate-spin text-brand-700" aria-hidden="true" />
            </span>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <label
            htmlFor={inputId}
            className={cn(
              'inline-flex min-h-tap cursor-pointer items-center gap-2 rounded-full bg-brand-100 px-4 text-sm font-semibold text-brand-800 hover:bg-brand-200',
              (busy || disabled) && 'pointer-events-none opacity-60',
            )}
          >
            <ImagePlus className="h-4 w-4" aria-hidden="true" />
            {url ? t('upload.change') : t('upload.choose')}
          </label>
          <input
            ref={inputRef}
            id={inputId}
            type="file"
            accept={ALLOWED_TYPES.join(',')}
            className="sr-only"
            disabled={busy || disabled}
            onChange={(e) => handleFile(e.target.files?.[0])}
          />
          {url && !busy && (
            <button
              type="button"
              onClick={() => onChange?.(null)}
              disabled={disabled}
              className="inline-flex min-h-tap items-center gap-2 rounded-full px-3 text-sm font-semibold text-red-700 hover:bg-red-50"
            >
              <Trash2 className="h-4 w-4" aria-hidden="true" />
              {t('upload.remove')}
            </button>
          )}
        </div>
      </div>
      <p className="text-xs text-ink-soft">{t('upload.hint', { mb: maxMb })}</p>
      {error && (
        <p role="alert" className="text-sm text-red-700">
          {error}
        </p>
      )}
    </div>
  );
}
