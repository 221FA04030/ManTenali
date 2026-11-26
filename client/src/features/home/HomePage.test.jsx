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
    expect(screen.getByRole('heading', { level: 1, name: 'Mana Tenali' })).toBeInTheDocument();
    expect(screen.getByText('Discover • Connect • Local')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Search Mana Tenali' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Log in' })).toHaveAttribute('href', '/login');

    const grid = screen.getByRole('region', { name: 'Browse categories' });
    expect(within(grid).getByRole('link', { name: /News & Updates/ })).toHaveAttribute('href', '/news');
    expect(within(grid).getByRole('link', { name: /Food & Dining/ })).toHaveAttribute('href', '/food');
    expect(within(grid).getByRole('link', { name: /Community/ })).toHaveAttribute('href', '/community');
    expect(within(grid).getByRole('link', { name: /Services/ })).toHaveAttribute('href', '/businesses?kind=service');
    expect(within(grid).getByRole('link', { name: /Offers/ })).toHaveAttribute('href', '/offers');
    expect(within(grid).getByRole('link', { name: /Events/ })).toHaveAttribute('href', '/events');
    // Category shortcuts open the full list until categories load (none are mocked here).
    expect(within(grid).getByRole('link', { name: /Shopping/ })).toHaveAttribute('href', '/businesses');
    expect(within(grid).getAllByRole('link')).toHaveLength(10); // the 10 shortcuts of the home design
    expect(within(grid).queryAllByText('Soon')).toHaveLength(0);

    // Explore Tenali: real lists; "Places to Visit" has no data yet, so it is dimmed and not a link.
    const explore = screen.getByRole('region', { name: 'Explore Tenali' });
    expect(within(explore).getByRole('link', { name: /Businesses/ })).toHaveAttribute('href', '/businesses');
    expect(within(explore).getByRole('link', { name: /Restaurants/ })).toHaveAttribute('href', '/food');
    expect(within(explore).getByRole('link', { name: /Events/ })).toHaveAttribute('href', '/events');
    expect(within(explore).queryByRole('link', { name: /Places to Visit/ })).toBeNull();
    expect(within(explore).getByText('Places to Visit').closest('[data-coming-soon]')).toHaveAttribute('aria-disabled', 'true');
  });

  it('category shortcuts open their real category; a category that does not exist stays "Coming soon"', async () => {
    mockApi({
      'GET /categories': () =>
        ok([
          { id: 'c-shop', slug: 'shopping', parentId: null, name: { en: 'Shopping', te: null } },
          { id: 'c-health', slug: 'health-medical', parentId: null, name: { en: 'Health & Medical', te: null } },
          { id: 'c-edu', slug: 'education', parentId: null, name: { en: 'Education', te: null } },
        ]),
    });
    renderApp('/');
    const grid = await screen.findByRole('region', { name: 'Browse categories' });
    await waitFor(() => expect(within(grid).getByRole('link', { name: /Shopping/ })).toHaveAttribute('href', '/businesses?categoryId=c-shop'));
    expect(within(grid).getByRole('link', { name: /Health & Medical/ })).toHaveAttribute('href', '/businesses?categoryId=c-health');
    expect(within(grid).getByRole('link', { name: /Education/ })).toHaveAttribute('href', '/businesses?categoryId=c-edu');
    expect(within(grid).queryByRole('link', { name: /Hotels & Stay/ })).toBeNull(); // not in this category list
    expect(within(grid).getAllByText('Soon')).toHaveLength(1);
  });

  it('signed-in people see their profile button; Home shows popular food, verified businesses and community posts', async () => {
    const biz = (id, name) => ({
      id, slug: id, name, kind: 'food', category: null, subcategory: null, area: 'Kothapeta', location: null, photo: null,
      isVerified: true, isSeed: false, ratingAvg: 4.5, ratingCount: 3, isOpenNow: null, contact: {}, updatedAt: '2026-11-25T04:00:00.000Z',
    });
    const post = {
      id: 'p1', kind: 'question', text: 'Where is a good tailor?', photo: null, area: null, business: null,
      author: { id: 'u9', name: 'Lakshmi', avatarUrl: null }, likeCount: 0, commentCount: 0, likedByMe: false, isMine: false,
      isSeed: false, createdAt: '2026-11-25T04:00:00.000Z', editedAt: null,
    };
    mockApi({
      'GET /auth/me': () => ok({ id: 'u1', name: 'Ravi Kumar', email: 'r@example.com', role: 'user', avatarUrl: null, language: 'en', status: 'active' }),
      'GET /home': () =>
        ok({
          banner: [], today: { notices: [], nextEvent: null }, nearby: { mode: 'all', items: [] }, offers: [], events: [], news: [],
          food: [biz('b1', 'Padma Meals')],
          featured: [biz('b2', 'Sri Hardware')],
          community: [post],
        }),
    });
    renderApp('/');
    expect(await screen.findByRole('link', { name: 'Your profile (Ravi Kumar)' })).toHaveAttribute('href', '/profile');
    const food = await screen.findByRole('region', { name: /Popular restaurants/ });
    expect(within(food).getByText('Padma Meals')).toBeInTheDocument();
    expect(within(screen.getByRole('region', { name: /Verified businesses/ })).getByText('Sri Hardware')).toBeInTheDocument();
    expect(within(screen.getByRole('region', { name: /From the community/ })).getByText('Where is a good tailor?')).toBeInTheDocument();
    expect(screen.queryByRole('region', { name: /Active offers/ })).toBeNull(); // empty sections are hidden
  });

  it('the search button opens the search page', async () => {
    const { router } = renderApp('/');
    const user = userEvent.setup();
    await user.click(await screen.findByRole('button', { name: 'Search Mana Tenali' }));
    await waitFor(() => expect(router.state.location.pathname).toBe('/search'));
  });

  it('bottom navigation marks the active tab and navigates', async () => {
    const { router } = renderApp('/');
    const user = userEvent.setup();
    const nav = await screen.findByRole('navigation', { name: 'Main navigation' });
    expect(within(nav).getByRole('link', { name: 'Home' })).toHaveAttribute('aria-current', 'page');
    await user.click(within(nav).getByRole('link', { name: 'Discover' }));
    expect(router.state.location.pathname).toBe('/discover');
    await waitFor(() =>
      expect(within(nav).getByRole('link', { name: 'Discover' })).toHaveAttribute('aria-current', 'page'),
    );
    for (const label of ['Post', 'Saved', 'Profile']) {
      expect(within(nav).getByRole('link', { name: label })).toBeInTheDocument();
    }
  });

  it('switches the UI to Telugu from the menu and remembers it', async () => {
    renderApp('/');
    const user = userEvent.setup();
    await user.click(await screen.findByRole('button', { name: 'Open menu' }));
    await user.click(screen.getByRole('button', { name: 'తెలుగు' }));
    expect(await screen.findAllByText('మన తెనాలి')).not.toHaveLength(0);
    expect(screen.getByText('షాపింగ్')).toBeInTheDocument();
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
const HERO = 'Highlights in Tenali';
const HAPPENING = "What's Happening in Tenali";

describe('Home feed (GET /home)', () => {
  it('shows the hero, What\'s Happening, Explore, Today in Tenali and the sections, with links to each item and list', async () => {
    window.localStorage.setItem('mt.area', JSON.stringify('Kothapeta'));
    const { calls } = mockApi({ 'GET /home': () => ok(feed()) });
    renderApp('/');
    // Hero carousel: the real banner items, each with its place, title and line under it.
    const hero = await screen.findByRole('region', { name: HERO });
    const slides = within(hero).getAllByRole('link');
    expect(slides.map((a) => a.getAttribute('href'))).toEqual(['/news/water-cut', '/events/food-festival', '/offers/o1']);
    expect(slides[0]).toHaveTextContent('Tenali');
    expect(slides[1]).toHaveTextContent(/Bose Road.*Andhra Food Festival.*29 Nov 2026 • School Grounds/);
    expect(slides[2]).toHaveTextContent(/Main Road.*Free sweet with family meals.*Free sweet • Padma Meals/);
    expect(within(hero).getAllByRole('button', { name: /^Show highlight \d of 3$/ })).toHaveLength(3);
    expect(within(hero).getByRole('button', { name: 'Show highlight 1 of 3' })).toHaveAttribute('aria-current', 'true');
    await userEvent.setup().click(within(hero).getByRole('button', { name: 'Pause highlights' }));
    expect(within(hero).getByRole('button', { name: 'Play highlights' })).toBeInTheDocument();

    // What's Happening: events, offers and news in turns, with badges and real dates and places.
    const happening = screen.getByRole('region', { name: HAPPENING });
    const cards = within(happening).getAllByRole('link').filter((a) => a.getAttribute('href') !== '/discover');
    expect(cards.map((a) => a.getAttribute('href'))).toEqual(['/events/food-festival', '/offers/o1', '/news/library']);
    expect(cards[0]).toHaveTextContent(/Event.*Andhra Food Festival.*29 Nov 2026.*Bose Road/);
    expect(cards[1]).toHaveTextContent(/Offer.*Free sweet with family meals.*Padma Meals/);
    expect(cards[2]).toHaveTextContent(/News.*Library reading week.*25 Nov 2026/);
    expect(within(happening).getByRole('link', { name: /View All/ })).toHaveAttribute('href', '/discover');
    expect(screen.getByRole('region', { name: 'Explore Tenali' })).toBeInTheDocument();

    const today = screen.getByRole('region', { name: /Today in Tenali/ });
    expect(within(today).getByRole('link', { name: /View All/ })).toHaveAttribute('href', '/news');
    const notice = within(today).getByRole('link', { name: /Road work on Bose Road/ });
    expect(notice).toHaveAttribute('href', '/news/road-work');
    expect(within(notice).getByText(/Traffic Police • Updated/)).toBeInTheDocument();
    expect(within(today).getByRole('link', { name: /Next event/ })).toHaveAttribute('href', '/events/food-festival');

    expect(screen.getByRole('region', { name: /Businesses in Kothapeta/ })).toBeInTheDocument();
    // Offers, events and news now appear once, in What's Happening (no separate lists).
    expect(screen.queryByRole('region', { name: /Active offers|Upcoming events|Latest news/ })).toBeNull();
    expect(calls.find((c) => c.path === '/home').query).toEqual({ area: 'Kothapeta' });
  });

  it('hides the banner and empty sections; Today in Tenali says when there is nothing', async () => {
    mockApi({ 'GET /home': () => ok(feed({ banner: [], today: { notices: [], nextEvent: null }, nearby: { mode: 'all', items: [] }, offers: [], events: [], news: [] })) });
    renderApp('/');
    expect(await screen.findByText('No updates right now. Check back later.')).toBeInTheDocument();
    expect(screen.queryByRole('region', { name: HERO })).not.toBeInTheDocument();
    expect(screen.queryByRole('region', { name: HAPPENING })).not.toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'Browse categories' })).toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'Explore Tenali' })).toBeInTheDocument();
  });

  it('keeps tiles and search working when the feed fails, with a retry', async () => {
    let fail = true;
    mockApi({ 'GET /home': () => (fail ? { status: 500, body: { success: false, error: { code: 'INTERNAL_ERROR', message: 'x' } } } : ok(feed())) });
    renderApp('/');
    const retry = await screen.findByRole('button', { name: 'Try again' });
    expect(screen.getByRole('button', { name: 'Search Mana Tenali' })).toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'Browse categories' })).toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'Explore Tenali' })).toBeInTheDocument();
    fail = false;
    await userEvent.setup().click(retry);
    expect(await screen.findByRole('region', { name: HERO })).toBeInTheDocument();
    expect(screen.getByRole('region', { name: HAPPENING })).toBeInTheDocument();
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
