import {
  BedDouble,
  CalendarDays,
  GraduationCap,
  HeartPulse,
  Newspaper,
  Settings,
  ShoppingBag,
  Store,
  Ticket,
  Users,
  UtensilsCrossed,
} from 'lucide-react';
import { isComingSoon } from './comingSoon.js';

/**
 * Home feature registry: every feature Home can offer as a shortcut, in one
 * place. Each entry has its name and description (i18n keys), icon, colours,
 * where it opens (`to`, or `categorySlug` for a main business category,
 * resolved to its id when categories load) and the pages that count as using
 * it (`listing` / `detail`, used by the engagement tracker).
 *
 * The array order is the balanced default ranking first-time visitors see: a
 * mix of places, deals, news and people, not one fixed list for everyone after
 * that (see ENGAGEMENT below).
 */
const TINTS = {
  mint: { bg: '#EAF5ED', fg: '#218447' },
  sage: { bg: '#EEF4E3', fg: '#4D7228' },
  cream: { bg: '#FBF4E4', fg: '#9A6A12' },
  aqua: { bg: '#E5F3EF', fg: '#1D7461' },
  stone: { bg: '#F1F3EF', fg: '#3F5A47' },
};

const BUSINESS_DETAIL = /^\/businesses\/(?!new$)[^/]+$/;

export const HOME_FEATURES = [
  { key: 'food', labelKey: 'tiles.food', icon: UtensilsCrossed, to: '/food', tint: TINTS.cream, listing: { path: '/food' }, businessDetail: true },
  { key: 'offers', labelKey: 'tiles.offers', icon: Ticket, to: '/offers', tint: TINTS.mint, listing: { path: '/offers' }, detail: /^\/offers\/[^/]+$/ },
  { key: 'news', labelKey: 'tiles.news', icon: Newspaper, to: '/news', tint: TINTS.aqua, listing: { path: '/news' }, detail: /^\/news\/[^/]+$/ },
  { key: 'events', labelKey: 'tiles.events', icon: CalendarDays, to: '/events', tint: TINTS.sage, listing: { path: '/events' }, detail: /^\/events\/(?!submit$|submissions)[^/]+$/ },
  { key: 'shopping', labelKey: 'tiles.shopping', icon: ShoppingBag, categorySlug: 'shopping', tint: TINTS.mint, businessDetail: true },
  { key: 'healthMedical', labelKey: 'tiles.health', icon: HeartPulse, categorySlug: 'health-medical', tint: TINTS.aqua, businessDetail: true },
  { key: 'community', labelKey: 'tiles.community', icon: Users, to: '/community', tint: TINTS.sage, listing: { path: '/community' }, detail: /^\/community\/(?!new$)[^/]+$/ },
  { key: 'services', labelKey: 'tiles.services', icon: Settings, to: '/businesses?kind=service', tint: TINTS.stone, listing: { path: '/businesses', params: { kind: 'service' } }, businessDetail: true },
  { key: 'educationCat', labelKey: 'tiles.education', icon: GraduationCap, categorySlug: 'education', tint: TINTS.cream, businessDetail: true },
  { key: 'hotels', labelKey: 'tiles.hotels', icon: BedDouble, categorySlug: 'hotels-stay', tint: TINTS.sage, businessDetail: true },
  { key: 'businesses', labelKey: 'tiles.businesses', icon: Store, to: '/businesses', tint: TINTS.stone, listing: { path: '/businesses', params: {} }, businessDetail: true },
].map((f, i) => ({ ...f, descKey: `features.desc.${f.key}`, defaultRank: i, comingSoon: isComingSoon(f.key) }));

export const HOME_FEATURE_KEYS = new Set(HOME_FEATURES.map((f) => f.key));
export { BUSINESS_DETAIL };

/**
 * Engagement scoring for the personalised shortcut order. All weights and
 * timings live here.
 */
export const ENGAGEMENT = {
  /** Shortcuts shown on Home before the More Features tile. */
  visibleCount: 8,
  weights: {
    open: 1, // opening a feature (its main list)
    action: 2, // opening an item in it, liking, commenting
    return: 3, // first use of a feature in a new session, after using it before
  },
  /** Scores halve every this many days, so the order follows changing interests. */
  halfLifeDays: 14,
  /**
   * The default order counts as a small head start (the first default feature
   * gets this many points, the last almost none), so one tap never reshuffles
   * Home: a feature has to be used a few times to move up.
   */
  defaultHeadStart: 5,
  /** Opening the same feature again within this time is not counted (double taps, back and forth). */
  repeatOpenMs: 30_000,
  /** A new session starts after this long without using the app. */
  sessionIdleMs: 30 * 60_000,
  /** The Home order is kept for the session; it is recalculated after this long at the latest. */
  reorderAfterMs: 30 * 60_000,
  /** Signed-in users' scores are saved to their account this long after the last change. */
  syncDelayMs: 4_000,
  maxScore: 1000,
};
