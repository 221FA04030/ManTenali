/**
 * Pure scoring for the personalised Home shortcuts (no storage, no React), so
 * it is easy to test. `features` is { [featureKey]: { score, updatedAt, lastSession } }.
 */
const DAY_MS = 86_400_000;

/** The entry's score decayed to `now` (it halves every `halfLifeDays`). */
export function decayed(entry, now, cfg) {
  if (!entry) return 0;
  const age = Math.max(0, now - Date.parse(entry.updatedAt));
  return entry.score * 0.5 ** (age / (cfg.halfLifeDays * DAY_MS));
}

const round = (n) => Math.round(n * 100) / 100;

/**
 * Apply one meaningful interaction. type: 'open' (+open) or 'action' (+action).
 * The first use of a feature in a new session, when it was used in an earlier
 * one, also earns the return bonus.
 */
export function applyEvent(features, { feature, type, sessionId, now }, cfg) {
  const prev = features[feature];
  let add = type === 'action' ? cfg.weights.action : cfg.weights.open;
  if (prev?.lastSession && prev.lastSession !== sessionId) add += cfg.weights.return;
  const score = Math.min(cfg.maxScore, round(decayed(prev, now, cfg) + add));
  return { ...features, [feature]: { score, updatedAt: new Date(now).toISOString(), lastSession: sessionId } };
}

const newer = (a, b) => (!a ? b : !b ? a : Date.parse(b.updatedAt) > Date.parse(a.updatedAt) ? b : a);

/** Same scores seen from two places (cache and account): per feature, the newest entry wins. */
export function mergeLatest(a = {}, b = {}) {
  const out = { ...a };
  for (const [key, entry] of Object.entries(b)) out[key] = newer(out[key], entry);
  return out;
}

/** Different usage added together (signed-out use joining the account after login). */
export function mergeAdd(base = {}, extra = {}, now, cfg) {
  const out = { ...base };
  for (const [key, entry] of Object.entries(extra)) {
    const score = Math.min(cfg.maxScore, round(decayed(base[key], now, cfg) + decayed(entry, now, cfg)));
    out[key] = { score, updatedAt: new Date(now).toISOString(), lastSession: newer(base[key], entry).lastSession ?? null };
  }
  return out;
}

/** Feature keys, most used first; the default order is a small head start and breaks ties. */
export function rankFeatures(registry, features, now, cfg) {
  const n = registry.length;
  const value = (f) => decayed(features[f.key], now, cfg) + (cfg.defaultHeadStart * (n - f.defaultRank)) / n;
  return [...registry].sort((a, b) => value(b) - value(a) || a.defaultRank - b.defaultRank).map((f) => f.key);
}
