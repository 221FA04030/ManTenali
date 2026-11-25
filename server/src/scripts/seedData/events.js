/**
 * SAMPLE events for local development and demos only (never production).
 * Dates are relative to the day the seed runs; times are IST.
 */
export const EVENT_SEED = [
  {
    slug: 'sample-tenali-book-fair',
    title: 'Tenali Book Fair (Sample)',
    description: 'Books in Telugu and English, children’s corner and author talks. Sample event for demo purposes.',
    categorySlug: 'fairs-exhibitions',
    startsInDays: 3,
    startHourIst: 10,
    hours: 10,
    venue: { name: 'Municipal High School Grounds', address: 'Bose Road, Tenali', area: 'Bose Road' },
    lat: 16.2405,
    lng: 80.6462,
    priceInfo: 'Free entry',
    organizerName: 'Tenali Readers Club (Sample)',
  },
  {
    slug: 'sample-classical-music-evening',
    title: 'Classical Music Evening (Sample)',
    description: 'Carnatic vocal and veena recital. Sample event for demo purposes.',
    categorySlug: 'music-drama',
    startsInDays: 6,
    startHourIst: 18,
    hours: 3,
    venue: { name: 'Town Hall', address: 'Main Road, Tenali', area: 'Main Road' },
    lat: 16.2371,
    lng: 80.6449,
    priceInfo: '₹100 per ticket',
    bookingUrl: 'https://example.com/tickets',
    organizerName: 'Tenali Kala Parishad (Sample)',
  },
];
