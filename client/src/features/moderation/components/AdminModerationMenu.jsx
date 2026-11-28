import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Archive, MoreVertical, RotateCcw, ShieldCheck, Trash2 } from 'lucide-react';
import { Modal } from '../../../components/ui/Modal.jsx';
import { Badge } from '../../../components/ui/Badge.jsx';
import { Skeleton } from '../../../components/ui/Skeleton.jsx';
import { useToast } from '../../../components/ui/Toast.jsx';
import { errorMessageKey } from '../../../lib/apiClient.js';
import { cn } from '../../../lib/cn.js';
import { useAdminPermissions } from '../useAdminPermissions.js';
import { useModerationAction, useModerationItem } from '../api.js';
import { ModerationConfirmationDialog } from './ModerationConfirmationDialog.jsx';

export const MODERATION_TONE = { archived: 'amber', published: 'green', other: 'gray' };

/** Status badge for a moderation row ("Archived", "Published", or the item's own status). */
export function ModerationStatusBadge({ row }) {
  const { t } = useTranslation();
  const label = row.moderationStatus === 'other' ? t(`status.${row.status}`, row.status) : t(`moderation.status.${row.moderationStatus}`);
  return <Badge tone={MODERATION_TONE[row.moderationStatus]}>{label}</Badge>;
}

/**
 * Hook for one action with its confirmation step: `ask(action)` opens the
 * dialog; `dialog` is the element to render. Used by the menu and the dashboard.
 */
export function useModerationFlow({ type, id, title, onDone }) {
  const { t } = useTranslation();
  const toast = useToast();
  const [action, setAction] = useState(null);
  const run = useModerationAction({
    onSuccess: (data, vars) => {
      setAction(null);
      toast.success(t(`moderation.done.${vars.action}`));
      onDone?.(vars.action, data);
    },
    onError: (err) => toast.error(err.status === 409 ? err.message : t(errorMessageKey(err))),
  });
  const dialog = (
    <ModerationConfirmationDialog
      open={Boolean(action)}
      action={action}
      title={title}
      loading={run.isPending}
      onClose={() => setAction(null)}
      onConfirm={(reason) => run.mutate({ action, type, id, reason })}
    />
  );
  return { ask: setAction, dialog, pending: run.isPending };
}

function MenuSheet({ type, id, title, open, onClose, onChoose }) {
  const { t } = useTranslation();
  const state = useModerationItem(type, id, { enabled: open });
  const row = state.data;
  const item = (action, Icon, danger = false) => (
    <li>
      <button
        type="button"
        onClick={() => onChoose(action)}
        className={cn(
          'flex min-h-[52px] w-full items-center gap-3 rounded-xl px-3 text-left text-[15px] font-semibold',
          danger ? 'text-red-700 hover:bg-red-50' : 'text-ink hover:bg-brand-50',
        )}
      >
        <Icon className="h-5 w-5 shrink-0" aria-hidden="true" />
        <span className="flex flex-col">
          {t(`moderation.actions.${action}`)}
          <span className="text-[13px] font-normal text-ink-muted">{t(`moderation.actions.${action}Hint`)}</span>
        </span>
      </button>
    </li>
  );
  return (
    <Modal open={open} onClose={onClose} title={t('moderation.menuTitle')}>
      <div className="flex flex-col gap-3">
        <div className="flex flex-col gap-1.5 rounded-xl bg-brand-50 p-3">
          <span className="flex flex-wrap items-center gap-1.5">
            <Badge tone="gray">{t(`moderation.types.${type}`)}</Badge>
            {row && <ModerationStatusBadge row={row} />}
          </span>
          {title && <p className="line-clamp-2 break-words font-bold text-ink">{title}</p>}
          {row?.moderationStatus === 'archived' && row.moderationReason && (
            <p className="text-[13px] text-ink-muted">{t('moderation.reasonShown', { reason: row.moderationReason })}</p>
          )}
        </div>
        {state.isPending ? (
          <Skeleton className="h-[110px] w-full rounded-xl" />
        ) : state.isError ? (
          <p role="alert" className="text-sm text-red-700">
            {state.error?.status === 404 ? t('moderation.gone') : t(errorMessageKey(state.error))}
          </p>
        ) : (
          <ul className="flex flex-col gap-1" aria-label={t('moderation.menuTitle')}>
            {row.moderationStatus === 'archived' ? item('restore', RotateCcw) : item('archive', Archive)}
            {item('delete', Trash2, true)}
          </ul>
        )}
      </div>
    </Modal>
  );
}

function Menu({ type, id, title, onDone, variant, className }) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const flow = useModerationFlow({ type, id, title, onDone });
  return (
    <>
      <button
        type="button"
        aria-haspopup="dialog"
        aria-label={t('moderation.menuFor', { title: title || t(`moderation.types.${type}`) })}
        title={t('moderation.menuTitle')}
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setOpen(true);
        }}
        className={cn(
          'flex min-h-tap min-w-tap shrink-0 items-center justify-center rounded-full text-ink-muted transition-colors hover:bg-brand-50 hover:text-brand-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary',
          variant === 'overlay' && 'bg-white/95 text-ink shadow-card ring-1 ring-brand-100',
          className,
        )}
      >
        <span className="relative">
          <MoreVertical className="h-5 w-5" aria-hidden="true" />
          <ShieldCheck className="absolute -bottom-1 -right-1.5 h-3 w-3 text-primary" aria-hidden="true" />
        </span>
      </button>
      <MenuSheet
        type={type}
        id={id}
        title={title}
        open={open}
        onClose={() => setOpen(false)}
        onChoose={(action) => {
          setOpen(false);
          flow.ask(action);
        }}
      />
      {flow.dialog}
    </>
  );
}

/**
 * Admin-only three-dot menu for one piece of content: Archive temporarily /
 * Restore / Delete permanently, each with a confirmation. Renders nothing for
 * anyone who is not an admin. `onDone(action)` runs after a successful action
 * (detail pages use it to leave a deleted item's page).
 */
export function AdminModerationMenu(props) {
  const { canModerate } = useAdminPermissions();
  if (!canModerate || !props.id) return null;
  return <Menu {...props} />;
}

/**
 * Wraps a card that is a single link: for admins the menu floats over its
 * top-right corner (outside the link). For everyone else the card is returned
 * unchanged.
 */
export function WithModeration({ type, id, title, onDone, className, children }) {
  const { canModerate } = useAdminPermissions();
  if (!canModerate || !id) return children;
  return (
    <div className={cn('relative', className)}>
      {children}
      <Menu type={type} id={id} title={title} onDone={onDone} variant="overlay" className="absolute right-1.5 top-1.5 z-[1] min-h-[40px] min-w-[40px]" />
    </div>
  );
}

/** For detail pages: after a permanent delete, leave the (now missing) item's page. */
export function useLeaveAfterDelete(path) {
  const navigate = useNavigate();
  return (action) => {
    if (action === 'delete') navigate(path, { replace: true });
  };
}
