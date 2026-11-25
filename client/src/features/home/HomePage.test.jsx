import { describe, it, expect } from 'vitest';
import { screen, within, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderApp } from '../../test/render.jsx';
import { mockApi, ok } from '../../test/mockApi.js';
import i18n from '../../app/i18n.js';

describe('Home screen and app shell', () => {
  it('renders header, search and tiles; later-phase tiles are not tappable', async () => {
    renderApp('/');
    expect(await screen.findByText('Mana Tenali')).toBeInTheDocument();
    expect(screen.getByRole('searchbox', { name: 'Search Mana Tenali' })).toBeInTheDocument();

    const grid = screen.getByRole('region', { name: 'Browse categories' });
    expect(within(grid).getByRole('link', { name: /News & Updates/ })).toHaveAttribute('href', '/news');
    expect(within(grid).getByRole('link', { name: /Local Shops/ })).toHaveAttribute('href', '/businesses');
    expect(within(grid).getByRole('link', { name: /Services/ })).toHaveAttribute('href', '/businesses?kind=service');
    expect(within(grid).getByRole('link', { name: /More/ })).toHaveAttribute('href', '/explore');
    expect(within(grid).queryByRole('link', { name: /Bus Tracking/ })).toBeNull();
    expect(within(grid).queryByRole('link', { name: /Jobs/ })).toBeNull();
    expect(within(grid).getAllByText('Soon')).toHaveLength(2);
  });

  it('search submits to /search with the query', async () => {
    const { router } = renderApp('/');
    const user = userEvent.setup();
    await user.type(await screen.findByRole('searchbox'), 'biryani{Enter}');
    expect(router.state.location.pathname).toBe('/search');
    expect(router.state.location.search).toBe('?q=biryani');
  });

  it('bottom navigation marks the active tab and navigates', async () => {
    const { router } = renderApp('/');
    const user = userEvent.setup();
    const nav = await screen.findByRole('navigation', { name: 'Main navigation' });
    expect(within(nav).getByRole('link', { name: 'Home' })).toHaveAttribute('aria-current', 'page');
    await user.click(within(nav).getByRole('link', { name: 'Explore' }));
    expect(router.state.location.pathname).toBe('/explore');
    await waitFor(() =>
      expect(within(nav).getByRole('link', { name: 'Explore' })).toHaveAttribute('aria-current', 'page'),
    );
    for (const label of ['Suggest', 'Saved', 'Profile']) {
      expect(within(nav).getByRole('link', { name: label })).toBeInTheDocument();
    }
  });

  it('switches the UI to Telugu from the menu and remembers it', async () => {
    renderApp('/');
    const user = userEvent.setup();
    await user.click(await screen.findByRole('button', { name: 'Open menu' }));
    await user.click(screen.getByRole('button', { name: 'తెలుగు' }));
    expect(await screen.findAllByText('మన తెనాలి')).not.toHaveLength(0);
    expect(screen.getByText('స్థానిక దుకాణాలు')).toBeInTheDocument();
    expect(document.documentElement.lang).toBe('te');
    expect(JSON.parse(window.localStorage.getItem('mt.lang'))).toBe('te');
  });

  it('shows a not-found page for unknown routes', async () => {
    renderApp('/nope');
    expect(await screen.findAllByText('Page not found')).not.toHaveLength(0);
  });
});

const newsItem = (o = {}) => ({
  id: 'n1', slug: 'water-cut', title: 'No water supply in ward 12', summary: 'Pipeline repair from 6 am to 11 am.', type: 'water', category: null,
  coverImage: null, sourceName: 'Municipal water works', sourceUrl: null, publishedAt: '2026-11-25T04:00:00.000Z', updatedAt: '2026-11-25T04:00:00.000Z',
  validUntil: null, validUntilLocal: null, isPinned: true, isExpired: false, isSeed: false, ...o,
});
const eventItem = (o = {}) => ({
  id: 'e1', slug: 'food-festival', title: 'Andhra Food Festival', description: '', category: null, startAt: '2026-11-29T11:30:00.000Z', endAt: '2026-11-29T16:30:00.000Z',
  startLocal: '2026-11-29T17:00', endLocal: '2026-11-29T22:00', allDay: false, venue: { name: 'School Grounds', address: 'Bose Road', area: 'Bose Road' }, location: null,
  bannerImage: null, bookingUrl: null, priceInfo: null, organizerName: 'Club', business: null, isCancelled: false, cancelReason: null, isSeed: false, ...o,
});
const offerItem = (o = {}) => ({
  id: 'o1', businessId: 'b1', business: { id: 'b1', name: 'Padma Meals', slug: 'padma-meals', area: 'Main Road' }, title: 'Free sweet with family meals', description: '',
  discountLabel: 'Free sweet', couponCode: null, terms: 'x', redemptionInstructions: '', image: null, validFrom: '2026-11-20T00:00:00.000Z', validTo: '2026-11-27T18:29:59.999Z',
  validFromDate: '2026-11-20', validToDate: '2026-11-27', isSeed: false, canManage: false, ...o,
});
const businessItem = (o = {}) => ({
  id: 'b1', slug: 'padma-meals', name: 'Padma Meals', kind: 'food', category: null, subcategory: null, area: 'Kothapeta', addressLine: 'x', location: null,
  photo: null, isVerified: false, isSeed: true, ratingAvg: 0, ratingCount: 0, isOpenNow: true, contact: { phone: null, whatsapp: null }, priceRange: null, food: null,
  updatedAt: '2026-11-25T04:00:00.000Z', ...o,
});
const feed = (o = {}) => ({
  banner: [
    { type: 'news', item: newsItem() },
    { type: 'event', item: eventItem() },
    { type: 'offer', item: offerItem() },
  ],
  today: { notices: [newsItem({ id: 'n2', slug: 'road-work', title: 'Road work on Bose Road', type: 'traffic', sourceName: 'Traffic Police' })], nextEvent: eventItem() },
  nearby: { mode: 'area', area: 'Kothapeta', items: [businessItem()] },
  offers: [offerItem()],
  events: [eventItem()],
  news: [newsItem({ id: 'n3', slug: 'library', title: 'Library reading week', type: 'news', isPinned: false })],
  ...o,
});
const BANNER = "What's Happening in Tenali?";

