import { describe, it, expect, vi, afterEach } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderApp } from '../../test/render.jsx';
import { mockApi, ok, sampleUser } from '../../test/mockApi.js';
import { setAnalyticsEnabled } from '../../lib/analytics.js';

afterEach(() => {
  setAnalyticsEnabled(false);
  vi.unstubAllGlobals();
});

const business = (o = {}) => ({
  id: 'b1', slug: 'annapurna-tiffins', name: 'Annapurna Tiffins', kind: 'food',
  category: { id: 'c1', name: { en: 'Tiffin Centres', te: null }, slug: 'tiffin-centres', icon: 'coffee' }, subcategory: null,
  area: 'Market Area', location: { lat: 16.24, lng: 80.64 }, photo: null, isVerified: false, isSeed: false, ratingAvg: 4.5, ratingCount: 2,
  isOpenNow: true, contact: { phone: '+91 90000 00004', whatsapp: null, email: null, website: null }, updatedAt: '2026-11-25T04:00:00.000Z',
  description: 'Idli and dosa', tags: [], address: { line: 'Market Area', area: 'Market Area', pincode: '522201' },
  openingHours: [], photos: [], verifiedAt: null, canManage: false, priceRange: null, food: null, ...o,
});
const review = (o = {}) => ({
  id: 'r1', businessId: 'b1', rating: 4, comment: 'Soft idlis.', author: { id: 'u9', name: 'Ravi', avatarUrl: null },
  createdAt: '2026-11-20T04:00:00.000Z', updatedAt: '2026-11-20T04:00:00.000Z', isEdited: false, isSeed: false, ...o,
});
const page = (items) => ok(items, { page: 1, limit: 10, total: items.length, totalPages: 1 });
const detailApi = (o = {}) => ({
  'GET /businesses/annapurna-tiffins': () => ok(business()),
  'GET /businesses/b1/reviews': () => page([review()]),
  'GET /businesses/b1/offers': () => ok([]),
  ...o,
});

describe('Save, Share and Report on a business page', () => {
  it('visitors are sent to log in (and back) when they tap Save or Report', async () => {
    mockApi(detailApi());
    const { router } = renderApp('/businesses/annapurna-tiffins');
    const user = userEvent.setup();
    await user.click(await screen.findByRole('button', { name: 'Save - Annapurna Tiffins' }));
    await waitFor(() => expect(router.state.location.pathname).toBe('/login'));
    expect(router.state.location.search).toBe('?next=%2Fbusinesses%2Fannapurna-tiffins');
  });

  it('saves and unsaves (FR-FAV-1)', async () => {
    let saved = [];
    const { calls } = mockApi(
      detailApi({
        'GET /auth/me': () => ok(sampleUser()),
        'GET /businesses/b1/reviews/mine': () => ok(null),
        'GET /favorites': () => ok(saved),
        'POST /favorites': ({ body }) => {
          saved = [{ id: 'f1', ...body, createdAt: '2026-11-25T04:00:00.000Z', item: business() }];
          return { status: 201, body: ok(saved[0]) };
        },
        'DELETE /favorites/f1': () => {
          saved = [];
          return ok({ id: 'f1', deleted: true });
        },
      }),
    );
    renderApp('/businesses/annapurna-tiffins');
    const user = userEvent.setup();
    const save = await screen.findByRole('button', { name: 'Save - Annapurna Tiffins' });
    expect(save).toHaveAttribute('aria-pressed', 'false');
    await user.click(save);
    expect(calls.find((c) => c.method === 'POST' && c.path === '/favorites').body).toEqual({ targetType: 'business', targetId: 'b1' });
    const savedBtn = await screen.findByRole('button', { name: 'Saved - Annapurna Tiffins' });
    expect(savedBtn).toHaveAttribute('aria-pressed', 'true');
    await user.click(savedBtn);
    await waitFor(() => expect(calls.some((c) => c.method === 'DELETE' && c.path === '/favorites/f1')).toBe(true));
    expect(await screen.findByRole('button', { name: 'Save - Annapurna Tiffins' })).toHaveAttribute('aria-pressed', 'false');
  });

  it('reports with a reason; "Something else" needs details (FR-REP-1)', async () => {
    const { calls } = mockApi(
      detailApi({
        'GET /auth/me': () => ok(sampleUser()),
        'GET /favorites': () => ok([]),
        'GET /businesses/b1/reviews/mine': () => ok(null),
        'POST /reports': ({ body }) => ({ status: 201, body: ok({ id: 'rp1', ...body, status: 'open' }) }),
      }),
    );
    renderApp('/businesses/annapurna-tiffins');
    const user = userEvent.setup();
    await user.click(await screen.findByRole('button', { name: 'Report - Annapurna Tiffins' }));
    const dialog = await screen.findByRole('dialog', { name: 'Report this business' });
    await user.click(within(dialog).getByRole('button', { name: 'Send report' }));
    expect(within(dialog).getByText('Choose a reason.')).toBeInTheDocument();
    await user.click(within(dialog).getByLabelText('Something else'));
    await user.click(within(dialog).getByRole('button', { name: 'Send report' }));
    expect(within(dialog).getByText('Please write at least 10 characters.')).toBeInTheDocument();
    expect(calls.some((c) => c.path === '/reports')).toBe(false);
    await user.click(within(dialog).getByLabelText('Permanently closed'));
    await user.type(within(dialog).getByLabelText('More details'), 'Shutter down for a month.');
    await user.click(within(dialog).getByRole('button', { name: 'Send report' }));
    await waitFor(() =>
      expect(calls.find((c) => c.path === '/reports').body).toEqual({ targetType: 'business', targetId: 'b1', reason: 'closed', details: 'Shutter down for a month.' }),
    );
    expect(await screen.findByText('Thanks. Our team will review it.')).toBeInTheDocument();
  });

  it('shares with the share sheet when available, else copies the link', async () => {
    mockApi(detailApi());
    const share = vi.fn().mockResolvedValue();
    Object.defineProperty(window.navigator, 'share', { value: share, configurable: true });
    try {
      const { unmount } = renderApp('/businesses/annapurna-tiffins');
      const user = userEvent.setup();
      await screen.findByText('Soft idlis.'); // page settled (reviews loaded)
      await user.click(screen.getByRole('button', { name: 'Share - Annapurna Tiffins' }));
      // The page's own address (the test router is in memory, so window.location stays at the test origin).
      await waitFor(() => expect(share).toHaveBeenCalledWith({ title: 'Annapurna Tiffins', url: window.location.href }));
      unmount();
    } finally {
      delete window.navigator.share;
    }

    renderApp('/businesses/annapurna-tiffins');
    const user = userEvent.setup(); // provides a clipboard stub
    await screen.findByText('Soft idlis.');
    await user.click(screen.getByRole('button', { name: 'Share - Annapurna Tiffins' }));
    expect(await screen.findByText('Link copied')).toBeInTheDocument();
    expect(await window.navigator.clipboard.readText()).toBe(window.location.href);
  });
});

