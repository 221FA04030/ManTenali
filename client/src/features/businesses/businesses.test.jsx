import { describe, it, expect, vi, afterEach } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderApp } from '../../test/render.jsx';
import { mockApi, ok, sampleUser } from '../../test/mockApi.js';
import { toPayload } from './components/BusinessForm.jsx';
import { hoursToRows, rowsToHours } from './components/HoursEditor.jsx';

const card = (overrides = {}) => ({
  id: 'b1',
  slug: 'annapurna-tiffins',
  name: 'Annapurna Tiffins',
  kind: 'food',
  category: { id: 'c1', name: { en: 'Tiffin Centres', te: 'టిఫిన్ సెంటర్లు' }, slug: 'tiffin-centres', icon: 'coffee' },
  area: 'Market Area',
  location: { lat: 16.24, lng: 80.64 },
  photo: null,
  isVerified: false,
  isSeed: true,
  ratingAvg: 0,
  ratingCount: 0,
  isOpenNow: true,
  contact: { phone: '+91 90000 00004', whatsapp: '9000000004' },
  updatedAt: new Date().toISOString(),
  ...overrides,
});
const page = (items, metaOverrides = {}) => ok(items, { page: 1, limit: 20, total: items.length, totalPages: 1, ...metaOverrides });

afterEach(() => vi.unstubAllGlobals?.());

