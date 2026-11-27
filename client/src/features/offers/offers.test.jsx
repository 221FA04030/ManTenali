import { describe, it, expect, vi, afterEach } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderApp } from '../../test/render.jsx';
import { mockApi, ok, sampleUser } from '../../test/mockApi.js';
import i18n from '../../app/i18n.js';
import { endsIn, formatIsoDate, istToday, addOneYear } from '../../lib/dates.js';
import { validateOffer, offerPayload, offerToState } from './components/OfferForm.jsx';

const DAY = 86_400_000;
const day = (n) => istToday(new Date(Date.now() + n * DAY));

const offer = (overrides = {}) => ({
  id: 'o1',
  businessId: 'b1',
  business: { id: 'b1', name: 'Annapurna Tiffins', slug: 'annapurna', area: 'Market Area' },
  title: 'Free coffee with any dosa',
  description: 'Every morning this week.',
  discountLabel: 'Free coffee',
  couponCode: null,
  terms: 'One coffee per bill. Dine-in only.',
  redemptionInstructions: 'Show this offer at the counter.',
  image: null,
  validFromDate: day(-1),
  validToDate: day(3),
  isSeed: false,
  canManage: false,
  ...overrides,
});
const page = (items, meta = {}) => ok(items, { page: 1, limit: 20, total: items.length, totalPages: 1, ...meta });

afterEach(() => vi.unstubAllGlobals?.());

describe('date helpers (IST)', () => {
  it('counts calendar days in Tenali time', () => {
    const now = new Date('2026-11-25T23:30:00+05:30'); // still the 25th in IST, already the 25th 18:00 UTC
    expect(istToday(now)).toBe('2026-11-25');
    expect(endsIn('2026-11-25', now)).toEqual({ key: 'offers.endsToday', count: 0 });
    expect(endsIn('2026-11-26', now)).toEqual({ key: 'offers.endsTomorrow', count: 1 });
    expect(endsIn('2026-11-30', now)).toEqual({ key: 'offers.endsInDays', count: 5 });
    expect(istToday(new Date('2026-11-25T19:00:00Z'))).toBe('2026-11-26'); // 00:30 IST next day
    expect(formatIsoDate('2026-11-30', 'en')).toBe('30 Nov 2026');
  });
});

describe('/offers feed', () => {
  it('renders offer cards with business and countdown, and sends filters to the API', async () => {
    const { calls } = mockApi({
      'GET /offers': () => page([offer()]),
      'GET /categories': () =>
        ok([{ id: 'food', name: { en: 'Food & Dining' }, slug: 'food-dining', type: 'business', parentId: null, sortOrder: 1, isActive: true }]),
    });
    const { router } = renderApp('/offers');
    const user = userEvent.setup();
    const card = (await screen.findByText('Free coffee with any dosa')).closest('a');
    expect(card).toHaveAttribute('href', '/offers/o1');
    expect(within(card).getByText('Free coffee')).toBeInTheDocument();
    expect(within(card).getByText('Annapurna Tiffins')).toBeInTheDocument();
    expect(within(card).getByText('Market Area')).toBeInTheDocument();
    expect(within(card).getByText('Ends in 3 days')).toBeInTheDocument();
    expect(screen.getByText('1 offer')).toBeInTheDocument();

    await user.click(await screen.findByRole('button', { name: 'Food & Dining' }));
    await user.selectOptions(screen.getByLabelText('Sort'), 'newest');
    await user.selectOptions(screen.getByLabelText('Area'), 'Bose Road');
    await waitFor(() => expect(router.state.location.search).toContain('sort=newest'));
    await waitFor(() => {
      const last = calls.filter((c) => c.path === '/offers').at(-1);
      expect(last.query).toMatchObject({ categoryId: 'food', sort: 'newest', area: 'Bose Road', page: '1', limit: '20' });
    });
  });

  it('shows empty and error states with retry, and supports load more', async () => {
    let mode = 'error';
    mockApi({
      'GET /offers': ({ query }) => {
        if (mode === 'error') return { status: 500, body: { success: false, error: { code: 'INTERNAL_ERROR', message: 'x' } } };
        if (mode === 'empty') return page([]);
        return query.page === '1'
          ? page([offer()], { total: 2, totalPages: 2 })
          : ok([offer({ id: 'o2', title: 'Second offer' })], { page: 2, limit: 20, total: 2, totalPages: 2 });
      },
      'GET /categories': () => ok([]),
    });
    const { unmount } = renderApp('/offers');
    const user = userEvent.setup();
    expect(await screen.findByText('Something went wrong')).toBeInTheDocument();
    mode = 'empty';
    await user.click(screen.getByRole('button', { name: 'Try again' }));
    expect(await screen.findByText('No offers right now')).toBeInTheDocument();
    unmount();

    mode = 'pages';
    renderApp('/offers');
    await user.click(await screen.findByRole('button', { name: 'Load more' }));
    expect(await screen.findByText('Second offer')).toBeInTheDocument();
  });

  it('shows Telugu labels when the language is Telugu', async () => {
    mockApi({ 'GET /offers': () => page([offer({ validToDate: day(0) })]), 'GET /categories': () => ok([]) });
    await i18n.changeLanguage('te');
    renderApp('/offers');
    expect(await screen.findByText('ఈ రోజు ముగుస్తుంది')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'ఆఫర్లు & డీల్స్' })).toBeInTheDocument();
  });
});

