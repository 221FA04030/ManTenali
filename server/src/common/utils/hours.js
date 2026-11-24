import { TIMEZONE } from '../../config/constants.js';

/**
 * Opening hours are stored as local Tenali time strings ("HH:MM", 24h) per
 * weekday (0 = Sunday). "Now" is always evaluated in IST, whatever the server
 * timezone is. A slot whose close time is not after its open time runs past
 * midnight (e.g. 18:00-01:00); the model stores that as `overnight: true`.
 */
const dayIndex = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };

export function istNow(date = new Date()) {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: TIMEZONE,
    weekday: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(date);
  const get = (type) => parts.find((p) => p.type === type)?.value;
  return { day: dayIndex[get('weekday')], time: `${get('hour')}:${get('minute')}` };
}

const prevDay = (d) => (d + 6) % 7;

export const isOvernight = (slot) => Boolean(slot?.open && slot?.close && slot.close <= slot.open);

/** True when a slot covers `time` on `day`, including the part after midnight. */
function slotOpen(slot, day, time) {
  if (slot.closed || !slot.open || !slot.close) return false;
  const overnight = isOvernight(slot);
  if (slot.day === day) return overnight ? time >= slot.open : time >= slot.open && time < slot.close;
  if (overnight && slot.day === prevDay(day)) return time < slot.close;
  return false;
}

/** Returns true / false, or null when no hours are listed. */
export function isOpenAt(hours, date = new Date()) {
  if (!Array.isArray(hours) || hours.length === 0) return null;
  const { day, time } = istNow(date);
  return hours.some((slot) => slotOpen(slot, day, time));
}

/** Mongo filter matching businesses open at `date` (mirrors isOpenAt). */
export function openNowFilter(date = new Date()) {
  const { day, time } = istNow(date);
  return {
    openingHours: {
      $elemMatch: {
        closed: { $ne: true },
        $or: [
          { day, overnight: { $ne: true }, open: { $lte: time }, close: { $gt: time } },
          { day, overnight: true, open: { $lte: time } },
          { day: prevDay(day), overnight: true, close: { $gt: time } },
        ],
      },
    },
  };
}
