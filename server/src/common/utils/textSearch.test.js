import { describe, it, expect } from 'vitest';
import { tokenize, tokenPattern, canBeFuzzy, relevance, rankPage, CANDIDATE_LIMIT } from './textSearch.js';

const matches = (token, text, fuzzy = false) => new RegExp(tokenPattern(token, { fuzzy }), 'i').test(text);

describe('text search helpers', () => {
  it('tokenizes: lower case, trims punctuation, de-duplicates, at most 5 words', () => {
    expect(tokenize('  Biryani, HOUSE  biryani! ')).toEqual(['biryani', 'house']);
    expect(tokenize('"tiffin" (centre)')).toEqual(['tiffin', 'centre']);
    expect(tokenize('a b c d e f g')).toHaveLength(5);
    expect(tokenize('తెనాలి  స్వీట్స్')).toEqual(['తెనాలి', 'స్వీట్స్']);
    expect(tokenize('  ')).toEqual([]);
  });

  it('matches at the start of a word, any case, and ignores a plural "s"', () => {
    expect(matches('biry', 'Paradise Biryani House')).toBe(true);
    expect(matches('ani', 'Paradise Biryani House')).toBe(false); // not mid-word
    expect(matches('sweets', 'Sri Lakshmi Sweet Stall')).toBe(true);
    expect(matches('tiffin', 'Ganesh Tiffin-Centre')).toBe(true);
    expect(matches('centre', 'Ganesh Tiffin-Centre')).toBe(true);
    expect(matches('తెనా', 'మన తెనాలి స్వీట్స్')).toBe(true);
  });

  it('escapes regex characters in the query', () => {
    expect(matches('.*', 'anything at all')).toBe(false);
    expect(matches('c++', 'Learn C++ classes')).toBe(true);
    expect(matches('(x', 'a (x) b')).toBe(true);
  });

  it('fuzzy mode accepts one typo (wrong, missing, extra or swapped character) for words of 4+ letters', () => {
    expect(matches('biriyani', 'Biryani House')).toBe(false);
    expect(matches('biriyani', 'Biryani House', true)).toBe(true); // extra letter
    expect(matches('biryni', 'Biryani House', true)).toBe(true); // missing letter
    expect(matches('biryabi', 'Biryani House', true)).toBe(true); // wrong letter
    expect(matches('biyrani', 'Biryani House', true)).toBe(true); // swapped letters
    expect(matches('bxyxani', 'Biryani House', true)).toBe(false); // two typos
    expect(matches('tea', 'Tez Stall', true)).toBe(false); // short words stay exact
    expect(canBeFuzzy(['tea', 'biry'])).toBe(true);
    expect(canBeFuzzy(['tea', 'ab'])).toBe(false);
  });

  it('ranks title matches above other fields and whole-query title prefixes highest', () => {
    const tokens = ['biryani'];
    const title = relevance(tokens, { primary: 'Biryani Point', secondary: [] }, { query: 'biryani' });
    const mid = relevance(tokens, { primary: 'Paradise Biryani', secondary: [] }, { query: 'biryani' });
    const tag = relevance(tokens, { primary: 'Paradise', secondary: ['biryani', 'meals'] }, { query: 'biryani' });
    expect(title).toBeGreaterThan(mid);
    expect(mid).toBeGreaterThan(tag);
    expect(relevance(tokens, { primary: 'x', secondary: [], categoryMatch: true })).toBe(1);
  });

  it('pages ranked rows by score (stable by natural order) or by distance', () => {
    const rows = [
      { id: 'a', score: 1, order: 0, distanceM: 50 },
      { id: 'b', score: 5, order: 1, distanceM: 900 },
      { id: 'c', score: 5, order: 2 },
      { id: 'd', score: 3, order: 3, distanceM: 10 },
    ];
    expect(rankPage(rows, { page: 1, limit: 3 }).page.map((r) => r.id)).toEqual(['b', 'c', 'd']);
    expect(rankPage(rows, { page: 2, limit: 3 }).page.map((r) => r.id)).toEqual(['a']);
    expect(rankPage(rows, { page: 1, limit: 4, byDistance: true }).page.map((r) => r.id)).toEqual(['d', 'a', 'b', 'c']);
    expect(rankPage(rows, { limit: 2 })).toMatchObject({ total: 4, capped: false });
    expect(rankPage(Array.from({ length: CANDIDATE_LIMIT }, (_, i) => ({ score: 0, order: i })), { limit: 1 }).capped).toBe(true);
  });
});
