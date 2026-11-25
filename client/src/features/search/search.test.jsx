import { describe, it, expect, vi, afterEach } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderApp } from '../../test/render.jsx';
import { mockApi, ok } from '../../test/mockApi.js';
import i18n from '../../app/i18n.js';

const business = (o = {}) => ({
  id: 'b1', slug: 'biryani-point', name: 'Biryani Point', kind: 'food', category: { id: 'c1', name: { en: 'Food & Dining' } }, subcategory: null,
  area: 'Main Road', addressLine: 'Main Road', location: null, photo: null, isVerified: true, isSeed: false, ratingAvg: 0, ratingCount: 0,
  isOpenNow: true, contact: { phone: '+919000000001', whatsapp: null }, priceRange: 2, food: { cuisines: ['biryani'], isVegFriendly: false }, updatedAt: '2026-11-25T04:00:00.000Z', ...o,
});
const offer = (o = {}) => ({
  id: 'o1', businessId: 'b1', business: { id: 'b1', name: 'Biryani Point', slug: 'biryani-point', area: 'Main Road' }, title: 'Biryani combo for two', description: '',
  discountLabel: '20% off', couponCode: null, terms: 'x', redemptionInstructions: '', image: null, validFrom: '2026-11-20T00:00:00.000Z', validTo: '2026-12-30T00:00:00.000Z',
  validFromDate: '2026-11-20', validToDate: '2026-12-30', isSeed: false, canManage: false, ...o,
});
const news = (o = {}) => ({
  id: 'n1', slug: 'biryani-fair', title: 'Biryani stalls at the fair', summary: 'Twenty stalls this weekend.', type: 'news', category: null, coverImage: null,
  sourceName: 'Mana Tenali desk', sourceUrl: null, publishedAt: '2026-11-25T04:00:00.000Z', updatedAt: '2026-11-25T04:00:00.000Z', validUntil: null, validUntilLocal: null,
  isPinned: false, isExpired: false, isSeed: false, ...o,
});
const result = (data, meta) => ok({ query: 'biryani', type: 'all', fuzzy: false, ...data }, meta);
const allResults = (o = {}) =>
  result({
    counts: { business: 7, offer: 1, event: 0, news: 1, all: 9 },
    groups: { business: [business(), business({ id: 'b2', slug: 'b2', name: 'Paradise Biryani' })], offer: [offer()], event: [], news: [news()] },
    ...o,
  });

afterEach(() => vi.unstubAllGlobals());

