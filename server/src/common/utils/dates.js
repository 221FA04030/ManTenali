/**
 * Date-only values ("YYYY-MM-DD") are interpreted in Tenali time (IST,
 * Asia/Kolkata, UTC+05:30, no daylight saving). Timestamps are stored in UTC.
 */
const IST_OFFSET_MS = (5 * 60 + 30) * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;
const DATE_RX = /^(\d{4})-(\d{2})-(\d{2})$/;

/** True for a real calendar date in YYYY-MM-DD form. */
export function isIsoDate(value) {
  const m = DATE_RX.exec(String(value ?? ''));
  if (!m) return false;
  const [y, mo, d] = m.slice(1).map(Number);
  const dt = new Date(Date.UTC(y, mo - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === mo - 1 && dt.getUTCDate() === d;
}

function utcMidnight(value) {
  const [y, mo, d] = DATE_RX.exec(value).slice(1).map(Number);
  return Date.UTC(y, mo - 1, d);
}

/** 00:00:00.000 IST on that date, as a UTC Date. */
export const istStartOfDay = (value) => new Date(utcMidnight(value) - IST_OFFSET_MS);

/** 23:59:59.999 IST on that date, as a UTC Date. */
export const istEndOfDay = (value) => new Date(utcMidnight(value) + DAY_MS - IST_OFFSET_MS - 1);

/** The IST calendar date ("YYYY-MM-DD") of a UTC instant. */
export function toIstDate(date) {
  if (!date) return null;
  return new Date(new Date(date).getTime() + IST_OFFSET_MS).toISOString().slice(0, 10);
}

/** Today's date in Tenali. */
export const istToday = (now = new Date()) => toIstDate(now);

/** Same calendar date one year later ("2026-03-15" -> "2027-03-15"; Feb 29 -> Mar 1). */
export function addOneYear(value) {
  const [y, mo, d] = DATE_RX.exec(value).slice(1).map(Number);
  return new Date(Date.UTC(y + 1, mo - 1, d)).toISOString().slice(0, 10);
}
