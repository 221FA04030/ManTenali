import * as businessesService from '../businesses/businesses.service.js';
import * as offersService from '../offers/offers.service.js';
import * as eventsService from '../events/events.service.js';
import * as newsService from '../news/news.service.js';
import * as communityService from '../community/community.service.js';

export const HOME_LIMITS = Object.freeze({ banner: 5, bannerNews: 3, notices: 4, nearby: 3, offers: 4, events: 3, news: 3, food: 4, featured: 4, community: 3 });
const NEAR_ME_KM = 10;

/**
 * Banner (spec section 11): up to 5 items - pinned news first (at most 3, so
 * events and offers still get a place), then next events and offers ending
 * soonest, alternating, until 5.
 */
export function composeBanner(pinned, events, offers, max = HOME_LIMITS.banner) {
  const items = pinned.slice(0, HOME_LIMITS.bannerNews).map((item) => ({ type: 'news', item }));
  const rest = [];
  for (let i = 0; i < Math.max(events.length, offers.length); i += 1) {
    if (events[i]) rest.push({ type: 'event', item: events[i] });
    if (offers[i]) rest.push({ type: 'offer', item: offers[i] });
  }
  // If there are too few events and offers, more pinned news fills the gap.
  const extraNews = pinned.slice(HOME_LIMITS.bannerNews).map((item) => ({ type: 'news', item }));
  return [...items, ...rest, ...extraNews].slice(0, max);
}

/** Nearby businesses: near me (distance) -> chosen area -> all of Tenali, falling back when empty. */
async function nearbyBusinesses({ lat, lng, radiusKm, area }, now) {
  const base = { page: 1, limit: HOME_LIMITS.nearby };
  if (lat !== undefined && lng !== undefined) {
    const near = await businessesService.listPublic({ ...base, lat, lng, radiusKm: radiusKm ?? NEAR_ME_KM, sort: 'distance' }, now);
    if (near.items.length) return { mode: 'near', items: near.items };
  } else if (area) {
    const inArea = await businessesService.listPublic({ ...base, area }, now);
    if (inArea.items.length) return { mode: 'area', area, items: inArea.items };
  }
  const all = await businessesService.listPublic({ ...base, sort: 'rating' }, now);
  return { mode: 'all', items: all.items };
}

/**
 * GET /home: the Home screen in one request, composed from module services
 * (each applies its own public rules: published, valid, not expired).
 * `viewer` (optional) only marks which community posts they have liked.
 */
export async function getFeed(query = {}, now = new Date(), viewer = null) {
  const [pinned, nextEvents, endingSoon, notices, nearby, events, news, food, featured, community] = await Promise.all([
    newsService.listPinned(HOME_LIMITS.banner, now),
    eventsService.nextUpcoming(HOME_LIMITS.banner, now),
    offersService.listPublic({ page: 1, limit: HOME_LIMITS.banner, sort: 'endingSoon' }, now),
    newsService.latestNotices(HOME_LIMITS.notices, now),
    nearbyBusinesses(query, now),
    eventsService.listPublic({ page: 1, limit: HOME_LIMITS.events }, now),
    newsService.listPublic({ page: 1, limit: HOME_LIMITS.news, type: 'news' }, now),
    businessesService.listPublic({ page: 1, limit: HOME_LIMITS.food, kind: 'food', sort: 'rating' }, now),
    businessesService.listPublic({ page: 1, limit: HOME_LIMITS.featured, isVerified: true, sort: 'rating' }, now),
    communityService.latest(HOME_LIMITS.community, viewer),
  ]);
  return {
    banner: composeBanner(pinned, nextEvents, endingSoon.items),
    today: { notices, nextEvent: nextEvents[0] ?? null },
    nearby,
    offers: endingSoon.items.slice(0, HOME_LIMITS.offers),
    events: events.items,
    news: news.items,
    // Highest-rated food places; verified businesses; the newest community posts.
    food: food.items,
    featured: featured.items,
    community,
  };
}
