import {
  BedDouble,
  Briefcase,
  Bus,
  CalendarDays,
  GraduationCap,
  HeartPulse,
  House,
  Landmark,
  LayoutGrid,
  MessagesSquare,
  Newspaper,
  ShoppingBag,
  Store,
  TicketPercent,
  UtensilsCrossed,
  Wrench,
} from 'lucide-react';
import { isComingSoon } from './comingSoon.js';

/**
 * Home shortcuts. Each one opens real data: a page (`to`) or a main business
 * category (`categorySlug`, resolved to its id when categories load). Features
 * of later phases stay dimmed "Coming soon".
 */
export const HOME_TILES = [
  { key: 'food', labelKey: 'tiles.food', icon: UtensilsCrossed, to: '/food' },
  { key: 'shopping', labelKey: 'tiles.shopping', icon: ShoppingBag, categorySlug: 'shopping' },
  { key: 'healthMedical', labelKey: 'tiles.health', icon: HeartPulse, categorySlug: 'health-medical' },
  { key: 'educationCat', labelKey: 'tiles.education', icon: GraduationCap, categorySlug: 'education' },
  { key: 'services', labelKey: 'tiles.services', icon: Wrench, to: '/businesses?kind=service' },
  { key: 'hotels', labelKey: 'tiles.hotels', icon: BedDouble, categorySlug: 'hotels-stay' },
  { key: 'offers', labelKey: 'tiles.offers', icon: TicketPercent, to: '/offers' },
  { key: 'events', labelKey: 'tiles.events', icon: CalendarDays, to: '/events' },
  { key: 'news', labelKey: 'tiles.news', icon: Newspaper, to: '/news' },
  { key: 'community', labelKey: 'tiles.community', icon: MessagesSquare, to: '/community' },
  { key: 'busTracking', labelKey: 'tiles.bus', icon: Bus },
  { key: 'more', labelKey: 'tiles.more', icon: LayoutGrid, to: '/discover' },
].map((tile) => ({ ...tile, comingSoon: isComingSoon(tile.key) }));

/** Discover list: every section of the app; later-phase ones dimmed "Coming soon". */
export const EXPLORE_ROWS = [
  { key: 'shops', icon: Store, to: '/businesses' },
  { key: 'food', icon: UtensilsCrossed, to: '/food' },
  { key: 'offers', icon: TicketPercent, to: '/offers' },
  { key: 'news', icon: Newspaper, to: '/news' },
  { key: 'events', icon: CalendarDays, to: '/events' },
  { key: 'community', icon: MessagesSquare, to: '/community' },
  { key: 'health', icon: HeartPulse, categorySlug: 'health-medical' },
  { key: 'education', icon: GraduationCap, categorySlug: 'education' },
  { key: 'transport', icon: Bus },
  { key: 'publicServices', icon: Landmark },
  { key: 'realEstate', icon: House },
  { key: 'jobs', icon: Briefcase },
].map((row) => ({
  ...row,
  titleKey: `explore.${row.key}.title`,
  subtitleKey: `explore.${row.key}.subtitle`,
  comingSoon: isComingSoon(row.key),
}));
