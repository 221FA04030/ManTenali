import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Archive, ExternalLink, RotateCcw, Search, ShieldCheck, Trash2 } from 'lucide-react';
import { PageHeader } from '../../../components/ui/Header.jsx';
import { Badge } from '../../../components/ui/Badge.jsx';
import { Button } from '../../../components/ui/Button.jsx';
import { Input } from '../../../components/ui/Input.jsx';
import { Pagination } from '../../../components/ui/Pagination.jsx';
import { ListSkeleton } from '../../../components/ui/Skeleton.jsx';
import { EmptyState } from '../../../components/ui/EmptyState.jsx';
import { ErrorState } from '../../../components/ui/ErrorState.jsx';
import { ChipRow, chip } from '../../../components/ui/Chips.jsx';
import { formatDateTime } from '../../../lib/format.js';
import { MODERATION_STATUSES, MODERATION_TYPES, moderationLink, useModerationAudit, useModerationList } from '../../moderation/api.js';
import { ModerationStatusBadge, useModerationFlow } from '../../moderation/components/AdminModerationMenu.jsx';

const ACTION_TONE = { archive: 'amber', restore: 'green', delete: 'red' };

/** One dashboard row: what it is, who wrote it, its state, and the actions. */
function ModerationRow({ row }) {
  const { t, i18n } = useTranslation();
  const flow = useModerationFlow({ type: row.type, id: row.id, title: row.title });
  const link = moderationLink(row);
  const archived = row.moderationStatus === 'archived';
  return (
    <li className="flex flex-col gap-2 rounded-card bg-white p-4 shadow-card ring-1 ring-brand-100">
      <div className="flex flex-wrap items-center gap-1.5">
        <Badge tone="gray">{t(`moderation.types.${row.type}`)}</Badge>
        <ModerationStatusBadge row={row} />
      </div>
      <p className="break-words font-bold leading-snug">
        {link ? (
          <Link to={link} className="inline-flex min-h-tap items-center gap-1 text-brand-800 underline-offset-2 hover:underline">
            <span className="line-clamp-2">{row.title}</span> <ExternalLink className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          </Link>
        ) : (
          row.title
        )}
      </p>
      <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5 text-[13px] text-ink-muted">
        <dt>{t('moderation.author')}</dt>
        <dd className="min-w-0 break-words">{row.author ? `${row.author.name}${row.author.email ? ` (${row.author.email})` : ''}` : t('moderation.noAuthor')}</dd>
        {row.business && (
          <>
            <dt>{t('moderation.business')}</dt>
            <dd className="min-w-0 break-words">{row.business.name}</dd>
          </>
        )}
        <dt>{t('moderation.created')}</dt>
        <dd>{formatDateTime(row.publishedAt ?? row.createdAt, i18n.language)}</dd>
        {archived && (
          <>
            <dt>{t('moderation.archived')}</dt>
            <dd className="min-w-0 break-words">
              {[row.archivedBy, formatDateTime(row.archivedAt, i18n.language)].filter(Boolean).join(' • ')}
            </dd>
            {row.moderationReason && (
              <>
                <dt>{t('moderation.reason')}</dt>
                <dd className="min-w-0 whitespace-pre-line break-words">{row.moderationReason}</dd>
              </>
            )}
          </>
        )}
      </dl>
      <div className="flex flex-wrap gap-2 pt-1">
        {archived ? (
          <Button size="sm" variant="soft" onClick={() => flow.ask('restore')} aria-label={`${t('moderation.actions.restore')} - ${row.title}`}>
            <RotateCcw className="h-4 w-4" aria-hidden="true" /> {t('moderation.actions.restore')}
          </Button>
        ) : (
          <Button size="sm" variant="secondary" onClick={() => flow.ask('archive')} aria-label={`${t('moderation.actions.archive')} - ${row.title}`}>
            <Archive className="h-4 w-4" aria-hidden="true" /> {t('moderation.actions.archive')}
          </Button>
        )}
        <Button
          size="sm"
          variant="secondary"
          className="text-red-700 ring-red-200 hover:bg-red-50"
          onClick={() => flow.ask('delete')}
          aria-label={`${t('moderation.actions.delete')} - ${row.title}`}
        >
          <Trash2 className="h-4 w-4" aria-hidden="true" /> {t('moderation.actions.delete')}
        </Button>
      </div>
      {flow.dialog}
    </li>
  );
}

function ContentList({ type, status, q, author, page, setPage }) {
  const { t } = useTranslation();
  const { data, isPending, isError, error, refetch, isFetching } = useModerationList({ type, status, q: q || undefined, author: author || undefined, page });
  const items = data?.data ?? [];
  if (isPending) return <ListSkeleton rows={3} />;
  if (isError) return <ErrorState error={error} onRetry={refetch} />;
  if (items.length === 0) return <EmptyState icon={ShieldCheck} title={t('moderation.emptyTitle')} body={t('moderation.emptyBody')} />;
  return (
    <>
      <p className="text-[13px] font-semibold uppercase tracking-wide text-ink-muted" aria-live="polite" aria-busy={isFetching || undefined}>
        {t('moderation.count', { count: data.meta.total })}
      </p>
      <ul className="grid grid-cols-1 gap-3 lg:grid-cols-2">
        {items.map((row) => (
          <ModerationRow key={`${row.type}-${row.id}`} row={row} />
        ))}
      </ul>
      <Pagination page={page} totalPages={data.meta.totalPages} onChange={setPage} />
    </>
  );
}

