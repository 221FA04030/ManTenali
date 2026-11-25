import { escapeRegex } from './validators.js';

/**
 * Text matching for search (Step 8, DECISIONS D8.2). No search server: MongoDB
 * regular expressions over a status-filtered, indexed candidate set.
 *
 * - Every query word must match the START of a word in one of the fields
 *   ("biry" finds "Biryani"; "ani" does not), case-insensitive, any script.
 * - A trailing plural "s" is ignored for words of 4+ letters ("sweets" -> "sweet").
 * - Fuzzy mode (used only when nothing matched) also accepts ONE typo per word
 *   of 4+ characters: a wrong, missing, extra or swapped character.
 */
export const MAX_TOKENS = 5;
export const MIN_FUZZY_LENGTH = 4;

// Word separators. Kept to plain characters (no Unicode classes) so the same
// pattern behaves identically in MongoDB (PCRE) and in JavaScript.
const WORD_START = "(?:^|[\\s\\-/&,.()'\"+:;_|])";

/** Lower-cased, de-duplicated words of a query (at most MAX_TOKENS). */
export function tokenize(q) {
  const words = String(q ?? '')
    .normalize('NFC')
    .toLowerCase()
    .split(/[\s,;/]+/)
    .map((w) => w.replace(/^[-'".()&+:_|!?]+|[-'".()&+:_|!?]+$/g, ''))
    .filter(Boolean);
  return [...new Set(words)].slice(0, MAX_TOKENS);
}

const stem = (t) => (t.length >= MIN_FUZZY_LENGTH + 1 && /[a-z]s$/.test(t) ? t.slice(0, -1) : t);

/** One-edit variants of a word as a regex alternation (substitution/deletion, insertion, swap). */
function oneEditAlternation(word) {
  const chars = [...word];
  const piece = (arr) => arr.map(escapeRegex).join('');
  const alts = new Set();
  for (let i = 0; i < chars.length; i += 1) {
    alts.add(`${piece(chars.slice(0, i))}.?${piece(chars.slice(i + 1))}`); // wrong or missing char i
    alts.add(`${piece(chars.slice(0, i))}.${piece(chars.slice(i))}`); // extra char before i
    if (i < chars.length - 1) {
      const swapped = [...chars];
      [swapped[i], swapped[i + 1]] = [swapped[i + 1], swapped[i]];
      alts.add(piece(swapped)); // swapped neighbours
    }
  }
  return [...alts].join('|');
}

/** Regex source matching one query word at a word start. */
export function tokenPattern(token, { fuzzy = false } = {}) {
  const word = stem(token);
  if (fuzzy && [...word].length >= MIN_FUZZY_LENGTH) return `${WORD_START}(?:${oneEditAlternation(word)})`;
  return `${WORD_START}${escapeRegex(word)}`;
}

/** True when the query has at least one word long enough for typo tolerance. */
export const canBeFuzzy = (tokens) => tokens.some((t) => [...stem(t)].length >= MIN_FUZZY_LENGTH);

/**
 * MongoDB filter: every token matches at a word start in at least one field.
 * `alsoMatch` (e.g. { categoryId: { $in: ids } }) is an alternative way for the
 * WHOLE query to match (a category whose name matches every word).
 */
export function matchFilter(tokens, fields, { fuzzy = false, alsoMatch = [] } = {}) {
  const textMatch = {
    $and: tokens.map((t) => {
      const regex = { $regex: tokenPattern(t, { fuzzy }), $options: 'i' };
      return { $or: fields.map((f) => ({ [f]: regex })) };
    }),
  };
  return alsoMatch.length ? { $or: [textMatch, ...alsoMatch] } : textMatch;
}

/**
 * Relevance of one document. `primary` is the name/title, `secondary` the other
 * searchable text. Per word: 3 for the title, 1 for other fields; +4 when the
 * title starts with the whole query; +1 when matched through its category.
 */
export function relevance(tokens, { primary = '', secondary = [], categoryMatch = false }, { fuzzy = false, query = '' } = {}) {
  const title = String(primary ?? '');
  const rest = secondary.filter(Boolean).map(String).join(' \n ');
  let score = 0;
  for (const t of tokens) {
    const rx = new RegExp(tokenPattern(t, { fuzzy }), 'i');
    if (rx.test(title)) score += 3;
    else if (rx.test(rest)) score += 1;
  }
  if (query && title.toLowerCase().startsWith(query.trim().toLowerCase())) score += 4;
  if (categoryMatch) score += 1;
  return score;
}

/** Most candidates ranked per type; a narrower query is needed beyond this. */
export const CANDIDATE_LIMIT = 200;

/** Sort ranked candidates and cut one page. `distance` sorts by distanceM (missing last). */
export function rankPage(rows, { page = 1, limit = 20, byDistance = false }) {
  const sorted = [...rows].sort((a, b) => {
    if (byDistance) {
      const da = a.distanceM ?? Number.POSITIVE_INFINITY;
      const db = b.distanceM ?? Number.POSITIVE_INFINITY;
      if (da !== db) return da - db;
    }
    return b.score - a.score || a.order - b.order;
  });
  const start = (page - 1) * limit;
  return { page: sorted.slice(start, start + limit), total: rows.length, capped: rows.length >= CANDIDATE_LIMIT };
}
