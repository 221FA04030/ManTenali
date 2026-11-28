import { useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { AlertTriangle, CheckCircle2, ChevronRight, DownloadCloud, LoaderCircle } from 'lucide-react';
import { Button } from '../../../components/ui/Button.jsx';
import { useToast } from '../../../components/ui/Toast.jsx';
import { errorMessageKey } from '../../../lib/apiClient.js';
import { formatRelative } from '../../../lib/format.js';
import { IMPORT_STATUSES, importKeys, useLatestImportRun, useNewsImports, useStartFetch } from '../newsImportApi.js';

const COUNT_TONE = {
  needs_review: 'bg-amber-50 text-amber-900 ring-amber-200',
  published: 'bg-brand-50 text-brand-800 ring-brand-200',
  rejected: 'bg-gray-50 text-gray-700 ring-gray-200',
  failed: 'bg-red-50 text-red-800 ring-red-200',
};

function RunSummary({ run }) {
  const { t, i18n } = useTranslation();
  const running = run.status === 'running';
  const Icon = running ? LoaderCircle : run.status === 'failed' ? AlertTriangle : CheckCircle2;
  const numbers = [
    ['checked', run.checked],
    ['imported', run.imported],
    ['duplicates', run.duplicates],
    ['failed', run.failed],
  ];
  return (
    <div role="status" aria-live="polite" className="rounded-xl bg-surface-soft p-3 text-sm ring-1 ring-line">
      <p className="flex items-center gap-2 font-semibold text-heading">
        <Icon className={`h-4 w-4 shrink-0 ${running ? 'animate-spin text-primary' : run.status === 'failed' ? 'text-red-700' : 'text-primary'}`} aria-hidden="true" />
        {t(`newsImport.run.${run.status}`, { account: run.account })}
      </p>
      {running && <p className="mt-1 text-meta">{t('newsImport.run.progress', { checked: run.checked, requested: run.requested ?? '?' })}</p>}
      {run.error && <p className="mt-1 text-red-800">{run.error}</p>}
      <dl className="mt-2 grid grid-cols-4 gap-1.5 text-center">
        {numbers.map(([key, n]) => (
          <div key={key} className="rounded-lg bg-white px-1 py-1.5 ring-1 ring-line">
            <dd className="text-base font-bold text-heading">{n}</dd>
            <dt className="text-[11px] leading-tight text-meta">{t(`newsImport.run.counts.${key}`)}</dt>
          </div>
        ))}
      </dl>
      {!running && run.finishedAt && <p className="mt-2 text-xs text-meta">{t('newsImport.run.finished', { time: formatRelative(run.finishedAt, i18n.language) })}</p>}
    </div>
  );
}

/**
 * Admin News: "Fetch News" from S News Tenali (Instagram, via Apify on the
 * server). Starts a fetch, shows its progress and counts while it runs, and how
 * many imported posts need review, were published, rejected or failed, with a
 * link to the review screen. Imports are always drafts; nothing is published here.
 */
export function FetchNewsPanel() {
  const { t } = useTranslation();
  const toast = useToast();
  const qc = useQueryClient();
  const latest = useLatestImportRun();
  const totals = useNewsImports({ limit: 1 });
  const run = latest.data;
  const running = run?.status === 'running';
  const counts = totals.data?.meta?.counts;

  const start = useStartFetch({
    onError: (err) => toast.error(err.status === 409 || err.status === 503 ? err.message : t(errorMessageKey(err))),
  });

  // When a fetch finishes, refresh the import counts and the news list (new drafts).
  const wasRunning = useRef(false);
  useEffect(() => {
    if (wasRunning.current && run && !running) {
      qc.invalidateQueries({ queryKey: importKeys.all });
      qc.invalidateQueries({ queryKey: ['news'] });
      if (run.status === 'succeeded') toast.success(t('newsImport.run.doneToast', { count: run.imported }));
    }
    wasRunning.current = running;
  }, [running, run, qc, toast, t]);

  return (
    <section aria-labelledby="fetch-news-title" className="rounded-card bg-white p-4 shadow-card ring-1 ring-line">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 id="fetch-news-title" className="font-bold text-heading">
            {t('newsImport.title')}
          </h2>
          <p className="mt-0.5 text-[13px] text-meta">{t('newsImport.subtitle')}</p>
        </div>
        <Button size="sm" onClick={() => start.mutate()} loading={start.isPending} disabled={running} className="shrink-0">
          <DownloadCloud className="h-4 w-4" aria-hidden="true" />
          {running ? t('newsImport.fetching') : t('newsImport.fetch')}
        </Button>
      </div>

      {run && (
        <div className="mt-3">
          <RunSummary run={run} />
        </div>
      )}

      <ul aria-label={t('newsImport.countsLabel')} className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
        {IMPORT_STATUSES.map((s) => (
          <li key={s}>
            <Link to={`/admin/news/imports?status=${s}`} className={`flex items-center justify-between rounded-xl px-3 py-2 ring-1 ${COUNT_TONE[s]}`}>
              <span className="text-[13px] font-medium">{t(`newsImport.status.${s}`)}</span>
              <span className="text-base font-bold">{counts ? counts[s] : '–'}</span>
            </Link>
          </li>
        ))}
      </ul>

      <Link
        to="/admin/news/imports?status=needs_review"
        className="mt-3 inline-flex min-h-tap items-center gap-1 text-sm font-semibold text-primary-dark hover:text-primary"
      >
        {t('newsImport.reviewLink', { count: counts?.needs_review ?? 0 })}
        <ChevronRight className="h-4 w-4" aria-hidden="true" />
      </Link>
    </section>
  );
}
