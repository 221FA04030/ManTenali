import {
  Newspaper,
  Store,
  UtensilsCrossed,
  Bus,
  CalendarDays,
  Briefcase,
  Wrench,
  LayoutGrid,
  Landmark,
  Hospital,
  GraduationCap,
  House,
  TicketPercent,
} from 'lucide-react';
import { isComingSoon } from './comingSoon.js';

/** Home tile grid - same order as the UI reference. */
export const HOME_TILES = [
  { key: 'news', labelKey: 'tiles.news', icon: Newspaper, to: '/news' },
  { key: 'shops', labelKey: 'tiles.shops', icon: Store, to: '/businesses' },
  { key: 'food', labelKey: 'tiles.food', icon: UtensilsCrossed, to: '/food' },
  { key: 'busTracking', labelKey: 'tiles.bus', icon: Bus },
  { key: 'events', labelKey: 'tiles.events', icon: CalendarDays, to: '/events' },
  { key: 'jobs', labelKey: 'tiles.jobs', icon: Briefcase },
  { key: 'services', labelKey: 'tiles.services', icon: Wrench, to: '/businesses?kind=service' },
  { key: 'more', labelKey: 'tiles.more', icon: LayoutGrid, to: '/explore' },
].map((tile) => ({ ...tile, comingSoon: isComingSoon(tile.key) }));

/** Explore list - reference rows plus the Phase 1 News and Offers rows. */
export const EXPLORE_ROWS = [
  { key: 'shops', icon: Store, to: '/businesses' },
  { key: 'food', icon: UtensilsCrossed, to: '/food' },
  { key: 'offers', icon: TicketPercent, to: '/offers' },
  { key: 'news', icon: Newspaper, to: '/news' },
  { key: 'events', icon: CalendarDays, to: '/events' },
  { key: 'transport', icon: Bus },
  { key: 'publicServices', icon: Landmark },
  { key: 'health', icon: Hospital },
  { key: 'education', icon: GraduationCap },
  { key: 'realEstate', icon: House },
  { key: 'jobs', icon: Briefcase },
].map((row) => ({
  ...row,
  titleKey: `explore.${row.key}.title`,
  subtitleKey: `explore.${row.key}.subtitle`,
  comingSoon: isComingSoon(row.key),
}));
