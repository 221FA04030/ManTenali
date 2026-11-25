import { Link } from 'react-router-dom';
import { Clock, Pin } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Badge, SampleBadge } from '../../../components/ui/Badge.jsx';
import { categoryName } from '../../categories/api.js';
import { NewsMeta, NewsTypeBadge, NewsTypeIcon, formatUntil } from './NewsBits.jsx';

/** News card: type icon, badges, title, summary, "until" time, source and times. */
export function NewsCard({ item: n }) {
  const { t, i18n } = useTranslation();
  return (
    <Link
      to={`/news/${n.slug}`}
      className="flex gap-3 rounded-card bg-white p-3 shadow-card ring-1 ring-brand-100 transition-shadow hover:shadow-lift"
    >
      <NewsTypeIcon type={n.type} />
      <span className="flex min-w-0 flex-1 flex-col gap-1">
        <span className="flex flex-wrap gap-1.5">
          {n.isPinned && (
            <Badge tone="solid" icon={Pin}>
              {t('news.pinned')}
            </Badge>
          )}
          <NewsTypeBadge type={n.type} />
          {n.category && <Badge tone="gray">{categoryName(n.category, i18n.language)}</Badge>}
          {n.isSeed && <SampleBadge />}
        </span>
        <span className="line-clamp-2 font-bold leading-snug">{n.title}</span>
        <span className="line-clamp-2 text-[14px] text-ink-muted">{n.summary}</span>
        {n.validUntilLocal && (
          <span className="flex items-center gap-1 text-[13px] font-medium text-ink">
            <Clock className="h-3.5 w-3.5 shrink-0 text-brand-700" aria-hidden="true" />
            {t('news.until', { time: formatUntil(n.validUntilLocal, i18n.language) })}
          </span>
        )}
        <NewsMeta item={n} />
      </span>
    </Link>
  );
}
