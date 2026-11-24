import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ChevronRight, ClipboardCheck } from 'lucide-react';
import { PageHeader } from '../../../components/ui/Header.jsx';
import { Badge } from '../../../components/ui/Badge.jsx';
import { Pagination } from '../../../components/ui/Pagination.jsx';
import { ListSkeleton } from '../../../components/ui/Skeleton.jsx';
import { EmptyState } from '../../../components/ui/EmptyState.jsx';
import { ErrorState } from '../../../components/ui/ErrorState.jsx';
import { IconBubble } from '../../../components/ui/IconBubble.jsx';
import { cldUrl } from '../../../lib/cloudinary.js';
import { formatRelative } from '../../../lib/format.js';
import { cn } from '../../../lib/cn.js';
import { categoryName } from '../../categories/api.js';
import { categoryIcon } from '../../../lib/categoryIcons.js';
import { useSubmissions, OWNER_STATUS_KEY, STATUS_TONE } from '../../businesses/api.js';

const TABS = ['pending', 'published', 'rejected'];

/** /admin/submissions - review queue for self-submitted businesses. */
export default function AdminSubmissionsPage() {
  const { t, i18n } = useTranslation();
  const [status, setStatus] = useState('pending');
  const [page, setPage] = useState(1);
  const { data, isPending, isError, error, refetch } = useSubmissions({ status, page });
  const items = data?.data ?? [];

  return (
    <>
      <PageHeader title={t('review.title')} />
      <div className="flex flex-col gap-3 p-4">
        <div role="tablist" aria-label={t('review.title')} className="grid grid-cols-3 gap-1 rounded-full bg-white p-1 shadow-card">
          {TABS.map((s) => (
            <button
              key={s}
              role="tab"
              type="button"
              aria-selected={status === s}
              onClick={() => {
                setStatus(s);
                setPage(1);
              }}
              className={cn(
                'min-h-tap rounded-full text-sm font-semibold transition-colors',
                status === s ? 'bg-brand-700 text-white' : 'text-ink-muted hover:text-brand-800',
              )}
            >
              {t(OWNER_STATUS_KEY[s])}
            </button>
          ))}
        </div>

        {isPending ? (
          <ListSkeleton rows={3} />
        ) : isError ? (
          <ErrorState error={error} onRetry={refetch} />
        ) : items.length === 0 ? (
          <EmptyState icon={ClipboardCheck} title={t('review.emptyTitle')} body={t(`review.empty.${status}`)} />
        ) : (
          <ul className="flex flex-col gap-3">
            {items.map((b) => (
              <li key={b.id}>
                <Link
                  to={`/admin/submissions/${b.id}`}
                  className="flex items-center gap-3 rounded-card bg-white p-3 shadow-card ring-1 ring-brand-100 hover:shadow-lift"
                >
                  {b.photo ? (
                    <img src={cldUrl(b.photo.url, { w: 128, h: 128 })} alt="" className="h-16 w-16 shrink-0 rounded-2xl object-cover" />
                  ) : (
                    <IconBubble icon={categoryIcon(b.subcategory?.icon ?? b.category?.icon)} size="lg" className="h-16 w-16" />
                  )}
                  <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                    <span className="font-bold leading-snug">{b.name}</span>
                    <span className="truncate text-sm text-ink-muted">
                      {[categoryName(b.subcategory ?? b.category, i18n.language), b.area].filter(Boolean).join(' • ')}
                    </span>
                    <span className="truncate text-xs text-ink-soft">
                      {b.owner?.name && `${t('review.by', { name: b.owner.name })} • `}
                      {t('review.submitted', { time: formatRelative(b.submittedAt, i18n.language) })}
                    </span>
                  </span>
                  <span className="flex flex-col items-end gap-1">
                    <Badge tone={STATUS_TONE[b.status]}>{t(OWNER_STATUS_KEY[b.status])}</Badge>
                    <ChevronRight className="h-5 w-5 text-ink-muted" aria-hidden="true" />
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
        {data?.meta && <Pagination page={data.meta.page} totalPages={data.meta.totalPages} onChange={setPage} />}
      </div>
    </>
  );
}
