import {
  BookOpen,
  Cake,
  Coffee,
  CupSoda,
  Gem,
  GraduationCap,
  Hammer,
  Landmark,
  Music,
  Plug,
  Scissors,
  Shirt,
  ShoppingBasket,
  Smartphone,
  Sparkles,
  Store,
  Tag,
  Tent,
  Trophy,
  Users,
  UtensilsCrossed,
  Wrench,
} from 'lucide-react';

/** Map of category icon keys (stored on the server) to icons. */
const ICONS = {
  'book-open': BookOpen,
  cake: Cake,
  coffee: Coffee,
  'cup-soda': CupSoda,
  gem: Gem,
  'graduation-cap': GraduationCap,
  hammer: Hammer,
  landmark: Landmark,
  music: Music,
  plug: Plug,
  scissors: Scissors,
  shirt: Shirt,
  'shopping-basket': ShoppingBasket,
  smartphone: Smartphone,
  sparkles: Sparkles,
  store: Store,
  tent: Tent,
  trophy: Trophy,
  users: Users,
  utensils: UtensilsCrossed,
  wrench: Wrench,
};

export const CATEGORY_ICON_KEYS = Object.keys(ICONS);

export function categoryIcon(key) {
  return ICONS[key] ?? Tag;
}
