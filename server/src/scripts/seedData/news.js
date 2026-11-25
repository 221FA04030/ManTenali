/**
 * SAMPLE news and notices for local development and demos only (never production).
 * Times are relative to when the seed runs. Sources are fictional.
 */
export const NEWS_SEED = [
  {
    slug: 'sample-power-shutdown-kothapeta',
    title: 'Planned power shutdown in Kothapeta (Sample)',
    summary: 'Supply will be off from 10 am to 2 pm for line maintenance. Sample notice for demo purposes.',
    body: 'Areas affected: Kothapeta main road and nearby lanes.\nSample notice for demo purposes.',
    type: 'power',
    categorySlug: 'civic',
    sourceName: 'Electricity sub-division office (Sample)',
    publishedHoursAgo: 2,
    validForHours: 30,
    isPinned: true,
  },
  {
    slug: 'sample-road-work-bose-road',
    title: 'Road work on Bose Road - expect delays (Sample)',
    summary: 'One lane closed near the clock tower this week. Use Main Road where possible. Sample notice.',
    type: 'traffic',
    categorySlug: 'civic',
    sourceName: 'Tenali Traffic Police (Sample)',
    publishedHoursAgo: 5,
    validForHours: 72,
  },
  {
    slug: 'sample-library-reading-week',
    title: 'Town library announces reading week (Sample)',
    summary: 'Free membership drive and storytelling sessions for children all week. Sample news item.',
    body: 'The town library will run a reading week with free membership for students.\nSample news item for demo purposes.',
    type: 'news',
    categorySlug: 'education',
    sourceName: 'Mana Tenali desk (Sample)',
    sourceUrl: 'https://example.com/library',
    publishedHoursAgo: 26,
  },
];
