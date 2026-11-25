import * as businessesService from '../businesses/businesses.service.js';
import * as offersService from '../offers/offers.service.js';
import * as eventsService from '../events/events.service.js';
import * as newsService from '../news/news.service.js';
import * as categoriesService from '../categories/categories.service.js';
import { AppError } from '../../common/errors/index.js';
import { buildMeta } from '../../common/utils/pagination.js';
import { tokenize, canBeFuzzy } from '../../common/utils/textSearch.js';

/** Results shown per type on the "All" tab. */
export const PREVIEW_LIMIT = 5;
const TYPES = ['business', 'offer', 'event', 'news'];

/**
 * Each module searches its own data with its own public rules (module
 * boundaries: this module never touches another module's model).
 */
async function runAll(tokens, params, fuzzy, now) {
  const [businessCats, eventCats, newsCats] = await Promise.all([
    categoriesService.findMatching('business', tokens, { fuzzy }),
    categoriesService.findMatching('event', tokens, { fuzzy }),
    categoriesService.findMatching('news', tokens, { fuzzy }),
  ]);
  const ids = (list) => list.map((c) => c.id);
  const common = { tokens, fuzzy, query: params.q, area: params.area, lat: params.lat, lng: params.lng, radiusKm: params.radiusKm, sort: params.sort };
  const paging = (type) =>
    params.type === 'all' ? { page: 1, limit: PREVIEW_LIMIT } : params.type === type ? { page: params.page, limit: params.limit } : { page: 1, limit: 1 };
  const [business, offer, event, news] = await Promise.all([
    businessesService.searchPublic({ ...common, categoryIds: ids(businessCats), ...paging('business') }, now),
    offersService.searchPublic({ ...common, ...paging('offer') }, now),
    eventsService.searchPublic({ ...common, categoryIds: ids(eventCats), ...paging('event') }, now),
    newsService.searchPublic({ ...common, categoryIds: ids(newsCats), ...paging('news') }, now),
  ]);
  return { business, offer, event, news };
}

/**
 * FR-SRCH-1/2: one query across businesses, offers, events and news, grouped
 * by type with counts. `type=all` returns up to PREVIEW_LIMIT per type; a
 * single type returns one page of that type (meta). When nothing matches,
 * the search is repeated allowing one typo per word (`fuzzy: true`).
 */
export async function search(params, now = new Date()) {
  const tokens = tokenize(params.q);
  if (!tokens.length) throw AppError.validation('Type something to search for.', [{ field: 'query.q', message: 'Type at least 2 characters' }]);
  let fuzzy = false;
  let results = await runAll(tokens, params, false, now);
  const totalOf = (r) => TYPES.reduce((n, t) => n + r[t].total, 0);
  if (totalOf(results) === 0 && canBeFuzzy(tokens)) {
    fuzzy = true;
    results = await runAll(tokens, params, true, now);
  }
  const counts = Object.fromEntries(TYPES.map((t) => [t, results[t].total]));
  counts.all = totalOf(results);
  const shown = params.type === 'all' ? TYPES : [params.type];
  const data = {
    query: params.q,
    type: params.type,
    fuzzy,
    counts,
    groups: Object.fromEntries(shown.map((t) => [t, results[t].items])),
  };
  if (params.type === 'all') return { data };
  const { total, capped } = results[params.type];
  return { data, meta: { ...buildMeta({ page: params.page, limit: params.limit, total }), capped } };
}

/** FR-SRCH-3: business names and business category names for autocomplete. */
export async function suggest(q) {
  const tokens = tokenize(q);
  if (!tokens.length) return { businesses: [], categories: [] };
  const [businesses, categories] = await Promise.all([
    businessesService.suggestNames(tokens, { limit: 5 }),
    categoriesService.findMatching('business', tokens, { limit: 5 }),
  ]);
  return { businesses, categories };
}
