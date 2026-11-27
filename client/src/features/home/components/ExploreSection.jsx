import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { CalendarDays, ChefHat, MapPin, Store } from 'lucide-react';
import { ComingSoonBadge } from '../../../components/ui/Badge.jsx';

/**
 * "Explore Tenali" (DOCS/refrence.jpeg). Each tile opens a real list; "Places to
 * visit" has no data source yet, so it stays dimmed "Coming soon". There are no
 * photos for these tiles yet (see IMAGES.md): they use a green background.
 */
const TILES = [
  { key: 'businesses', icon: Store, to: '/businesses' },
  { key: 'restaurants', icon: ChefHat, to: '/food' },
  { key: 'places', icon: MapPin },
  { key: 'events', icon: CalendarDays, to: '/events' },
];

const tileBase = 'explore-tile relative flex h-[clamp(4.5rem,17vw,5.5rem)] w-[clamp(6rem,23.6vw,8.25rem)] shrink-0 snap-start overflow-hidden rounded-2xl bg-[linear-gradient(135deg,#1E7B3A_0%,#2E9A50_100%)]';

function TileContent({ icon: Icon, label }) {
  return (
    <>
      <Icon aria-hidden="true" className="absolute -right-3 -top-3 h-16 w-16 text-white/15" strokeWidth={1.5} />
      <span aria-hidden="true" className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent" />
      <span className="explore-label absolute bottom-2 left-2.5 right-2 flex items-center gap-1.5 text-white">
        <Icon className="h-[clamp(1rem,4vw,1.25rem)] w-[clamp(1rem,4vw,1.25rem)] shrink-0" strokeWidth={1.75} aria-hidden="true" />
        <span className="line-clamp-2 min-w-0 text-[clamp(0.6875rem,2.6vw,0.875rem)] font-semibold leading-tight">{label}</span>
      </span>
    </>
  );
}

export function ExploreSection() {
  const { t } = useTranslation();
  return (
    <section aria-labelledby="home-explore-title" className="px-4">
      <h2 id="home-explore-title" className="text-[19px] font-bold leading-snug text-heading">
        {t('home.exploreTitle')}
      </h2>
      <ul className="no-scrollbar -mr-4 mt-3 flex snap-x snap-mandatory gap-3 overflow-x-auto pb-2 pr-4 pt-2">
        {TILES.map((tile) => (
          <li key={tile.key} className="shrink-0">
            {tile.to ? (
              <Link to={tile.to} className={`${tileBase} transition-transform hover:-translate-y-0.5 active:scale-[0.98]`}>
                <TileContent icon={tile.icon} label={t(`home.explore.${tile.key}`)} />
              </Link>
            ) : (
              <div className={`${tileBase} opacity-70 grayscale-[0.4]`} aria-disabled="true" data-coming-soon="true">
                <TileContent icon={tile.icon} label={t(`home.explore.${tile.key}`)} />
                <ComingSoonBadge short className="absolute right-2 top-2" />
              </div>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