describe('reviews on a business page (FR-REV-1)', () => {
  it('shows the average and reviews; visitors are invited to log in', async () => {
    mockApi(detailApi());
    renderApp('/businesses/annapurna-tiffins');
    const section = (await screen.findByRole('heading', { name: 'Reviews' })).closest('div').parentElement;
    expect(within(section).getByText('4.5')).toBeInTheDocument();
    expect(await within(section).findByText('Soft idlis.')).toBeInTheDocument();
    expect(within(section).getByRole('img', { name: '4 out of 5 stars' })).toBeInTheDocument();
    expect(within(section).getByRole('link', { name: 'Log in to write a review' })).toHaveAttribute('href', '/login?next=%2Fbusinesses%2Fannapurna-tiffins');
  });

  it('writes a review: a star rating is required', async () => {
    const { calls } = mockApi(
      detailApi({
        'GET /auth/me': () => ok(sampleUser()),
        'GET /favorites': () => ok([]),
        'GET /businesses/b1/reviews/mine': () => ok(null),
        'POST /businesses/b1/reviews': ({ body }) => ({ status: 201, body: ok(review({ id: 'r2', ...body, status: 'published' })) }),
      }),
    );
    renderApp('/businesses/annapurna-tiffins');
    const user = userEvent.setup();
    await user.click(await screen.findByRole('button', { name: 'Post review' }));
    expect(screen.getByText('Choose 1 to 5 stars.')).toBeInTheDocument();
    await user.click(screen.getByRole('radio', { name: '5 out of 5 stars' }));
    await user.type(screen.getByLabelText('Your review'), 'Best dosa in town.');
    await user.click(screen.getByRole('button', { name: 'Post review' }));
    await waitFor(() => expect(calls.find((c) => c.method === 'POST' && c.path === '/businesses/b1/reviews').body).toEqual({ rating: 5, comment: 'Best dosa in town.' }));
    expect(await screen.findByText('Thanks for your review')).toBeInTheDocument();
  });

  it('my review can be edited and deleted; a hidden one is explained', async () => {
    const mine = review({ id: 'r5', author: { id: 'u1', name: 'Ravi Kumar', avatarUrl: null }, comment: 'Okay.', rating: 3, status: 'published' });
    const { calls } = mockApi(
      detailApi({
        'GET /auth/me': () => ok(sampleUser()),
        'GET /favorites': () => ok([]),
        'GET /businesses/b1/reviews/mine': () => ok(mine),
        'PATCH /reviews/r5': ({ body }) => ok({ ...mine, ...body }),
        'DELETE /reviews/r5': () => ok({ id: 'r5', deleted: true }),
      }),
    );
    const { unmount } = renderApp('/businesses/annapurna-tiffins');
    const user = userEvent.setup();
    expect(await screen.findByText('Your review', { selector: 'p' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Edit' }));
    await user.click(screen.getByRole('radio', { name: '4 out of 5 stars' }));
    await user.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(calls.find((c) => c.method === 'PATCH').body).toEqual({ rating: 4, comment: 'Okay.' }));
    await user.click(await screen.findByRole('button', { name: 'Delete' }));
    const dialog = await screen.findByRole('dialog', { name: 'Delete your review?' });
    await user.click(within(dialog).getByRole('button', { name: 'Delete' }));
    await waitFor(() => expect(calls.some((c) => c.method === 'DELETE' && c.path === '/reviews/r5')).toBe(true));
    unmount();

    mockApi(detailApi({ 'GET /auth/me': () => ok(sampleUser()), 'GET /favorites': () => ok([]), 'GET /businesses/b1/reviews/mine': () => ok({ ...mine, status: 'hidden' }) }));
    renderApp('/businesses/annapurna-tiffins');
    expect(await screen.findByText('A moderator hid this review. Only you can see it.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Edit' })).not.toBeInTheDocument();
  });

  it('owners cannot review their own business; admins can hide reviews', async () => {
    mockApi(detailApi({ 'GET /auth/me': () => ok(sampleUser({ role: 'owner' })), 'GET /favorites': () => ok([]), 'GET /businesses/annapurna-tiffins': () => ok(business({ canManage: true })) }));
    const { unmount } = renderApp('/businesses/annapurna-tiffins');
    expect(await screen.findByText('You cannot review your own business.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Post review' })).not.toBeInTheDocument();
    unmount();

    const { calls } = mockApi(
      detailApi({
        'GET /auth/me': () => ok(sampleUser({ role: 'admin' })),
        'GET /favorites': () => ok([]),
        'GET /businesses/b1/reviews/mine': () => ok(null),
        'DELETE /reviews/r1': () => ok({ id: 'r1', status: 'hidden' }),
      }),
    );
    renderApp('/businesses/annapurna-tiffins');
    await userEvent.setup().click(await screen.findByRole('button', { name: 'Hide - Ravi' }));
    await waitFor(() => expect(calls.some((c) => c.method === 'DELETE' && c.path === '/reviews/r1')).toBe(true));
    expect(screen.getByRole('button', { name: 'Report - Ravi' })).toBeInTheDocument();
  });
});

