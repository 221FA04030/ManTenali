import { BusinessRow } from '../../businesses/components/BusinessTiles.jsx';
import { OfferCard } from '../../offers/components/OfferCard.jsx';
import { EventCard } from '../../events/components/EventCard.jsx';
import { NewsCard } from '../../news/components/NewsCard.jsx';

/** A search result rendered the same way as on its own list page. */
export function ResultCard({ type, item }) {
  if (type === 'business')
    return (
      <div className="border-b border-gray-100">
        <BusinessRow business={item} />
      </div>
    );
  if (type === 'offer')
    return (
      <div className="border-b border-gray-100">
        <OfferCard offer={item} />
      </div>
    );
  if (type === 'event') return <EventCard event={item} />;
  return <NewsCard item={item} />;
}
