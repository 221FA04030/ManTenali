import {
  Briefcase,
  Bus,
  CalendarDays,
  GraduationCap,
  HeartPulse,
  House,
  Landmark,
  MessagesSquare,
  Newspaper,
  Store,
  TicketPercent,
  UtensilsCrossed,
} from 'lucide-react';
import { isComingSoon } from './comingSoon.js';

/* Home's shortcuts are in config/features.js (the feature registry). */

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