describe('Saved, My reviews and Suggest pages', () => {
  it('Saved groups items by type; unavailable items can be removed', async () => {
    const { calls } = mockApi({
      'GET /auth/me': () => ok(sampleUser()),
      'GET /favorites': () =>
        ok([
          { id: 'f1', targetType: 'business', targetId: 'b1', createdAt: '2026-11-25T04:00:00.000Z', item: business() },
          { id: 'f2', targetType: 'business', targetId: 'b2', createdAt: '2026-11-24T04:00:00.000Z', item: null },
        ]),
      'DELETE /favorites/f2': () => ok({ id: 'f2', deleted: true }),
    });
    renderApp('/saved');
    const user = userEvent.setup();
    expect(await screen.findByRole('heading', { name: 'Businesses (2)' })).toBeInTheDocument();
    expect(screen.getByText('Annapurna Tiffins')).toBeInTheDocument();
    expect(screen.getByText(/no longer available/)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Remove - unavailable item' }));
    await waitFor(() => expect(calls.some((c) => c.method === 'DELETE' && c.path === '/favorites/f2')).toBe(true));
  });

  it('Saved needs sign-in and has an empty state', async () => {
    const { router, unmount } = renderApp('/saved');
    await waitFor(() => expect(router.state.location.pathname).toBe('/login'));
    unmount();
    mockApi({ 'GET /auth/me': () => ok(sampleUser()), 'GET /favorites': () => ok([]) });
    renderApp('/saved');
    expect(await screen.findByText('Nothing saved yet')).toBeInTheDocument();
  });

  it('My reviews lists my reviews with links to the business (FR-PRO-2)', async () => {
    mockApi({
      'GET /auth/me': () => ok(sampleUser()),
      'GET /reviews/mine': () =>
        ok([
          { ...review({ id: 'r1', status: 'published' }), business: { id: 'b1', name: 'Annapurna Tiffins', slug: 'annapurna-tiffins', area: 'Market Area' } },
          { ...review({ id: 'r2', status: 'hidden', comment: 'Hidden one' }), business: null },
        ]),
    });
    renderApp('/profile/reviews');
    expect((await screen.findByText('Annapurna Tiffins')).closest('a')).toHaveAttribute('href', '/businesses/annapurna-tiffins');
    expect(screen.getByText('Business no longer listed')).toBeInTheDocument();
    expect(screen.getByText('Hidden by a moderator')).toBeInTheDocument();
  });

  it('Suggest links to the existing flows and sends a suggestion (U1 / D0.13)', async () => {
    const { unmount } = renderApp('/suggest');
    expect(await screen.findByRole('link', { name: /List your own business/ })).toHaveAttribute('href', '/manage/new');
    expect(screen.getByRole('link', { name: /Submit an event/ })).toHaveAttribute('href', '/events/submit');
    expect(screen.getByRole('link', { name: 'Log in' })).toHaveAttribute('href', '/login?next=%2Fsuggest');
    unmount();

    const { calls } = mockApi({ 'GET /auth/me': () => ok(sampleUser()), 'POST /reports': ({ body }) => ({ status: 201, body: ok({ id: 's1', ...body, status: 'open' }) }) });
    renderApp('/suggest');
    const user = userEvent.setup();
    await user.selectOptions(await screen.findByLabelText('What is it about?'), 'correction');
    await user.type(screen.getByLabelText('Your suggestion *'), 'Bus');
    await user.click(screen.getByRole('button', { name: 'Send suggestion' }));
    expect(screen.getByText('Please write at least 10 characters.')).toBeInTheDocument();
    await user.type(screen.getByLabelText('Your suggestion *'), ' stand moved to Gandhi Chowk.');
    await user.click(screen.getByRole('button', { name: 'Send suggestion' }));
    expect(await screen.findByText('Thank you! Our team will read your suggestion.')).toBeInTheDocument();
    expect(calls.find((c) => c.path === '/reports').body).toEqual({ targetType: 'suggestion', reason: 'correction', details: 'Bus stand moved to Gandhi Chowk.' });
  });
});

describe('anonymous activity events (FR-ANA-1)', () => {
  const analytics = (calls) => calls.filter((c) => c.path === '/analytics/events').map((c) => c.body);

  it('records a business view and contact clicks with an anonymous device id only', async () => {
    setAnalyticsEnabled(true);
    const { calls } = mockApi({ ...detailApi(), 'POST /analytics/events': () => ({ status: 202, body: ok({ recorded: true }) }) });
    renderApp('/businesses/annapurna-tiffins');
    const user = userEvent.setup();
    await waitFor(() => expect(analytics(calls)).toEqual([expect.objectContaining({ type: 'view', targetType: 'business', targetId: 'b1' })]));
    const call = (await screen.findAllByRole('link', { name: /Call - Annapurna Tiffins/ }))[0];
    call.addEventListener('click', (e) => e.preventDefault()); // don't navigate to tel: in the test
    await user.click(call);
    await waitFor(() => expect(analytics(calls).at(-1)).toMatchObject({ type: 'contact_click', targetType: 'business', targetId: 'b1' }));
    const sid = window.localStorage.getItem('mt.sid');
    expect(sid).toMatch(/^[A-Za-z0-9-]{8,64}$/);
    for (const body of analytics(calls)) expect(Object.keys(body).sort()).toEqual(['sessionId', 'targetId', 'targetType', 'type']);
    expect(analytics(calls).every((b) => b.sessionId === sid)).toBe(true);
  });

  it('records one "search" per new query without the search words, and nothing when disabled', async () => {
    setAnalyticsEnabled(true);
    const result = ok({ query: 'x', type: 'all', fuzzy: false, counts: { business: 0, offer: 0, event: 0, news: 0, all: 0 }, groups: { business: [], offer: [], event: [], news: [] } });
    const { calls } = mockApi({ 'GET /search': () => result, 'POST /analytics/events': () => ({ status: 202, body: ok({ recorded: true }) }) });
    const { unmount } = renderApp('/search?q=biryani');
    await waitFor(() => expect(analytics(calls)).toHaveLength(1));
    expect(analytics(calls)[0]).toEqual({ type: 'search', sessionId: expect.any(String) });
    expect(JSON.stringify(analytics(calls))).not.toMatch(/biryani/);
    unmount();

    setAnalyticsEnabled(false);
    const off = mockApi({ ...detailApi() });
    renderApp('/businesses/annapurna-tiffins');
    await screen.findAllByRole('heading', { name: 'Annapurna Tiffins' });
    expect(analytics(off.calls)).toEqual([]);
  });
});