describe('/search', () => {
  it('shows a prompt before searching and a hint for very short queries', async () => {
    const { unmount } = renderApp('/search');
    expect(await screen.findByRole('heading', { name: 'Search Mana Tenali' })).toBeInTheDocument();
    unmount();
    renderApp('/search?q=b');
    expect(await screen.findByText('Type at least 2 characters to search.')).toBeInTheDocument();
  });

  it('groups results by type with counts and tabs; "See all" opens the tab with load more', async () => {
    const { calls } = mockApi({
      'GET /search': ({ query }) =>
        query.type === 'business'
          ? result(
              { type: 'business', counts: { business: 7, offer: 1, event: 0, news: 1, all: 9 }, groups: { business: [business(), business({ id: 'b3', slug: 'b3', name: `Kirana page ${query.page}` })] } },
              { page: Number(query.page), limit: 20, total: 7, totalPages: 2, capped: false },
            )
          : allResults(),
    });
    const { router } = renderApp('/search?q=biryani');
    const user = userEvent.setup();
    expect(await screen.findByRole('heading', { name: 'Businesses (7)' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Offers (1)' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'News (1)' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: /Events/ })).not.toBeInTheDocument(); // empty groups are hidden
    expect(screen.getByRole('link', { name: /Biryani combo for two/ })).toHaveAttribute('href', '/offers/o1');
    expect(screen.getByRole('link', { name: /Biryani stalls at the fair/ })).toHaveAttribute('href', '/news/biryani-fair');
    const tabs = screen.getByRole('group', { name: 'Show results for' });
    expect(within(tabs).getByRole('button', { name: /All \(9\)/ })).toHaveAttribute('aria-pressed', 'true');
    expect(within(tabs).getByRole('button', { name: /Events \(0\)/ })).toBeInTheDocument();
    expect(calls.find((c) => c.path === '/search').query).toEqual({ q: 'biryani', type: 'all' });

    await user.click(screen.getByRole('button', { name: 'See all 7 businesses' }));
    await waitFor(() => expect(router.state.location.search).toBe('?q=biryani&type=business'));
    expect(await screen.findByText('Kirana page 1')).toBeInTheDocument();
    expect(screen.getByText('7 results')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Load more' }));
    expect(await screen.findByText('Kirana page 2')).toBeInTheDocument();
    expect(calls.filter((c) => c.path === '/search').at(-1).query).toMatchObject({ q: 'biryani', type: 'business', page: '2', limit: '20' });
  });

  it('a new search from the box updates the URL and keeps the tab', async () => {
    const { calls } = mockApi({ 'GET /search': () => allResults() });
    const { router } = renderApp('/search?q=biryani&type=news');
    const user = userEvent.setup();
    const box = await screen.findByRole('searchbox');
    expect(box).toHaveValue('biryani');
    await user.clear(box);
    await user.type(box, 'tiffin{Enter}');
    await waitFor(() => expect(router.state.location.search).toBe('?q=tiffin&type=news'));
    await waitFor(() => expect(calls.filter((c) => c.path === '/search').at(-1).query).toMatchObject({ q: 'tiffin', type: 'news' }));
  });

  it('says when it shows close matches, and shows an empty state with tips', async () => {
    mockApi({ 'GET /search': () => allResults({ fuzzy: true }) });
    const { unmount } = renderApp('/search?q=biriyani');
    expect(await screen.findByText('No exact matches for “biriyani”. Showing close matches.')).toBeInTheDocument();
    unmount();
    mockApi({ 'GET /search': () => result({ fuzzy: true, counts: { business: 0, offer: 0, event: 0, news: 0, all: 0 }, groups: { business: [], offer: [], event: [], news: [] } }) });
    renderApp('/search?q=zzzz');
    expect(await screen.findByText('No results for “zzzz”')).toBeInTheDocument();
    expect(screen.getByText(/Check the spelling/)).toBeInTheDocument();
  });

  it('shows an error state with retry', async () => {
    let fail = true;
    mockApi({ 'GET /search': () => (fail ? { status: 500, body: { success: false, error: { code: 'INTERNAL_ERROR', message: 'x' } } } : allResults()) });
    renderApp('/search?q=biryani');
    const retry = await screen.findByRole('button', { name: 'Try again' });
    fail = false;
    await userEvent.setup().click(retry);
    expect(await screen.findByRole('heading', { name: 'Businesses (7)' })).toBeInTheDocument();
  });

  it('suggests businesses and categories while typing (FR-SRCH-3)', async () => {
    const { calls } = mockApi({
      'GET /search/suggest': () =>
        ok({ businesses: [{ id: 'b1', name: 'Ravi Tiffins', slug: 'ravi-tiffins', area: 'Kothapeta' }], categories: [{ id: 's1', name: { en: 'Tiffin Centres', te: null }, slug: 'tiffin-centres', parentId: 'm1' }] }),
    });
    renderApp('/search');
    const user = userEvent.setup();
    await user.type(await screen.findByRole('searchbox'), 'tiff');
    const list = await screen.findByRole('navigation', { name: 'Suggestions' });
    expect(within(list).getByRole('link', { name: /Ravi Tiffins/ })).toHaveAttribute('href', '/businesses/ravi-tiffins');
    expect(within(list).getByRole('link', { name: /Tiffin Centres/ })).toHaveAttribute('href', '/businesses?subcategoryId=s1');
    await waitFor(() => expect(calls.filter((c) => c.path === '/search/suggest').at(-1).query).toEqual({ q: 'tiff' }));
  });

  it('near me sends the location and offers distance sorting; otherwise the chosen area is sent', async () => {
    const getCurrentPosition = vi.fn((success) => success({ coords: { latitude: 16.2379, longitude: 80.6444 } }));
    vi.stubGlobal('navigator', { ...navigator, geolocation: { getCurrentPosition } });
    window.localStorage.setItem('mt.area', JSON.stringify('Kothapeta'));
    const { calls } = mockApi({ 'GET /search': () => allResults() });
    renderApp('/search?q=biryani');
    const user = userEvent.setup();
    await screen.findByRole('heading', { name: 'Businesses (7)' });
    expect(calls.filter((c) => c.path === '/search').at(-1).query).toMatchObject({ area: 'Kothapeta' });
    expect(screen.queryByLabelText('Sort results')).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Near me' }));
    const sort = await screen.findByLabelText('Sort results');
    await user.selectOptions(sort, 'distance');
    await waitFor(() =>
      expect(calls.filter((c) => c.path === '/search').at(-1).query).toMatchObject({ lat: '16.2379', lng: '80.6444', radiusKm: '10', sort: 'distance' }),
    );
    expect(calls.filter((c) => c.path === '/search').at(-1).query.area).toBeUndefined();
  });

  it('has Telugu labels', async () => {
    mockApi({ 'GET /search': () => allResults() });
    await i18n.changeLanguage('te');
    renderApp('/search?q=biryani');
    expect(await screen.findByRole('heading', { name: 'వ్యాపారాలు (7)' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /అన్నీ \(9\)/ })).toBeInTheDocument();
  });
});
