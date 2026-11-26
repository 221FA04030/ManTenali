import { useId, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { formatIsoDate } from '../../../lib/dates.js';

const TYPES = ['view', 'offer_view', 'contact_click', 'share', 'search'];
const H = 160; // plot height
const PAD = { top: 18, right: 4, bottom: 22, left: 30 };
const MAX_BAR = 24;
const GAP = 2;

const total = (d) => TYPES.reduce((n, t) => n + (d[t] ?? 0), 0);

/** Clean axis maximum (1, 2, 5 x 10^n) and its ticks. */
function niceScale(max) {
  if (max <= 0) return { top: 4, ticks: [0, 2, 4] };
  const pow = 10 ** Math.floor(Math.log10(max));
  const top = [1, 2, 5, 10].map((m) => m * pow).find((v) => v >= max);
  return { top, ticks: [0, top / 2, top] };
}

/**
 * Daily activity (one series: every recorded event) as columns. One hue (brand
 * green, validated), 4px rounded tops on a square baseline, 2px gaps, only the
 * peak labelled; hover or tap shows the day's breakdown; the table below the
 * chart carries every value (the chart is an image to screen readers).
 */
export function ActivityChart({ byDay }) {
  const { t, i18n } = useTranslation();
  const id = useId();
  const [active, setActive] = useState(null);
  const width = 328;
  const plotW = width - PAD.left - PAD.right;
  const slot = plotW / Math.max(byDay.length, 1);
  const barW = Math.max(1, Math.min(MAX_BAR, slot - GAP));
  const values = byDay.map(total);
  const peak = Math.max(0, ...values);
  const { top, ticks } = niceScale(peak);
  const y = (v) => PAD.top + H - (v / top) * H;
  const peakIndex = values.indexOf(peak);
  const label = (d) => formatIsoDate(d.date, i18n.language);
  const summary = t('adminMetrics.chartSummary', { days: byDay.length, total: values.reduce((a, b) => a + b, 0), peak, peakDay: peak ? label(byDay[peakIndex]) : '-' });
  const hovered = active !== null ? byDay[active] : null;

  return (
    <figure className="flex flex-col gap-2">
      <div className="relative">
        <svg viewBox={`0 0 ${width} ${PAD.top + H + PAD.bottom}`} className="w-full" role="img" aria-labelledby={`${id}-sum`} onPointerLeave={() => setActive(null)}>
          <title id={`${id}-sum`}>{summary}</title>
          {ticks.map((tk) => (
            <g key={tk}>
              <line x1={PAD.left} x2={width - PAD.right} y1={y(tk)} y2={y(tk)} stroke="#E5EDE6" strokeWidth="1" />
              <text x={PAD.left - 6} y={y(tk) + 4} textAnchor="end" className="fill-ink-soft text-[10px]">
                {tk.toLocaleString('en-IN')}
              </text>
            </g>
          ))}
          {byDay.map((d, i) => {
            const v = values[i];
            const x = PAD.left + i * slot + (slot - barW) / 2;
            const h = (v / top) * H;
            const r = Math.min(4, barW / 2, h);
            const yTop = PAD.top + H - h;
            // Rounded top corners, square at the baseline.
            const path = h > 0 ? `M${x},${PAD.top + H} V${yTop + r} Q${x},${yTop} ${x + r},${yTop} H${x + barW - r} Q${x + barW},${yTop} ${x + barW},${yTop + r} V${PAD.top + H} Z` : null;
            return (
              <g key={d.date}>
                {path && <path d={path} fill="#15803D" opacity={active === null || active === i ? 1 : 0.45} />}
                {i === peakIndex && peak > 0 && (
                  <text x={x + barW / 2} y={yTop - 4} textAnchor="middle" className="fill-ink text-[10px] font-semibold">
                    {v.toLocaleString('en-IN')}
                  </text>
                )}
                {/* Hit target: the whole column slot, taller than the mark. */}
                <rect x={PAD.left + i * slot} y={PAD.top} width={slot} height={H} fill="transparent" onPointerEnter={() => setActive(i)} onPointerDown={() => setActive(i)} />
              </g>
            );
          })}
          <line x1={PAD.left} x2={width - PAD.right} y1={PAD.top + H} y2={PAD.top + H} stroke="#9FB3A4" strokeWidth="1" />
          {byDay.length > 0 && (
            <>
              <text x={PAD.left} y={PAD.top + H + 15} className="fill-ink-soft text-[10px]">
                {label(byDay[0])}
              </text>
              <text x={width - PAD.right} y={PAD.top + H + 15} textAnchor="end" className="fill-ink-soft text-[10px]">
                {label(byDay[byDay.length - 1])}
              </text>
            </>
          )}
        </svg>
        {hovered && (
          <div role="status" className="pointer-events-none absolute right-0 top-0 rounded-xl bg-white px-3 py-2 text-xs shadow-lift ring-1 ring-brand-100">
            <p className="font-bold text-ink">{label(hovered)}</p>
            {TYPES.map((tp) => (
              <p key={tp} className="flex justify-between gap-3 text-ink-muted">
                <span>{t(`adminMetrics.types.${tp}`)}</span>
                <span className="tabular-nums text-ink">{(hovered[tp] ?? 0).toLocaleString('en-IN')}</span>
              </p>
            ))}
          </div>
        )}
      </div>
      <details className="rounded-xl ring-1 ring-brand-100">
        <summary className="flex min-h-tap cursor-pointer items-center px-3 text-sm font-semibold text-brand-800">{t('adminMetrics.showTable')}</summary>
        <div className="overflow-x-auto px-3 pb-3">
          <table className="w-full text-right text-xs tabular-nums">
            <caption className="sr-only">{summary}</caption>
            <thead>
              <tr className="text-ink-muted">
                <th scope="col" className="py-1 text-left font-semibold">{t('adminMetrics.day')}</th>
                {TYPES.map((tp) => (
                  <th key={tp} scope="col" className="py-1 pl-2 font-semibold">
                    {t(`adminMetrics.types.${tp}`)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {byDay.map((d) => (
                <tr key={d.date} className="border-t border-brand-50">
                  <th scope="row" className="py-1 text-left font-normal">{label(d)}</th>
                  {TYPES.map((tp) => (
                    <td key={tp} className="py-1 pl-2">{d[tp] ?? 0}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </figure>
  );
}
