import { ActivityEvent, ACTIVITY_TYPES } from './analytics.model.js';
import * as businessesService from '../businesses/businesses.service.js';
import * as offersService from '../offers/offers.service.js';
import * as eventsService from '../events/events.service.js';
import { AppError } from '../../common/errors/index.js';
import { istEndOfDay, istStartOfDay, istToday } from '../../common/utils/dates.js';
import { TIMEZONE } from '../../config/constants.js';

const DAY_MS = 86_400_000;
export const MAX_SUMMARY_DAYS = 92;
export const FRESH_DAYS = 30;
export const RETURN_AFTER_DAYS = 7;

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

const rate = (part, whole) => (whole ? Math.round((part / whole) * 1000) / 10 : null); // percent, 1 decimal

/** Sessions that searched in the range, and how many of them tapped a contact button after searching. */
async function searchToContact(match) {
  const [r] = await ActivityEvent.aggregate([
    { $match: { ...match, type: { $in: ['search', 'contact_click'] } } },
    {
      $group: {
        _id: '$sessionId',
        firstSearch: { $min: { $cond: [{ $eq: ['$type', 'search'] }, '$createdAt', null] } },
        lastContact: { $max: { $cond: [{ $eq: ['$type', 'contact_click'] }, '$createdAt', null] } },
      },
    },
    { $match: { firstSearch: { $ne: null } } },
    { $group: { _id: null, searchSessions: { $sum: 1 }, converted: { $sum: { $cond: [{ $gt: ['$lastContact', '$firstSearch'] }, 1, 0] } } } },
  ]);
  const searchSessions = r?.searchSessions ?? 0;
  const converted = r?.converted ?? 0;
  return { searchSessions, converted, rate: rate(converted, searchSessions) };
}

/**
 * 7-day retention: devices first seen in the range (and at least 7 days ago),
 * and how many were active again 7 or more days after their first activity.
 * "First seen" looks at everything kept (events expire after 180 days).
 */
async function retention(start, end, now) {
  const cutoff = new Date(Math.min(end.getTime(), now.getTime()) - RETURN_AFTER_DAYS * DAY_MS);
  if (cutoff < start) return { cohort: 0, returned: 0, rate: null };
  const [r] = await ActivityEvent.aggregate([
    { $group: { _id: '$sessionId', first: { $min: '$createdAt' }, last: { $max: '$createdAt' } } },
    { $match: { first: { $gte: start, $lte: cutoff } } },
    { $group: { _id: null, cohort: { $sum: 1 }, returned: { $sum: { $cond: [{ $gte: ['$last', { $add: ['$first', RETURN_AFTER_DAYS * DAY_MS] }] }, 1, 0] } } } },
  ]);
  return { cohort: r?.cohort ?? 0, returned: r?.returned ?? 0, rate: rate(r?.returned ?? 0, r?.cohort ?? 0) };
}

/** Listing freshness (spec section 14): share of live listings updated in the last 30 days. */
async function freshness(now) {
  const since = new Date(now.getTime() - FRESH_DAYS * DAY_MS);
  const [businesses, offers, events] = await Promise.all([
    businessesService.freshness(since),
    offersService.freshness(since, now),
    eventsService.freshness(since, now),
  ]);
  const withRate = (x) => ({ ...x, rate: rate(x.fresh, x.total) });
  return { days: FRESH_DAYS, businesses: withRate(businesses), offers: withRate(offers), events: withRate(events) };
}

/**
 * Admin summary (spec: "counts by type and date range") plus the launch metrics
 * of spec section 14: totals per type and per IST day, distinct anonymous
 * devices, devices active in the last 7 days, searches leading to a contact,
 * event views and shares, 7-day retention and listing freshness.
 * Defaults to the last 7 days; at most 92 days.
 */
export async function summary({ from, to } = {}, now = new Date()) {
  const end = to ?? istToday(now);
  const start = from ?? shiftDate(end, -6);
  const days = Math.round((Date.parse(end) - Date.parse(start)) / DAY_MS) + 1;
  if (days > MAX_SUMMARY_DAYS) {
    throw AppError.validation(`Choose at most ${MAX_SUMMARY_DAYS} days.`, [{ field: 'query.from', message: `At most ${MAX_SUMMARY_DAYS} days` }]);
  }
  const startAt = istStartOfDay(start);
  const endAt = istEndOfDay(end);
  const match = { createdAt: { $gte: startAt, $lte: endAt } };
  const weekEnd = new Date(Math.min(endAt.getTime(), now.getTime()));
  const weekMatch = { createdAt: { $gte: new Date(weekEnd.getTime() - 7 * DAY_MS), $lte: weekEnd } };

  const [byDayType, sessions, activeWeek, eventViews, eventShares, search, retained, fresh] = await Promise.all([
    ActivityEvent.aggregate([
      { $match: match },
      { $group: { _id: { day: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt', timezone: TIMEZONE } }, type: '$type' }, n: { $sum: 1 } } },
    ]),
    ActivityEvent.distinct('sessionId', match),
    ActivityEvent.distinct('sessionId', weekMatch),
    ActivityEvent.countDocuments({ ...match, type: 'view', targetType: 'event' }),
    ActivityEvent.countDocuments({ ...match, type: 'share', targetType: 'event' }),
    searchToContact(match),
    retention(startAt, endAt, now),
    freshness(now),
  ]);
  const empty = () => Object.fromEntries(ACTIVITY_TYPES.map((t) => [t, 0]));
  const totals = empty();
  const byDay = new Map(Array.from({ length: days }, (_, i) => [shiftDate(start, i), empty()]));
  for (const row of byDayType) {
    totals[row._id.type] += row.n;
    byDay.get(row._id.day)[row._id.type] += row.n;
  }
  return {
    from: start,
    to: end,
    totals,
    sessions: sessions.length,
    byDay: [...byDay].map(([date, counts]) => ({ date, ...counts })),
    metrics: {
      activeDevices7d: activeWeek.length,
      searchToContact: search,
      events: { views: eventViews, shares: eventShares },
      retention7d: retained,
      freshness: fresh,
    },
  };
}
