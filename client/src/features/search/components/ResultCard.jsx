import { BusinessListItem } from '../../businesses/components/BusinessListItem.jsx';
import { OfferCard } from '../../offers/components/OfferCard.jsx';
import { EventCard } from '../../events/components/EventCard.jsx';
import { NewsCard } from '../../news/components/NewsCard.jsx';

/** A search result rendered with the same card as its own list page. */
export function ResultCard({ type, item }) {
  if (type === 'business') return <BusinessListItem business={item} />;
  if (type === 'offer') return <OfferCard offer={item} />;
  if (type === 'event') return <EventCard event={item} />;
  return <NewsCard item={item} />;
}
