import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ExternalLink, Flag } from 'lucide-react';
import { PageHeader } from '../../../components/ui/Header.jsx';
import { Badge } from '../../../components/ui/Badge.jsx';
import { Button } from '../../../components/ui/Button.jsx';
import { Input } from '../../../components/ui/Input.jsx';
import { Modal } from '../../../components/ui/Modal.jsx';
import { Pagination } from '../../../components/ui/Pagination.jsx';
import { ListSkeleton } from '../../../components/ui/Skeleton.jsx';
import { EmptyState } from '../../../components/ui/EmptyState.jsx';
import { ErrorState } from '../../../components/ui/ErrorState.jsx';
import { useToast } from '../../../components/ui/Toast.jsx';
import { chip } from '../../businesses/components/BusinessFilters.jsx';
import { errorMessageKey } from '../../../lib/apiClient.js';
import { formatDateTime } from '../../../lib/format.js';
import { REPORT_STATUSES, REPORT_TYPES, adminApi, reportActions, reportTargetLink, useAdminMutation, useAdminReports } from '../api.js';

const STATUS_TONE = { open: 'amber', reviewed: 'blue', actioned: 'green', dismissed: 'gray' };
const DANGER = new Set(['hide_target', 'block_user', 'hide_and_block']);

/** /admin/reports - moderation queue (FR-ADM-1): dismiss, mark reviewed, hide content, block user. */
export default function AdminReportsPage() {
  const { t, i18n } = useTranslation();
  const toast = useToast();
  const [status, setStatus] = useState('open');
  const [type, setType] = useState('');
  const [page, setPage] = useState(1);
  const [pending, setPending] = useState(null); // { report, action }
  const [note, setNote] = useState('');
  const { data, isPending, isError, error, refetch } = useAdminReports({ status, targetType: type || undefined, page });
  const act = useAdminMutation(({ id, action, note: n }) => adminApi.actOnReport(id, { action, ...(n ? { note: n } : {}) }), {
    onSuccess: (r) => {
      setPending(null);
      toast.success(t('adminReports.done', { status: t(`adminReports.status.${r.status}`) }));
    },
    onError: (err) => toast.error(err.status === 409 ? err.message : t(errorMessageKey(err))),
  });
  const items = data?.data ?? [];
  const open = (report, action) => {
    setNote('');
    setPending({ report, action });
  };

  return (
    <>
      <PageHeader title={t('adminReports.title')} />
      <div className="flex flex-col gap-3 p-4">
        <div role="group" aria-label={t('form.status')} className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4">
          {REPORT_STATUSES.map((s) => (
            <button key={s} type="button" className={chip(status === s)} aria-pressed={status === s} onClick={() => { setStatus(s); setPage(1); }}>
              {t(`adminReports.status.${s}`)}
            </button>
          ))}
        </div>
        <Input as="select" aria-label={t('adminReports.typeLabel')} value={type} onChange={(e) => { setType(e.target.value); setPage(1); }}>
          <option value="">{t('adminReports.allTypes')}</option>
          {REPORT_TYPES.map((x) => (
            <option key={x} value={x}>
              {t(`adminReports.types.${x}`)}
            </option>
          ))}
        </Input>

        {isPending ? (
          <ListSkeleton rows={3} />
        ) : isError ? (
          <ErrorState error={error} onRetry={refetch} />
        ) : items.length === 0 ? (
          <EmptyState icon={Flag} title={t('adminReports.emptyTitle')} body={t('adminReports.emptyBody')} />
        ) : (
          <ul className="flex flex-col gap-3">
            {items.map((r) => {
              const link = reportTargetLink(r);
              return (
                <li key={r.id} className="flex flex-col gap-2 rounded-card bg-white p-4 shadow-card ring-1 ring-brand-100">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <Badge tone="gray">{t(`adminReports.types.${r.targetType}`)}</Badge>
                    <Badge tone={r.targetType === 'suggestion' ? 'blue' : 'red'}>{t(`adminReports.reasons.${r.reason}`)}</Badge>
                    <Badge tone={STATUS_TONE[r.status]}>{t(`adminReports.status.${r.status}`)}</Badge>
                  </div>
                  {r.targetType !== 'suggestion' &&
                    (r.target ? (
                      <p className="flex flex-wrap items-center gap-2 font-bold leading-snug">
                        {link ? (
                          <Link to={link} className="inline-flex min-h-tap items-center gap-1 text-brand-800 underline-offset-2 hover:underline">
                            {r.target.title} <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
                          </Link>
                        ) : (
                          r.target.title
                        )}
                        {!r.target.isPublic && <Badge tone="gray">{t('adminReports.notPublic', { status: t(`status.${r.target.status}`, r.target.status) })}</Badge>}
                      </p>
                    ) : (
                      <p className="text-sm italic text-ink-muted">{t('adminReports.targetGone')}</p>
                    ))}
                  {r.details && <p className="whitespace-pre-line rounded-xl bg-brand-50 p-3 text-[15px]">{r.details}</p>}
                  <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5 text-[13px] text-ink-muted">
                    <dt>{t('adminReports.reportedBy')}</dt>
                    <dd className="min-w-0 break-words">{r.reporter ? `${r.reporter.name} (${r.reporter.email ?? '-'})` : '-'}</dd>
                    {r.responsibleUser && r.targetType !== 'suggestion' && (
                      <>
                        <dt>{t('adminReports.responsible')}</dt>
                        <dd className="min-w-0 break-words">{`${r.responsibleUser.name} (${r.responsibleUser.email ?? '-'})`}</dd>
                      </>
                    )}
                    <dt>{t('adminReports.when')}</dt>
                    <dd>{formatDateTime(r.createdAt, i18n.language)}</dd>
                    {r.resolution && (
                      <>
                        <dt>{t('adminReports.handled')}</dt>
                        <dd className="min-w-0 break-words">
                          {[t(`adminReports.actions.${r.resolution.action}`), r.handledBy, r.handledAt && formatDateTime(r.handledAt, i18n.language), r.resolution.note].filter(Boolean).join(' • ')}
                        </dd>
                      </>
                    )}
                  </dl>
                  {reportActions(r).length > 0 && (
                    <div className="flex flex-wrap gap-2 pt-1">
                      {reportActions(r).map((a) => (
                        <Button key={a} size="md" variant={DANGER.has(a) ? 'danger' : 'secondary'} onClick={() => open(r, a)} aria-label={`${t(`adminReports.actions.${a}`)} - ${r.target?.title ?? t(`adminReports.types.${r.targetType}`)}`}>
                          {t(`adminReports.actions.${a}`)}
                        </Button>
                      ))}
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
        {data?.meta && <Pagination page={data.meta.page} totalPages={data.meta.totalPages} onChange={setPage} />}
      </div>

      <Modal
        open={Boolean(pending)}
        onClose={() => setPending(null)}
        title={pending ? t(`adminReports.confirm.${pending.action}`) : ''}
        footer={
          <>
            <Button variant="secondary" onClick={() => setPending(null)}>
              {t('common.cancel')}
            </Button>
            <Button
              variant={pending && DANGER.has(pending.action) ? 'danger' : 'primary'}
              loading={act.isPending}
              onClick={() => act.mutate({ id: pending.report.id, action: pending.action, note: note.trim() })}
            >
              {pending ? t(`adminReports.actions.${pending.action}`) : ''}
            </Button>
          </>
        }
      >
        {pending && (
          <div className="flex flex-col gap-3">
            <p className="text-sm text-ink-muted">
              {t(`adminReports.explain.${pending.action}`, { name: pending.report.responsibleUser?.name ?? '' })}
            </p>
            <Input as="textarea" label={t('adminReports.note')} maxLength={500} value={note} onChange={(e) => setNote(e.target.value)} hint={t('adminReports.noteHint')} />
          </div>
        )}
      </Modal>
    </>
  );
}