describe('business list', () => {
  it('shows cards with badges and one-tap contact actions', async () => {
    mockApi({ 'GET /businesses': () => page([card()]), 'GET /categories': () => ok([]) });
    renderApp('/businesses');
    const article = (await screen.findByText('Annapurna Tiffins')).closest('article');
    expect(within(article).getByText('Sample data')).toBeInTheDocument();
    expect(within(article).getByText('Open now')).toBeInTheDocument();
    expect(within(article).getByRole('link', { name: /Call - Annapurna/ })).toHaveAttribute('href', 'tel:+919000000004');
    expect(within(article).getByRole('link', { name: /WhatsApp - Annapurna/ })).toHaveAttribute('href', 'https://wa.me/919000000004');
    expect(within(article).getByRole('link', { name: /Directions - Annapurna/ }).getAttribute('href')).toContain('destination=16.24,80.64');
    expect(screen.getByText('1 business')).toBeInTheDocument();
  });

  it('applies filters through the URL and API query', async () => {
    const { calls } = mockApi({ 'GET /businesses': () => page([card()]), 'GET /categories': () => ok([]) });
    const { router } = renderApp('/businesses');
    const user = userEvent.setup();
    await screen.findByText('Annapurna Tiffins');
    await user.click(screen.getByRole('button', { name: 'Food' }));
    await user.click(screen.getByRole('button', { name: 'Open now' }));
    await waitFor(() => expect(router.state.location.search).toContain('kind=food'));
    await waitFor(() => {
      const last = calls.filter((c) => c.path === '/businesses').at(-1);
      expect(last.query).toMatchObject({ kind: 'food', openNow: 'true', page: '1', limit: '20' });
    });
  });

  it('asks for location only on "Near me" and then sorts by distance', async () => {
    const getCurrentPosition = vi.fn((success) => success({ coords: { latitude: 16.23791, longitude: 80.64441 } }));
    vi.stubGlobal('navigator', { ...navigator, geolocation: { getCurrentPosition } });
    const { calls } = mockApi({ 'GET /businesses': () => page([card({ distanceM: 420 })]), 'GET /categories': () => ok([]) });
    renderApp('/businesses');
    const user = userEvent.setup();
    await screen.findByText('Annapurna Tiffins');
    expect(getCurrentPosition).not.toHaveBeenCalled();
    await user.click(screen.getByRole('button', { name: 'Near me' }));
    await waitFor(() => {
      const last = calls.filter((c) => c.path === '/businesses').at(-1);
      expect(last.query).toMatchObject({ lat: '16.23791', lng: '80.64441', sort: 'distance' });
    });
    expect(await screen.findByText('420 m')).toBeInTheDocument();
  });

  it('shows empty and error states with retry', async () => {
    let fail = true;
    mockApi({
      'GET /businesses': () =>
        fail ? { status: 500, body: { success: false, error: { code: 'INTERNAL_ERROR', message: 'x' } } } : page([]),
      'GET /categories': () => ok([]),
    });
    renderApp('/businesses');
    const user = userEvent.setup();
    expect(await screen.findByText('Something went wrong', {}, { timeout: 4000 })).toBeInTheDocument();
    fail = false;
    await user.click(screen.getByRole('button', { name: 'Try again' }));
    expect(await screen.findByText('No businesses found')).toBeInTheDocument();
  });

  it('loads more pages', async () => {
    mockApi({
      'GET /businesses': ({ query }) =>
        query.page === '1'
          ? page([card()], { total: 2, totalPages: 2 })
          : ok([card({ id: 'b2', slug: 'second', name: 'Second Shop' })], { page: 2, limit: 20, total: 2, totalPages: 2 }),
      'GET /categories': () => ok([]),
    });
    renderApp('/businesses');
    const user = userEvent.setup();
    await user.click(await screen.findByRole('button', { name: 'Load more' }));
    expect(await screen.findByText('Second Shop')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Load more' })).toBeNull();
  });
});

describe('business detail', () => {
  const detail = (overrides = {}) => ({
    ...card(),
    description: 'Idli and dosa',
    tags: ['tiffin'],
    address: { line: 'Market Area', area: 'Market Area', pincode: '522201' },
    contact: { phone: '+91 90000 00004', whatsapp: null, email: null, website: null },
    openingHours: [{ day: 1, open: '06:00', close: '11:30', closed: false }, { day: 0, open: null, close: null, closed: true }],
    photos: [],
    verifiedAt: null,
    canManage: false,
    ...overrides,
  });

  it('shows details, hours and contact actions', async () => {
    mockApi({ 'GET /businesses/annapurna-tiffins': () => ok(detail()) });
    renderApp('/businesses/annapurna-tiffins');
    expect(await screen.findByRole('heading', { name: 'Annapurna Tiffins', level: 2 })).toBeInTheDocument();
    expect(screen.getByText('Idli and dosa')).toBeInTheDocument();
    expect(screen.getByRole('table')).toHaveTextContent('Sunday');
    expect(screen.getByRole('table')).toHaveTextContent('Closed');
    expect(screen.getByRole('link', { name: /Call - Annapurna/ })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /WhatsApp/ })).toBeNull();
    expect(screen.queryByRole('link', { name: 'Edit' })).toBeNull();
  });

  it('shows an edit link to managers and a not-found state', async () => {
    mockApi({
      'GET /businesses/annapurna-tiffins': () => ok(detail({ canManage: true, status: 'draft' })),
      'GET /businesses/missing': () => ({ status: 404, body: { success: false, error: { code: 'NOT_FOUND', message: 'x' } } }),
    });
    const { unmount } = renderApp('/businesses/annapurna-tiffins');
    expect(await screen.findByRole('link', { name: 'Edit' })).toHaveAttribute('href', '/manage/businesses/annapurna-tiffins');
    expect(screen.getByText('Draft')).toBeInTheDocument();
    unmount();
    renderApp('/businesses/missing');
    expect(await screen.findByText('Business not found')).toBeInTheDocument();
  });
});

describe('business form helpers', () => {
  const base = {
    name: ' Shop ', categoryId: 'c1', kind: 'shop', status: 'published', description: ' Hi ', tags: 'a, b, ,a',
    line: 'Road', area: 'Bose Road', pincode: '', lat: '16.2', lng: '80.6',
    phone: '', whatsapp: '', email: '', website: '', hours: hoursToRows([]), photos: [], owner: null,
  };

  it('owners send only owner-editable fields', () => {
    const p = toPayload(base, 'owner');
    expect(Object.keys(p).sort()).toEqual(['contact', 'description', 'openingHours', 'photos', 'tags']);
    expect(p.tags).toEqual(['a', 'b', 'a']);
  });

  it('admins send placement fields and only changed owners', () => {
    const created = toPayload({ ...base, owner: { id: 'u1' } }, 'admin');
    expect(created).toMatchObject({ name: 'Shop', location: { lat: 16.2, lng: 80.6 }, ownerId: 'u1' });
    const unchanged = toPayload({ ...base, owner: { id: 'u1' } }, 'admin', { ownerId: 'u1' });
    expect(unchanged.ownerId).toBeUndefined();
    const removed = toPayload({ ...base, owner: null }, 'admin', { ownerId: 'u1' });
    expect(removed.ownerId).toBeNull();
  });

  it('converts hours rows to API slots', () => {
    const rows = hoursToRows([{ day: 1, open: '09:00', close: '18:00' }, { day: 0, closed: true }]);
    expect(rowsToHours(rows)).toEqual([{ day: 1, open: '09:00', close: '18:00' }, { day: 0, closed: true }]);
  });
});

