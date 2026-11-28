import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Check, ExternalLink, Inbox, Mic, MicOff, Newspaper, Save, X } from 'lucide-react';
import { PageHeader } from '../../../components/ui/Header.jsx';
import { Button } from '../../../components/ui/Button.jsx';
import { Input } from '../../../components/ui/Input.jsx';
import { Modal } from '../../../components/ui/Modal.jsx';
import { Badge } from '../../../components/ui/Badge.jsx';
import { Pagination } from '../../../components/ui/Pagination.jsx';
import { ListSkeleton } from '../../../components/ui/Skeleton.jsx';
import { EmptyState } from '../../../components/ui/EmptyState.jsx';
import { ErrorState } from '../../../components/ui/ErrorState.jsx';
import { useToast } from '../../../components/ui/Toast.jsx';
import { errorMessageKey } from '../../../lib/apiClient.js';
import { formatRelative } from '../../../lib/format.js';
import { cn } from '../../../lib/cn.js';
import { IMPORT_STATUSES, newsImportApi, useImportMutation, useNewsImports } from '../newsImportApi.js';

const STATUS_TONE = { needs_review: 'amber', published: 'green', rejected: 'gray', failed: 'red' };
const LIMITS = { title: 140, summary: 300 };

function formatPosted(iso, lang) {
  if (!iso) return null;
  return new Intl.DateTimeFormat(lang === 'te' ? 'te-IN' : 'en-IN', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Kolkata' }).format(new Date(iso));
}

/** The app's own placeholder: imported news never uses the source's image. */
function Placeholder() {
  return (
    <span aria-hidden="true" className="flex aspect-video w-full items-center justify-center rounded-xl bg-photo-placeholder sm:w-48 sm:shrink-0">
      <Newspaper className="h-10 w-10 text-primary/40" strokeWidth={1.5} />
    </span>
  );
}

function Transcript({ transcript, mediaType }) {
  const { t } = useTranslation();
  const has = transcript.status === 'transcribed' && transcript.text;
  return (
    <div className="rounded-xl bg-surface-soft p-3 text-sm ring-1 ring-line">
      <p className="flex items-center gap-1.5 font-semibold text-heading">
        {has ? <Mic className="h-4 w-4 text-primary" aria-hidden="true" /> : <MicOff className="h-4 w-4 text-meta" aria-hidden="true" />}
        {t('newsImport.review.transcript')}
        <span className="font-normal text-meta">· {t(`newsImport.transcript.${transcript.status}`)}</span>
      </p>
      {has ? (
        <p className="mt-1 whitespace-pre-line text-heading" lang={transcript.language ?? undefined}>
          {transcript.text}
        </p>
      ) : (
        <p className="mt-1 text-meta">{mediaType === 'reel' || mediaType === 'video' ? t('newsImport.review.listenFirst') : t('newsImport.review.noAudio')}</p>
      )}
      {has && (transcript.language || transcript.method) && (
        <p className="mt-1 text-xs text-meta">{[transcript.language, transcript.method].filter(Boolean).join(' · ')}</p>
      )}
    </div>
  );
}

function ImportCard({ item, onReject }) {
  const { t, i18n } = useTranslation();
  const toast = useToast();
  const [title, setTitle] = useState(item.news?.title ?? '');
  const [summary, setSummary] = useState(item.news?.summary ?? '');
  const reviewing = item.status === 'needs_review' && item.news;
  const onError = (err) => toast.error(err.status === 400 || err.status === 409 ? err.message : t(errorMessageKey(err)));
  const body = () => ({ title: title.trim(), summary: summary.trim() });
  const save = useImportMutation(() => newsImportApi.save(item.id, body()), { onSuccess: () => toast.success(t('newsImport.review.saved')), onError });
  const publish = useImportMutation(() => newsImportApi.publish(item.id, body()), { onSuccess: () => toast.success(t('newsImport.review.published')), onError });
  const busy = save.isPending || publish.isPending;
  const posted = formatPosted(item.postedAt, i18n.language);

  return (
    <li className="rounded-card bg-white p-4 shadow-card ring-1 ring-line">
      <div className="flex flex-col gap-3 sm:flex-row">
        <Placeholder />
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <span className="flex flex-wrap items-center gap-1.5">
            <Badge tone={STATUS_TONE[item.status]}>{t(`newsImport.status.${item.status}`)}</Badge>
            <Badge tone="gray">{t(`newsImport.media.${item.mediaType}`)}{item.durationSec ? ` · ${item.durationSec}s` : ''}</Badge>
          </span>
          {/* Source attribution and link stay visible on every item. */}
          <p className="text-sm font-semibold text-heading">
            {item.sourceName} <span className="font-normal text-meta">@{item.account}</span>
          </p>
          <p className="text-xs text-meta">
            {[posted && t('newsImport.review.posted', { time: posted }), t('newsImport.review.imported', { time: formatRelative(item.importedAt, i18n.language) })].filter(Boolean).join(' • ')}
          </p>
          <a href={item.postUrl} target="_blank" rel="noopener noreferrer" className="inline-flex w-fit items-center gap-1 text-sm font-semibold text-primary-dark underline-offset-2 hover:underline">
            {t('newsImport.review.openSource')}
            <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
            <span className="sr-only">{t('newsImport.review.newTab')}</span>
          </a>
        </div>
      </div>

      <div className="mt-3 flex flex-col gap-3">
        <div className="rounded-xl p-3 text-sm ring-1 ring-line">
          <p className="font-semibold text-heading">{t('newsImport.review.caption')}</p>
          <p className="mt-1 whitespace-pre-line text-heading" lang="te">
            {item.caption || <span className="text-meta">{t('newsImport.review.noCaption')}</span>}
          </p>
        </div>
        <Transcript transcript={item.transcript} mediaType={item.mediaType} />

        {item.status === 'failed' && <p className="rounded-xl bg-red-50 p-3 text-sm text-red-800">{item.error}</p>}
        {item.status === 'rejected' && item.rejectReason && <p className="text-sm text-meta">{t('newsImport.review.rejectedBecause', { reason: item.rejectReason })}</p>}

        {reviewing ? (
          <>
            <Input label={t('newsImport.review.headline')} value={title} maxLength={LIMITS.title} onChange={(e) => setTitle(e.target.value)} hint={`${title.length}/${LIMITS.title}`} />
            <Input
              as="textarea"
              label={t('newsImport.review.summary')}
              value={summary}
              maxLength={LIMITS.summary}
              onChange={(e) => setSummary(e.target.value)}
              hint={`${summary.length}/${LIMITS.summary} · ${t('newsImport.review.summaryHint')}`}
            />
            <div className="flex flex-wrap gap-2">
              <Button onClick={() => publish.mutate()} loading={publish.isPending} disabled={busy}>
                <Check className="h-4 w-4" aria-hidden="true" /> {t('newsImport.review.publish')}
              </Button>
              <Button variant="secondary" onClick={() => save.mutate()} loading={save.isPending} disabled={busy}>
                <Save className="h-4 w-4" aria-hidden="true" /> {t('newsImport.review.save')}
              </Button>
              <Button variant="ghost" onClick={() => onReject(item)} disabled={busy}>
                <X className="h-4 w-4" aria-hidden="true" /> {t('newsImport.review.reject')}
              </Button>
            </div>
          </>
        ) : (
          item.news && (
            <div className="text-sm">
              <p className="font-semibold text-heading">{item.news.title}</p>
              <p className="mt-0.5 text-meta">{item.news.summary}</p>
            </div>
          )
        )}
      </div>
    </li>
  );
}

/**
 * /admin/news/imports - review news fetched from S News Tenali. Every import
 * is a draft: the admin checks the source, edits the headline and summary,
 * then publishes or rejects it. The source name and link stay with the item.
 */
export default function AdminNewsImportsPage() {
  const { t } = useTranslation();
  const toast = useToast();
  const [params, setParams] = useSearchParams();
  const status = IMPORT_STATUSES.includes(params.get('status')) ? params.get('status') : 'needs_review';
  const [page, setPage] = useState(1);
  const [rejecting, setRejecting] = useState(null);
  const [reason, setReason] = useState('');
  const { data, isPending, isError, error, refetch } = useNewsImports({ status, page });
  const counts = data?.meta?.counts;
  const items = data?.data ?? [];

  const reject = useImportMutation(() => newsImportApi.reject(rejecting.id, reason.trim() ? { reason: reason.trim() } : {}), {
    onSuccess: () => {
      setRejecting(null);
      setReason('');
      toast.success(t('newsImport.review.rejected'));
    },
    onError: (err) => toast.error(err.status === 409 ? err.message : t(errorMessageKey(err))),
  });

  return (
    <>
      <PageHeader title={t('newsImport.review.title')} subtitle={t('newsImport.review.subtitle')} />
      <div className="flex flex-col gap-3 p-4">
        <div role="tablist" aria-label={t('newsImport.countsLabel')} className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4">
          {IMPORT_STATUSES.map((s) => (
            <button
              key={s}
              type="button"
              role="tab"
              aria-selected={s === status}
              onClick={() => {
                setParams({ status: s });
                setPage(1);
              }}
              className={cn(
                'inline-flex min-h-[40px] shrink-0 items-center gap-1.5 rounded-full px-3.5 text-[13px] font-semibold ring-1',
                s === status ? 'bg-primary-dark text-white ring-primary-dark' : 'bg-white text-heading ring-line hover:bg-surface-soft',
              )}
            >
              {t(`newsImport.status.${s}`)}
              {counts && <span className={cn('rounded-full px-1.5 text-[11px]', s === status ? 'bg-white/20' : 'bg-surface-soft')}>{counts[s]}</span>}
            </button>
          ))}
        </div>

        {isPending ? (
          <ListSkeleton rows={3} />
        ) : isError ? (
          <ErrorState error={error} onRetry={refetch} />
        ) : items.length === 0 ? (
          <EmptyState icon={Inbox} title={t(`newsImport.empty.${status}`)} body={t('newsImport.empty.body')} />
        ) : (
          <ul className="flex flex-col gap-3">
            {items.map((item) => (
              <ImportCard key={`${item.id}-${item.news?.title ?? ''}-${item.news?.summary ?? ''}`} item={item} onReject={setRejecting} />
            ))}
          </ul>
        )}
        {data?.meta && <Pagination page={data.meta.page} totalPages={data.meta.totalPages} onChange={setPage} />}
      </div>

      <Modal
        open={Boolean(rejecting)}
        onClose={() => setRejecting(null)}
        title={t('newsImport.review.rejectTitle')}
        footer={
          <>
            <Button variant="secondary" onClick={() => setRejecting(null)}>
              {t('common.cancel')}
            </Button>
            <Button variant="danger" loading={reject.isPending} onClick={() => reject.mutate()}>
              {t('newsImport.review.reject')}
            </Button>
          </>
        }
      >
        <p className="mb-3 text-sm text-meta">{t('newsImport.review.rejectBody')}</p>
        <Input as="textarea" label={t('newsImport.review.rejectReason')} value={reason} maxLength={300} onChange={(e) => setReason(e.target.value)} />
      </Modal>
    </>
  );
}