describe('offer detail', () => {
  it('shows description, terms, redemption, IST validity, business link and copies the coupon', async () => {
    mockApi({
      'GET /offers/o1': () =>
        ok(offer({ couponCode: 'TENALI15', validFromDate: '2026-11-01', validToDate: '2026-11-30' })),
    });
    renderApp('/offers/o1');
    const user = userEvent.setup();
    expect(await screen.findByRole('heading', { name: 'Free coffee with any dosa' })).toBeInTheDocument();
    expect(screen.getByText('Every morning this week.')).toBeInTheDocument();
    expect(screen.getByText('One coffee per bill. Dine-in only.')).toBeInTheDocument();
    expect(screen.getByText('Show this offer at the counter.')).toBeInTheDocument();
    expect(screen.getByText('Valid 1 Nov 2026 – 30 Nov 2026 (IST)')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Annapurna Tiffins/ })).toHaveAttribute('href', '/businesses/annapurna');
    expect(screen.queryByRole('link', { name: 'Edit offer' })).toBeNull();

    expect(screen.getByTestId('coupon-code')).toHaveTextContent('TENALI15');
    await user.click(screen.getByRole('button', { name: 'Copy' }));
    // user-event provides the clipboard: read back what the app copied
    expect(await navigator.clipboard.readText()).toBe('TENALI15');
    expect(await screen.findByText('Coupon code copied')).toBeInTheDocument();
  });

  it('shows a friendly message for ended or hidden offers', async () => {
    mockApi({ 'GET /offers/gone': () => ({ status: 404, body: { success: false, error: { code: 'NOT_FOUND', message: 'x' } } }) });
    renderApp('/offers/gone');
    expect(await screen.findByText('Offer not available')).toBeInTheDocument();
  });
});

describe('business page offers section', () => {
  const business = {
    id: 'b1', slug: 'annapurna', name: 'Annapurna Tiffins', kind: 'shop', category: null, subcategory: null, description: '', tags: [],
    address: { line: 'x', area: 'Market Area', pincode: null }, location: null,
    contact: { phone: null, whatsapp: null, email: null, website: null }, openingHours: [], photos: [],
    isVerified: false, isSeed: false, ratingAvg: 0, ratingCount: 0, updatedAt: new Date().toISOString(), canManage: false, food: null,
  };

  it('loads offers from /businesses/:id/offers with a small limit and links to all of them', async () => {
    const { calls } = mockApi({
      'GET /businesses/annapurna': () => ok(business),
      'GET /businesses/b1/offers': () => ok([offer(), offer({ id: 'o2', title: 'Second' }), offer({ id: 'o3', title: 'Third' })], { total: 5, limit: 3 }),
    });
    renderApp('/businesses/annapurna');
    expect(await screen.findByRole('heading', { name: 'Offers' })).toBeInTheDocument();
    expect(screen.getByText('Second')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /View all 5 offers/ })).toHaveAttribute('href', '/offers?businessId=b1');
    expect(calls.find((c) => c.path === '/businesses/b1/offers').query).toEqual({ limit: '3' });
  });

  it('is hidden for visitors when the business has no active offers', async () => {
    mockApi({ 'GET /businesses/annapurna': () => ok(business), 'GET /businesses/b1/offers': () => ok([], { total: 0, limit: 3 }) });
    renderApp('/businesses/annapurna');
    expect(await screen.findByRole('heading', { name: 'Annapurna Tiffins', level: 2 })).toBeInTheDocument();
    await waitFor(() => expect(screen.queryByRole('heading', { name: 'Offers' })).toBeNull());
  });
});

