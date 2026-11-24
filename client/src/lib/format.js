/** Formatting helpers. All times are stored in UTC and displayed in IST. */
export const TIME_ZONE = 'Asia/Kolkata';

const localeFor = (lang) => (lang === 'te' ? 'te-IN' : 'en-IN');

export function formatDate(value, lang = 'en', options = {}) {
  if (!value) return '';
  return new Intl.DateTimeFormat(localeFor(lang), {
    timeZone: TIME_ZONE,
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    ...options,
  }).format(new Date(value));
}

export function formatDateTime(value, lang = 'en') {
  return formatDate(value, lang, { hour: 'numeric', minute: '2-digit' });
}

export function formatTime(value, lang = 'en') {
  if (!value) return '';
  return new Intl.DateTimeFormat(localeFor(lang), {
    timeZone: TIME_ZONE,
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(value));
}

export function formatINR(amount, lang = 'en') {
  if (amount === undefined || amount === null || Number.isNaN(Number(amount))) return '';
  return new Intl.NumberFormat(localeFor(lang), {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: Number(amount) % 1 === 0 ? 0 : 2,
  }).format(Number(amount));
}

/** "5 min ago", "2 days ago" - used for last-updated times on cards. */
export function formatRelative(value, lang = 'en', now = Date.now()) {
  if (!value) return '';
  const diffS = Math.round((new Date(value).getTime() - now) / 1000);
  const rtf = new Intl.RelativeTimeFormat(localeFor(lang), { numeric: 'auto' });
  const abs = Math.abs(diffS);
  if (abs < 60) return rtf.format(diffS, 'second');
  if (abs < 3600) return rtf.format(Math.round(diffS / 60), 'minute');
  if (abs < 86400) return rtf.format(Math.round(diffS / 3600), 'hour');
  if (abs < 86400 * 30) return rtf.format(Math.round(diffS / 86400), 'day');
  return formatDate(value, lang);
}

/** Distance in metres -> "350 m" / "2.4 km". */
export function formatDistance(meters) {
  if (meters === undefined || meters === null) return '';
  if (meters < 1000) return `${Math.round(meters / 10) * 10} m`;
  return `${(meters / 1000).toFixed(meters < 10_000 ? 1 : 0)} km`;
}
