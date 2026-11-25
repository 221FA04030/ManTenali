/** Date-only helpers in Tenali time (IST, Asia/Kolkata). */
import { TIME_ZONE } from './format.js';

const DATE_RX = /^(\d{4})-(\d{2})-(\d{2})$/;
const DAY_MS = 86_400_000;

/** Today's date in Tenali as YYYY-MM-DD. */
export function istToday(now = new Date()) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: TIME_ZONE, year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);
}

export function isIsoDate(value) {
  const m = DATE_RX.exec(String(value ?? ''));
  if (!m) return false;
  const [y, mo, d] = m.slice(1).map(Number);
  const dt = new Date(Date.UTC(y, mo - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === mo - 1 && dt.getUTCDate() === d;
}

/** Same calendar date one year later. */
export function addOneYear(value) {
  const [y, mo, d] = DATE_RX.exec(value).slice(1).map(Number);
  return new Date(Date.UTC(y + 1, mo - 1, d)).toISOString().slice(0, 10);
}

/** Whole days between two YYYY-MM-DD dates (b - a). */
export function daysBetween(a, b) {
  const toUtc = (v) => {
    const [y, mo, d] = DATE_RX.exec(v).slice(1).map(Number);
    return Date.UTC(y, mo - 1, d);
  };
  return Math.round((toUtc(b) - toUtc(a)) / DAY_MS);
}

/** "Ends today" / "Ends tomorrow" / "Ends in N days" as an i18n key + count (IST calendar days). */
export function endsIn(validToDate, now = new Date()) {
  const days = daysBetween(istToday(now), validToDate);
  if (days <= 0) return { key: 'offers.endsToday', count: 0 };
  if (days === 1) return { key: 'offers.endsTomorrow', count: 1 };
  return { key: 'offers.endsInDays', count: days };
}

/** "25 Nov 2026" for a YYYY-MM-DD date (no timezone shift: it is already an IST date). */
export function formatIsoDate(value, lang = 'en') {
  if (!isIsoDate(value)) return '';
  const [y, mo, d] = DATE_RX.exec(value).slice(1).map(Number);
  return new Intl.DateTimeFormat(lang === 'te' ? 'te-IN' : 'en-IN', {
    timeZone: 'UTC',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(new Date(Date.UTC(y, mo - 1, d)));
}

/** "18:30" part of "YYYY-MM-DDTHH:mm" -> "6:30 pm" (already IST; no shift). */
export function formatLocalTime(local, lang = 'en') {
  const m = /T(\d{2}):(\d{2})$/.exec(String(local ?? ''));
  if (!m) return '';
  return new Intl.DateTimeFormat(lang === 'te' ? 'te-IN' : 'en-IN', { hour: 'numeric', minute: '2-digit', timeZone: 'UTC' }).format(
    new Date(Date.UTC(2023, 0, 1, Number(m[1]), Number(m[2]))),
  );
}

/** Current IST date-time as "YYYY-MM-DDTHH:mm" (for datetime-local inputs). */
export function istNowLocal(now = new Date()) {
  return new Date(now.getTime() + 330 * 60_000).toISOString().slice(0, 16);
}