describe('Home feed (GET /home)', () => {
  it('shows the banner, Today in Tenali and the sections, with links to each item and list', async () => {
    window.localStorage.setItem('mt.area', JSON.stringify('Kothapeta'));
    const { calls } = mockApi({ 'GET /home': () => ok(feed()) });
    renderApp('/');
    const banner = await screen.findByRole('region', { name: BANNER });
    const views = within(banner).getAllByRole('link', { name: /View Now/ });
    expect(views.map((a) => a.getAttribute('href'))).toEqual(['/news/water-cut', '/events/food-festival', '/offers/o1']);
    expect(within(banner).getByText('Event')).toBeInTheDocument();
    expect(within(banner).getByText('Free sweet • Padma Meals')).toBeInTheDocument();

    const today = screen.getByRole('region', { name: /Today in Tenali/ });
    expect(within(today).getByRole('link', { name: /View All/ })).toHaveAttribute('href', '/news');
    const notice = within(today).getByRole('link', { name: /Road work on Bose Road/ });
    expect(notice).toHaveAttribute('href', '/news/road-work');
    expect(within(notice).getByText(/Traffic Police • Updated/)).toBeInTheDocument();
    expect(within(today).getByRole('link', { name: /Next event/ })).toHaveAttribute('href', '/events/food-festival');

    expect(screen.getByRole('region', { name: /Businesses in Kothapeta/ })).toBeInTheDocument();
    expect(screen.getByRole('region', { name: /Active offers/ })).toBeInTheDocument();
    expect(screen.getByRole('region', { name: /Upcoming events/ })).toBeInTheDocument();
    const latest = screen.getByRole('region', { name: /Latest news/ });
    expect(within(latest).getByRole('link', { name: /View All/ })).toHaveAttribute('href', '/news?type=news');
    expect(calls.find((c) => c.path === '/home').query).toEqual({ area: 'Kothapeta' });
  });

  it('hides the banner and empty sections; Today in Tenali says when there is nothing', async () => {
    mockApi({ 'GET /home': () => ok(feed({ banner: [], today: { notices: [], nextEvent: null }, nearby: { mode: 'all', items: [] }, offers: [], events: [], news: [] })) });
    renderApp('/');
    expect(await screen.findByText('No updates right now. Check back later.')).toBeInTheDocument();
    expect(screen.queryByRole('region', { name: BANNER })).not.toBeInTheDocument();
    expect(screen.queryByRole('region', { name: /Active offers/ })).not.toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'Browse categories' })).toBeInTheDocument();
  });

  it('keeps tiles and search working when the feed fails, with a retry', async () => {
    let fail = true;
    mockApi({ 'GET /home': () => (fail ? { status: 500, body: { success: false, error: { code: 'INTERNAL_ERROR', message: 'x' } } } : ok(feed())) });
    renderApp('/');
    const retry = await screen.findByRole('button', { name: 'Try again' });
    expect(screen.getByRole('searchbox')).toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'Browse categories' })).toBeInTheDocument();
    fail = false;
    await userEvent.setup().click(retry);
    expect(await screen.findByRole('region', { name: BANNER })).toBeInTheDocument();
  });

  it('names the nearby section after the location mode, and has Telugu labels', async () => {
    mockApi({ 'GET /home': () => ok(feed({ nearby: { mode: 'all', items: [businessItem()] } })) });
    const { unmount } = renderApp('/');
    expect(await screen.findByRole('region', { name: /Businesses in Tenali/ })).toBeInTheDocument();
    unmount();
    mockApi({ 'GET /home': () => ok(feed()) });
    await i18n.changeLanguage('te');
    renderApp('/');
    expect(await screen.findByRole('region', { name: /ఈ రోజు తెనాలిలో/ })).toBeInTheDocument();
    expect(screen.getByText('తదుపరి కార్యక్రమం')).toBeInTheDocument();
  });
});