describe('owner and admin offer management', () => {
  const managed = (overrides = {}) => ({
    business: { id: 'b1', name: 'Annapurna Tiffins', slug: 'annapurna', area: 'Market Area', status: 'published' },
    canCreate: true,
    limit: 10,
    activeOrScheduled: 2,
    items: [
      offer({ id: 'd1', title: 'Draft offer', status: 'draft', displayStatus: 'draft', canManage: true }),
      offer({ id: 'l1', title: 'Live offer', status: 'published', displayStatus: 'live', canManage: true }),
      offer({ id: 's1', title: 'Scheduled offer', status: 'published', displayStatus: 'scheduled', canManage: true }),
      offer({ id: 'e1', title: 'Expired offer', status: 'published', displayStatus: 'expired', canManage: true }),
      offer({ id: 'h1', title: 'Hidden offer', status: 'hidden', displayStatus: 'hidden', canManage: true }),
    ],
    ...overrides,
  });

  it('groups offers by status and supports hide and publish', async () => {
    const { calls } = mockApi({
      'GET /auth/me': () => ok(sampleUser({ role: 'owner' })),
      'GET /offers/mine': () => ok(managed()),
      'DELETE /offers/l1': () => ok({ id: 'l1', status: 'hidden' }),
      'PATCH /offers/d1': ({ body }) => ok(offer({ id: 'd1', ...body })),
    });
    renderApp('/manage/businesses/b1/offers');
    const user = userEvent.setup();
    const headings = (await screen.findAllByRole('heading', { level: 2 })).map((h) => h.textContent);
    expect(headings).toEqual(expect.arrayContaining(['Draft (1)', 'Live (1)', 'Scheduled (1)', 'Expired (1)', 'Hidden (1)']));
    expect(headings.indexOf('Draft (1)')).toBeLessThan(headings.indexOf('Live (1)'));
    expect(screen.getByText('2 of 10 live or scheduled offers in use.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Hide Hidden offer' })).toBeNull();

    await user.click(screen.getByRole('button', { name: 'Hide Live offer' }));
    await user.click(screen.getByRole('button', { name: 'Publish Draft offer' }));
    await waitFor(() => expect(calls.some((c) => c.method === 'DELETE' && c.path === '/offers/l1')).toBe(true));
    await waitFor(() => expect(calls.find((c) => c.method === 'PATCH')?.body).toEqual({ status: 'published' }));
    expect(calls.find((c) => c.path === '/offers/mine').query).toEqual({ businessId: 'b1' });
  });

  it('explains when the business is not published yet', async () => {
    mockApi({
      'GET /auth/me': () => ok(sampleUser({ role: 'owner' })),
      'GET /offers/mine': () => ok(managed({ canCreate: false, items: [], business: { id: 'b1', name: 'New Shop', status: 'pending' } })),
    });
    renderApp('/manage/businesses/b1/offers');
    expect(await screen.findByText('Offers can be added once the business is approved and published.')).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'New offer' })).toBeNull();
  });

  it('another owner’s business shows not found (the server returns 404)', async () => {
    mockApi({
      'GET /auth/me': () => ok(sampleUser({ role: 'owner' })),
      'GET /offers/mine': () => ({ status: 404, body: { success: false, error: { code: 'NOT_FOUND', message: 'x' } } }),
    });
    renderApp('/manage/businesses/other/offers');
    expect(await screen.findByText('Business not found')).toBeInTheDocument();
  });

  it('regular users cannot open offer management', async () => {
    mockApi({ 'GET /auth/me': () => ok(sampleUser({ role: 'user' })) });
    renderApp('/manage/businesses/b1/offers');
    expect(await screen.findAllByText('Not allowed')).not.toHaveLength(0);
  });

  it('new offer form validates and publishes with the right payload', async () => {
    const { calls } = mockApi({
      'GET /auth/me': () => ok(sampleUser({ role: 'owner' })),
      'GET /offers/mine': () => ok(managed({ items: [] })),
      'POST /offers': ({ body }) => ({ status: 201, body: ok(offer({ ...body, id: 'n1', status: body.status })) }),
    });
    const { router } = renderApp('/manage/businesses/b1/offers/new');
    const user = userEvent.setup();
    await user.click(await screen.findByRole('button', { name: 'Publish' }));
    expect(await screen.findByText('Enter a title (at least 3 characters).')).toBeInTheDocument();
    expect(screen.getByText('Enter the terms (at least 10 characters).')).toBeInTheDocument();
    expect(calls.some((c) => c.method === 'POST')).toBe(false);

    await user.type(screen.getByLabelText('Offer title *'), '20% off sweets');
    await user.type(screen.getByLabelText('Discount label *'), '20% off');
    await user.type(screen.getByLabelText('Terms & conditions *'), 'Valid above Rs 200 only.');
    await user.type(screen.getByLabelText('Coupon code (optional)'), 'sweet20');
    const end = screen.getByLabelText('End date *');
    await user.clear(end);
    await user.type(end, day(5));
    await user.click(screen.getByRole('button', { name: 'Publish' }));

    await waitFor(() => expect(router.state.location.pathname).toBe('/manage/businesses/b1/offers'));
    expect(calls.find((c) => c.method === 'POST').body).toEqual({
      businessId: 'b1',
      title: '20% off sweets',
      discountLabel: '20% off',
      description: '',
      couponCode: 'SWEET20',
      terms: 'Valid above Rs 200 only.',
      redemptionInstructions: '',
      validFrom: day(0),
      validTo: day(5),
      status: 'published',
    });
  });

  it('admins reach offer management from the admin business list', async () => {
    mockApi({
      'GET /auth/me': () => ok(sampleUser({ role: 'admin' })),
      'GET /admin/businesses': () =>
        ok([{ id: 'b9', slug: 'shop', name: 'Any Shop', status: 'published', isVerified: false, isSeed: false, owner: null, updatedAt: new Date().toISOString() }], {
          page: 1, limit: 20, total: 1, totalPages: 1,
        }),
    });
    renderApp('/admin/businesses');
    const card = (await screen.findByText('Any Shop')).closest('li');
    expect(within(card).getByRole('link', { name: /Offers/ })).toHaveAttribute('href', '/manage/businesses/b9/offers');
  });
});

