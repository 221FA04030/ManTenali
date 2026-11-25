import { useTranslation } from 'react-i18next';
import { Badge } from '../../../components/ui/Badge.jsx';
import { cn } from '../../../lib/cn.js';
import { formatDateTime, formatRelative } from '../../../lib/format.js';
import { formatIsoDate, formatLocalTime } from '../../../lib/dates.js';
import { STATUS_TONE, typeInfo } from '../api.js';

/** Coloured type pill: icon + "Traffic", "Power cut", ... */
export function NewsTypeBadge({ type, className }) {
  const { t } = useTranslation();
  const { icon: Icon, tone } = typeInfo(type);
  return (
    <span className={cn('inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-semibold leading-4', tone, className)}>
      <Icon className="h-3 w-3" aria-hidden="true" />
      {t(`news.types.${type}`)}
    </span>
  );
}

/** Round icon bubble used on cards. */
export function NewsTypeIcon({ type, className }) {
  const { icon: Icon, tone } = typeInfo(type);
  return (
    <span className={cn('flex h-11 w-11 shrink-0 items-center justify-center rounded-full', tone, className)} aria-hidden="true">
      <Icon className="h-5 w-5" />
    </span>
  );
}

/** "Until 26 Nov 2026, 6:00 pm" from an IST "YYYY-MM-DDTHH:mm" string. */
export function formatUntil(local, lang) {
  if (!local) return '';
  return `${formatIsoDate(local.slice(0, 10), lang)}, ${formatLocalTime(local, lang)}`;
}

/**
 * Trust line (FR-NEWS-2): source name, published time and, when edited
 * later, the updated time. `detailed` shows absolute times instead of relative.
 */
export function NewsMeta({ item, detailed = false, className }) {
  const { t, i18n } = useTranslation();
  const lang = i18n.language;
  const fmt = (v) => (detailed ? formatDateTime(v, lang) : formatRelative(v, lang));
  const published = item.publishedAt;
  const edited = item.updatedAt && published && new Date(item.updatedAt) - new Date(published) > 60_000;
  return (
    <p className={cn('text-[13px] text-ink-muted', className)}>
      <span className="font-semibold text-ink">{t('news.source', { name: item.sourceName })}</span>
      {published && <span> • {t('news.published', { time: fmt(published) })}</span>}
      {edited && <span> • {t('common.updated', { time: fmt(item.updatedAt) })}</span>}
    </p>
  );
}

export function NewsStatusBadge({ status }) {
  const { t } = useTranslation();
  return <Badge tone={STATUS_TONE[status] ?? 'gray'}>{t(`status.${status}`)}</Badge>;
}