function AuditLog({ type }) {
  const { t, i18n } = useTranslation();
  const [page, setPage] = useState(1);
  const { data, isPending, isError, error, refetch } = useModerationAudit({ contentType: type, page });
  const items = data?.data ?? [];
  if (isPending) return <ListSkeleton rows={3} />;
  if (isError) return <ErrorState error={error} onRetry={refetch} />;
  if (items.length === 0) return <EmptyState icon={ShieldCheck} title={t('moderation.auditEmpty')} body={t('moderation.auditEmptyBody')} />;
  return (
    <>
      <ul className="divide-y divide-brand-100 overflow-hidden rounded-card bg-white shadow-card ring-1 ring-brand-100">
        {items.map((a) => (
          <li key={a.id} className="flex flex-col gap-1 p-4">
            <span className="flex flex-wrap items-center gap-1.5">
              <Badge tone={ACTION_TONE[a.action]}>{t(`moderation.auditActions.${a.action}`)}</Badge>
              <Badge tone="gray">{t(`moderation.types.${a.contentType}`)}</Badge>
              {a.source === 'report' && <Badge tone="blue">{t('moderation.fromReport')}</Badge>}
            </span>
            <span className="break-words font-semibold">{a.title ?? a.contentId}</span>
            <span className="text-[13px] text-ink-muted">
              {[a.admin, formatDateTime(a.createdAt, i18n.language)].filter(Boolean).join(' • ')}
            </span>
            {a.reason && <span className="whitespace-pre-line break-words text-[13px] text-ink">{t('moderation.reasonShown', { reason: a.reason })}</span>}
          </li>
        ))}
      </ul>
      <Pagination page={page} totalPages={data.meta.totalPages} onChange={setPage} />
    </>
  );
}

/**
 * /admin/moderation - every kind of user content in one place: published and
 * archived lists by type, search by title and author, archive / restore /
 * delete permanently, and the moderation audit log. Admin route; the server
 * enforces the admin role on every request.
 */
export default function AdminModerationPage() {
  const { t } = useTranslation();
  const [params, setParams] = useSearchParams();
  const type = MODERATION_TYPES.includes(params.get('type')) ? params.get('type') : 'business';
  const view = params.get('view') === 'audit' ? 'audit' : 'content';
  const status = MODERATION_STATUSES.includes(params.get('status')) ? params.get('status') : 'all';
  const q = params.get('q') ?? '';
  const author = params.get('author') ?? '';
  const page = Math.max(1, Number(params.get('page')) || 1);
  const [draft, setDraft] = useState({ q, author });

  const update = (changes) => {
    const next = new URLSearchParams(params);
    for (const [k, v] of Object.entries({ page: undefined, ...changes })) {
      if (v === undefined || v === '' || v === null) next.delete(k);
      else next.set(k, String(v));
    }
    setParams(next, { replace: true });
  };

  return (
    <>
      <PageHeader title={t('moderation.pageTitle')} subtitle={t('moderation.pageSubtitle')} />
      <div className="flex flex-col gap-3 p-4">
        <ChipRow label={t('moderation.typeLabel')}>
          {MODERATION_TYPES.map((x) => (
            <button key={x} type="button" className={chip(type === x)} aria-pressed={type === x} onClick={() => update({ type: x })}>
              {t(`moderation.typesPlural.${x}`)}
            </button>
          ))}
        </ChipRow>
        <div role="group" aria-label={t('moderation.viewLabel')} className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4">
          {MODERATION_STATUSES.map((s) => (
            <button
              key={s}
              type="button"
              className={chip(view === 'content' && status === s)}
              aria-pressed={view === 'content' && status === s}
              onClick={() => update({ view: undefined, status: s === 'all' ? undefined : s })}
            >
              {t(`moderation.filter.${s}`)}
            </button>
          ))}
          <button type="button" className={chip(view === 'audit')} aria-pressed={view === 'audit'} onClick={() => update({ view: 'audit' })}>
            {t('moderation.auditTitle')}
          </button>
        </div>

        {view === 'content' && (
          <form
            className="grid grid-cols-1 gap-2 sm:grid-cols-[1fr_1fr_auto] sm:items-end"
            onSubmit={(e) => {
              e.preventDefault();
              update({ q: draft.q.trim(), author: draft.author.trim() });
            }}
          >
            <Input label={t('moderation.searchLabel')} value={draft.q} maxLength={100} onChange={(e) => setDraft((d) => ({ ...d, q: e.target.value }))} />
            <Input
              label={t('moderation.authorLabel')}
              hint={t('moderation.authorHint')}
              value={draft.author}
              maxLength={100}
              onChange={(e) => setDraft((d) => ({ ...d, author: e.target.value }))}
            />
            <Button type="submit" className="sm:mb-[1.4rem]">
              <Search className="h-4 w-4" aria-hidden="true" /> {t('moderation.searchButton')}
            </Button>
          </form>
        )}

        {view === 'audit' ? (
          <AuditLog type={type} />
        ) : (
          <ContentList type={type} status={status} q={q} author={author} page={page} setPage={(p) => update({ page: p })} />
        )}
      </div>
    </>
  );
}