describe('offer form rules', () => {
  const base = { ...offerToState(), title: 'Big sale', discountLabel: '10% off', terms: 'Terms apply to all items.', validFrom: '2026-11-25', validTo: '2026-11-30' };
  const today = '2026-11-25';

  it('checks dates, coupon format and required fields', () => {
    expect(validateOffer(base, undefined, today)).toEqual({});
    expect(validateOffer({ ...base, validTo: '2026-11-24' }, undefined, today)).toEqual({ validTo: 'offers.v.endBeforeStart' });
    expect(validateOffer({ ...base, validTo: addOneYear('2026-11-25') }, undefined, today)).toEqual({ validTo: 'offers.v.maxYear' });
    expect(validateOffer({ ...base, validFrom: '2026-11-01', validTo: '2026-11-20' }, undefined, today)).toEqual({ validTo: 'offers.v.endPast' });
    // editing an offer whose (unchanged) end date has passed is allowed
    expect(validateOffer({ ...base, validFrom: '2026-11-01', validTo: '2026-11-20' }, { validToDate: '2026-11-20' }, today)).toEqual({});
    expect(validateOffer({ ...base, couponCode: 'bad code!' }, undefined, today)).toEqual({ couponCode: 'offers.v.coupon' });
    expect(validateOffer({ ...base, validTo: '2026-02-30' }, undefined, today)).toEqual({ validTo: 'offers.v.date' });
  });

  it('clears coupon and image on edit, and omits them on create', () => {
    expect(offerPayload({ ...base }, { businessId: 'b1', status: 'draft' })).not.toHaveProperty('couponCode');
    const edit = offerPayload({ ...base }, { original: { id: 'o1' } });
    expect(edit).toMatchObject({ couponCode: null, image: null });
    expect(edit).not.toHaveProperty('businessId');
    expect(edit).not.toHaveProperty('status');
  });
});