describe('admin and owner screens', () => {
  const adminRow = { id: 'b1', slug: 'shop-one', name: 'Shop One', kind: 'shop', area: 'Main Road', status: 'draft', isVerified: false, isSeed: false, owner: null, updatedAt: new Date().toISOString() };

  it('admin publishes, verifies and archives (with confirmation)', async () => {
    const { calls } = mockApi({
      'GET /auth/me': () => ok(sampleUser({ role: 'admin' })),
      'GET /admin/businesses': () => ok([adminRow], { page: 1, limit: 20, total: 1, totalPages: 1 }),
      'PATCH /businesses/b1': ({ body }) => ok({ ...adminRow, ...body }),
      'PATCH /admin/businesses/b1/verify': ({ body }) => ok({ id: 'b1', ...body }),
      'DELETE /businesses/b1': () => ok({ id: 'b1', status: 'archived' }),
    });
    renderApp('/admin/businesses');
    const user = userEvent.setup();
    await user.click(await screen.findByRole('button', { name: /Publish/ }));
    await user.click(screen.getByRole('button', { name: /^Verify/ }));
    await user.click(screen.getByRole('button', { name: /Archive/ }));
    const dialog = await screen.findByRole('dialog');
    await user.click(within(dialog).getByRole('button', { name: 'Archive' }));
    await waitFor(() => expect(calls.some((c) => c.method === 'DELETE' && c.path === '/businesses/b1')).toBe(true));
    expect(calls.find((c) => c.method === 'PATCH' && c.path === '/businesses/b1').body).toEqual({ status: 'published' });
    expect(calls.find((c) => c.path === '/admin/businesses/b1/verify').body).toEqual({ isVerified: true });
  });

  it('non-admins cannot open admin business screens', async () => {
    mockApi({ 'GET /auth/me': () => ok(sampleUser({ role: 'owner' })) });
    renderApp('/admin/businesses');
    expect(await screen.findAllByText('Not allowed')).not.toHaveLength(0);
  });

  it('owner edits only owner fields from the manage page', async () => {
    const { calls } = mockApi({
      'GET /auth/me': () => ok(sampleUser({ role: 'owner' })),
      'GET /businesses/shop-one': () =>
        ok({
          ...card({ id: 'b1', slug: 'shop-one', name: 'Shop One' }),
          description: 'Old',
          tags: [],
          address: { line: 'x', area: 'Main Road', pincode: null },
          contact: { phone: null, whatsapp: null, email: null, website: null },
          openingHours: [],
          photos: [],
          canManage: true,
          status: 'published',
        }),
      'PATCH /businesses/b1': ({ body }) => ok({ id: 'b1', ...body }),
    });
    renderApp('/manage/businesses/shop-one');
    const user = userEvent.setup();
    const desc = await screen.findByLabelText('Description');
    expect(screen.queryByLabelText('Business name')).toBeNull();
    await user.clear(desc);
    await user.type(desc, 'Fresh tiffins daily');
    await user.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(calls.some((c) => c.method === 'PATCH')).toBe(true));
    const body = calls.find((c) => c.method === 'PATCH').body;
    expect(body.description).toBe('Fresh tiffins daily');
    expect(body).not.toHaveProperty('status');
    expect(body).not.toHaveProperty('name');
  });
});
