import { ActivityEvent, ACTIVITY_TYPES } from './analytics.model.js';
import { AppError } from '../../common/errors/index.js';
import { istEndOfDay, istStartOfDay, istToday } from '../../common/utils/dates.js';
import { TIMEZONE } from '../../config/constants.js';

const DAY_MS = 86_400_000;
export const MAX_SUMMARY_DAYS = 92;

/** FR-ANA-1: record one anonymous activity event (no user id, IP or coordinates are stored). */
export async function record({ type, targetType, targetId, sessionId }) {
  await ActivityEvent.create({ type, targetType, targetId, sessionId });
  return { recorded: true };
}

/** "2026-11-25" + n calendar days (no time zone involved: it is a calendar date). */
function shiftDate(isoDate, days) {
  const [y, m, d] = isoDate.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d) + days * DAY_MS).toISOString().slice(0, 10);
}

/**
 * Admin summary (spec: "counts by type and date range"): totals per type,
 * per IST day, and distinct anonymous sessions. Defaults to the last 7 days.
 * The metrics screen comes with Step 10.
 */
export async function summary({ from, to } = {}, now = new Date()) {
  const end = to ?? istToday(now);
  const start = from ?? shiftDate(end, -6);
  const days = Math.round((Date.parse(end) - Date.parse(start)) / DAY_MS) + 1;
  if (days > MAX_SUMMARY_DAYS) {
    throw AppError.validation(`Choose at most ${MAX_SUMMARY_DAYS} days.`, [{ field: 'query.from', message: `At most ${MAX_SUMMARY_DAYS} days` }]);
  }
  const match = { createdAt: { $gte: istStartOfDay(start), $lte: istEndOfDay(end) } };
  const [byDayType, sessions] = await Promise.all([
    ActivityEvent.aggregate([
      { $match: match },
      { $group: { _id: { day: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt', timezone: TIMEZONE } }, type: '$type' }, n: { $sum: 1 } } },
    ]),
    ActivityEvent.distinct('sessionId', match),
  ]);
  const empty = () => Object.fromEntries(ACTIVITY_TYPES.map((t) => [t, 0]));
  const totals = empty();
  const byDay = new Map(Array.from({ length: days }, (_, i) => [shiftDate(start, i), empty()]));
  for (const row of byDayType) {
    totals[row._id.type] += row.n;
    byDay.get(row._id.day)[row._id.type] += row.n;
  }
  return { from: start, to: end, totals, sessions: sessions.length, byDay: [...byDay].map(([date, counts]) => ({ date, ...counts })) };
}
