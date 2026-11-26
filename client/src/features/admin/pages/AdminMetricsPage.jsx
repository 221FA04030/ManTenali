import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { PageHeader } from '../../../components/ui/Header.jsx';
import { Card } from '../../../components/ui/Card.jsx';
import { ListSkeleton, Skeleton } from '../../../components/ui/Skeleton.jsx';
import { ErrorState } from '../../../components/ui/ErrorState.jsx';
import { chip } from '../../businesses/components/BusinessFilters.jsx';
import { istToday } from '../../../lib/dates.js';
import { useAdminMetrics } from '../api.js';
import { ActivityChart } from '../components/ActivityChart.jsx';

const RANGES = [7, 30, 90];
const TYPES = ['view', 'contact_click', 'search', 'offer_view', 'share'];
const fmt = (n) => (n ?? 0).toLocaleString('en-IN');

function shift(isoDate, days) {
  const [y, m, d] = isoDate.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d) + days * 86_400_000).toISOString().slice(0, 10);
}

/** Stat tile: label, value, optional caption (e.g. "12 of 40"). */
function Tile({ label, value, caption }) {
  return (
    <div className="flex flex-col gap-0.5 rounded-card bg-white p-3 shadow-card ring-1 ring-brand-100">
      <span className="text-xs font-semibold text-ink-muted">{label}</span>
      <span className="text-2xl font-bold tabular-nums text-ink">{value}</span>
      {caption && <span className="text-xs text-ink-soft">{caption}</span>}
    </div>
  );
}

/**
 * /admin/metrics - launch metrics (FR-ADM-2, spec section 14) from anonymous
 * activity events: totals by type, daily activity, active devices, searches
 * that led to a contact, 7-day return rate, event views and shares, and
 * listing freshness. Times and days are IST.
 */
export default function AdminMetricsPage() {
  const { t } = useTranslation();
  const [days, setDays] = useState(7);
  const params = useMemo(() => {
    const to = istToday();
    return { from: shift(to, -(days - 1)), to };
  }, [days]);
  const { data, isPending, isError, error, refetch, isFetching } = useAdminMetrics(params);
  const pct = (x) => (x?.rate === null || x?.rate === undefined ? '-' : `${x.rate}%`);
  const m = data?.metrics;

  return (
    <>
      <PageHeader title={t('adminMetrics.title')} />
      <div className="flex flex-col gap-4 p-4">
        <div role="group" aria-label={t('adminMetrics.range')} className="flex gap-2">
          {RANGES.map((r) => (
            <button key={r} type="button" className={chip(days === r)} aria-pressed={days === r} onClick={() => setDays(r)}>
              {t('adminMetrics.lastDays', { count: r })}
            </button>
          ))}
        </div>
        <p className="text-xs text-ink-soft">{t('adminMetrics.privacy')}</p>

        {isPending ? (
          <>
            <Skeleton className="h-[220px] w-full rounded-card" />
            <ListSkeleton rows={2} />
          </>
        ) : isError ? (
          <ErrorState error={error} onRetry={refetch} />
        ) : (
          <div className={`flex flex-col gap-4 ${isFetching ? 'opacity-70' : ''}`} aria-busy={isFetching || undefined}>
            <section aria-labelledby="metrics-people" className="flex flex-col gap-2">
              <h2 id="metrics-people" className="text-base font-bold">{t('adminMetrics.people')}</h2>
              <div className="grid grid-cols-2 gap-2">
                <Tile label={t('adminMetrics.activeDevices')} value={fmt(m.activeDevices7d)} caption={t('adminMetrics.activeDevicesHint')} />
                <Tile label={t('adminMetrics.devicesInRange')} value={fmt(data.sessions)} />
                <Tile label={t('adminMetrics.searchToContact')} value={pct(m.searchToContact)} caption={t('adminMetrics.ofCount', { part: fmt(m.searchToContact.converted), whole: fmt(m.searchToContact.searchSessions) })} />
                <Tile label={t('adminMetrics.retention')} value={pct(m.retention7d)} caption={m.retention7d.cohort ? t('adminMetrics.ofCount', { part: fmt(m.retention7d.returned), whole: fmt(m.retention7d.cohort) }) : t('adminMetrics.notEnough')} />
              </div>
            </section>

            <Card className="flex flex-col gap-2">
              <h2 className="text-base font-bold">{t('adminMetrics.daily')}</h2>
              <ActivityChart byDay={data.byDay} />
            </Card>

            <section aria-labelledby="metrics-activity" className="flex flex-col gap-2">
              <h2 id="metrics-activity" className="text-base font-bold">{t('adminMetrics.activity')}</h2>
              <div className="grid grid-cols-2 gap-2">
                {TYPES.map((tp) => (
                  <Tile key={tp} label={t(`adminMetrics.types.${tp}`)} value={fmt(data.totals[tp])} />
                ))}
                <Tile label={t('adminMetrics.eventViews')} value={fmt(m.events.views)} caption={t('adminMetrics.eventShares', { count: m.events.shares })} />
              </div>
            </section>

            <section aria-labelledby="metrics-fresh" className="flex flex-col gap-2">
              <h2 id="metrics-fresh" className="text-base font-bold">{t('adminMetrics.freshness', { days: m.freshness.days })}</h2>
              <div className="grid grid-cols-3 gap-2">
                {['businesses', 'offers', 'events'].map((k) => (
                  <Tile key={k} label={t(`adminMetrics.fresh.${k}`)} value={pct(m.freshness[k])} caption={t('adminMetrics.ofCount', { part: fmt(m.freshness[k].fresh), whole: fmt(m.freshness[k].total) })} />
                ))}
              </div>
            </section>
          </div>
        )}
      </div>
    </>
  );
}
