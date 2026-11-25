import { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Bookmark, Flag, Share2 } from 'lucide-react';
import { useAuth } from '../auth/AuthContext.jsx';
import { useToast } from '../../components/ui/Toast.jsx';
import { errorMessageKey } from '../../lib/apiClient.js';
import { track } from '../../lib/analytics.js';
import { cn } from '../../lib/cn.js';
import { useSaved } from '../favorites/api.js';
import { ReportDialog } from '../reports/components/ReportDialog.jsx';

const btn =
  'inline-flex min-h-tap flex-1 items-center justify-center gap-1.5 rounded-full px-3 text-sm font-semibold ring-1 ring-brand-200 transition-colors hover:bg-brand-50 disabled:opacity-60';

/** Signed-in actions send visitors to log in first and bring them back here. */
function useRequireLogin() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  return (fn) => () => {
    if (!user) {
      navigate(`/login?next=${encodeURIComponent(location.pathname + location.search)}`);
      return;
    }
    fn();
  };
}

function SaveButton({ targetType, targetId, title }) {
  const { t } = useTranslation();
  const toast = useToast();
  const { saved, toggle, pending } = useSaved(targetType, targetId);
  const requireLogin = useRequireLogin();
  const onClick = requireLogin(async () => {
    try {
      await toggle();
      toast.success(t(saved ? 'saved.removed' : 'saved.added'));
    } catch (err) {
      toast.error(err.status === 409 ? err.message : t(errorMessageKey(err)));
    }
  });
  return (
    <button type="button" className={cn(btn, saved && 'bg-brand-700 text-white ring-brand-700 hover:bg-brand-800')} aria-pressed={saved} disabled={pending} onClick={onClick} aria-label={`${t(saved ? 'saved.savedLabel' : 'saved.save')} - ${title}`}>
      <Bookmark className={cn('h-4 w-4', saved && 'fill-current')} aria-hidden="true" />
      {t(saved ? 'saved.savedLabel' : 'saved.save')}
    </button>
  );
}

/** Web Share sheet when available, otherwise copy the link. Records a `share` event either way. */
function ShareButton({ targetType, targetId, title }) {
  const { t } = useTranslation();
  const toast = useToast();
  const onClick = async () => {
    const url = window.location.href;
    try {
      if (navigator.share) await navigator.share({ title, url });
      else {
        await navigator.clipboard.writeText(url);
        toast.success(t('share.copied'));
      }
      track('share', targetType, targetId);
    } catch (err) {
      if (err?.name !== 'AbortError') toast.error(t('share.failed'));
    }
  };
  return (
    <button type="button" className={btn} onClick={onClick} aria-label={`${t('share.share')} - ${title}`}>
      <Share2 className="h-4 w-4" aria-hidden="true" />
      {t('share.share')}
    </button>
  );
}

function ReportButton({ targetType, targetId, title, compact = false }) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const requireLogin = useRequireLogin();
  return (
    <>
      <button
        type="button"
        className={compact ? 'inline-flex min-h-tap items-center gap-1 px-1 text-[13px] font-semibold text-ink-muted hover:text-ink' : btn}
        onClick={requireLogin(() => setOpen(true))}
        aria-label={`${t('report.report')} - ${title}`}
      >
        <Flag className={compact ? 'h-3.5 w-3.5' : 'h-4 w-4'} aria-hidden="true" />
        {t('report.report')}
      </button>
      <ReportDialog open={open} onClose={() => setOpen(false)} targetType={targetType} targetId={targetId} />
    </>
  );
}

/**
 * Save / Share / Report row for detail pages. News can be shared and reported
 * but not saved (FR-FAV-1 covers businesses, offers and events).
 */
export function ItemActions({ targetType, targetId, title, canSave = true, className }) {
  return (
    <div className={cn('flex gap-2', className)}>
      {canSave && <SaveButton targetType={targetType} targetId={targetId} title={title} />}
      <ShareButton targetType={targetType} targetId={targetId} title={title} />
      <ReportButton targetType={targetType} targetId={targetId} title={title} />
    </div>
  );
}

export { ReportButton };
