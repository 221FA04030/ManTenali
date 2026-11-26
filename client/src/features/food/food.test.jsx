import { describe, it, expect } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderApp } from '../../test/render.jsx';
import { mockApi, ok, sampleUser } from '../../test/mockApi.js';
import { stateToFood, validateFood, foodToState } from './components/FoodFieldsEditor.jsx';

const menu = [
  { section: 'Tiffins', items: [{ name: 'Idli (2)', price: 30, isVeg: true }, { name: 'Egg Dosa', price: 60, isVeg: false }] },
  { section: 'Beverages', items: [{ name: 'Filter Coffee', price: 20, isVeg: true }] },
];

const card = (overrides = {}) => ({
  id: 'b1',
  slug: 'annapurna',
  name: 'Annapurna Tiffins',
  kind: 'food',
  category: { id: 'food', name: { en: 'Food & Dining' }, slug: 'food-dining' },
  subcategory: { id: 'tiffin', name: { en: 'Tiffin Centres' }, slug: 'tiffin-centres', icon: 'coffee' },
  area: 'Market Area',
  location: { lat: 16.24, lng: 80.64 },
  photo: null,
  isVerified: true,
  isSeed: false,
  ratingAvg: 0,
  ratingCount: 0,
  isOpenNow: true,
  contact: { phone: '+91 90000 00004', whatsapp: null },
  priceRange: 1,
  food: { cuisines: ['south-indian', 'andhra'], isVegFriendly: true },
  updatedAt: new Date().toISOString(),
  ...overrides,
});
const page = (items) => ok(items, { page: 1, limit: 20, total: items.length, totalPages: 1 });

describe('/food listing (FR-FOOD-2)', () => {
  it('lists food businesses with price range, cuisines and veg-friendly, and filters through the API', async () => {
    const { calls } = mockApi({ 'GET /businesses': () => page([card()]), 'GET /categories': () => ok([]) });
    const { router } = renderApp('/food');
    const user = userEvent.setup();

    const article = (await screen.findByText('Annapurna Tiffins')).closest('article');
    expect(within(article).getByText('South Indian, Andhra')).toBeInTheDocument();
    expect(within(article).getByText('Veg-friendly')).toBeInTheDocument();
    expect(within(article).getByText('Budget')).toBeInTheDocument(); // price range label (screen readers)
    expect(screen.getByRole('heading', { name: 'Food & Restaurants' })).toBeInTheDocument();
    // kind is fixed: no kind chips
    expect(screen.queryByRole('group', { name: 'Type' })).toBeNull();

    await user.click(screen.getByRole('button', { name: 'Biryani' }));
    await user.click(screen.getByRole('button', { name: 'Moderate' }));
    await user.click(screen.getByRole('button', { name: 'Veg-friendly' }));
    await waitFor(() => expect(router.state.location.search).toContain('isVegFriendly=true'));
    await waitFor(() => {
      const last = calls.filter((c) => c.path === '/businesses').at(-1);
      expect(last.query).toMatchObject({ kind: 'food', cuisine: 'biryani', priceRange: '2', isVegFriendly: 'true' });
    });
  });

  it('the Home "Food & Dining" tile opens /food', async () => {
    mockApi({ 'GET /businesses': () => page([]), 'GET /categories': () => ok([]) });
    const { router } = renderApp('/');
    const user = userEvent.setup();
    await user.click(await screen.findByRole('link', { name: /Food & Dining/ }));
    await waitFor(() => expect(router.state.location.pathname).toBe('/food'));
    expect(await screen.findByText('No businesses found')).toBeInTheDocument();
  });
});

describe('menu on the business page (FR-FOOD-1)', () => {
  const detail = {
    ...card(),
    description: '',
    tags: [],
    address: { line: 'Market Area', area: 'Market Area', pincode: null },
    contact: { phone: '+91 90000 00004', whatsapp: null, email: null, website: null },
    openingHours: [],
    photos: [],
    canManage: false,
    food: { cuisines: ['south-indian'], isVegFriendly: true, menu },
  };

  it('shows sections, rupee prices and veg/non-veg marks, with a veg-only toggle', async () => {
    mockApi({ 'GET /businesses/annapurna': () => ok(detail) });
    renderApp('/businesses/annapurna');
    const user = userEvent.setup();
    expect(await screen.findByRole('heading', { name: 'Menu' })).toBeInTheDocument();
    const tiffins = screen.getByRole('region', { name: 'Tiffins' });
    expect(within(tiffins).getByText('Idli (2)')).toBeInTheDocument();
    expect(within(tiffins).getByText('₹30')).toBeInTheDocument();
    expect(within(tiffins).getByRole('img', { name: 'Non-veg' })).toBeInTheDocument();
    expect(screen.getAllByRole('img', { name: 'Veg' })).toHaveLength(2);
    expect(screen.getByText('South Indian')).toBeInTheDocument();

    await user.click(screen.getByLabelText('Show veg items only'));
    expect(screen.queryByText('Egg Dosa')).toBeNull();
    expect(screen.getByText('Idli (2)')).toBeInTheDocument();
  });

  it('non-food businesses show no menu section', async () => {
    mockApi({ 'GET /businesses/annapurna': () => ok({ ...detail, kind: 'shop', food: null, priceRange: null }) });
    renderApp('/businesses/annapurna');
    expect(await screen.findByRole('heading', { name: 'Annapurna Tiffins', level: 2 })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Menu' })).toBeNull();
  });
});

describe('editing food details', () => {
  const mine = {
    ...card({ status: 'published' }),
    description: '',
    tags: [],
    address: { line: 'Market Area', area: 'Market Area', pincode: null },
    contact: { phone: '+91 90000 00004', whatsapp: null, email: null, website: null },
    openingHours: [],
    photos: [],
    canManage: true,
    food: { cuisines: ['south-indian'], isVegFriendly: true, menu: [] },
  };

  it('an owner adds a menu section and item; the payload carries food details', async () => {
    const { calls } = mockApi({
      'GET /auth/me': () => ok(sampleUser({ role: 'owner' })),
      'GET /categories': () => ok([]),
      'GET /businesses/mine/b1': () => ok(mine),
      'PATCH /businesses/b1': ({ body }) => ok({ ...mine, ...body }),
    });
    renderApp('/manage/businesses/b1');
    const user = userEvent.setup();
    await user.click(await screen.findByRole('button', { name: 'Add menu section' }));
    // an item without a section name is reported (completely blank rows are simply ignored)
    await user.type(screen.getByLabelText('Item 1 name'), 'Andhra Meals');
    await user.type(screen.getByLabelText('Item 1 price'), '120');
    await user.click(screen.getByRole('button', { name: 'Save' }));
    expect(await screen.findByText('Give each menu section a name.')).toBeInTheDocument();
    expect(calls.some((c) => c.method === 'PATCH')).toBe(false);

    await user.type(screen.getByLabelText('Section 1'), 'Meals');
    await user.click(screen.getByRole('button', { name: 'Biryani' }));
    await user.selectOptions(screen.getByLabelText('Price range'), '2');
    await user.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => expect(calls.some((c) => c.method === 'PATCH')).toBe(true));
    const body = calls.find((c) => c.method === 'PATCH').body;
    expect(body.priceRange).toBe(2);
    expect(body.food).toEqual({
      cuisines: ['south-indian', 'biryani'],
      isVegFriendly: true,
      menu: [{ section: 'Meals', items: [{ name: 'Andhra Meals', price: 120, isVeg: true }] }],
    });
  });

  it('food fields appear in the submission form only for the Food & Dining category', async () => {
    mockApi({
      'GET /auth/me': () => ok(sampleUser()),
      'GET /categories': () =>
        ok([
          { id: 'food', name: { en: 'Food & Dining' }, slug: 'food-dining', type: 'business', parentId: null, sortOrder: 1, isActive: true },
          { id: 'shop', name: { en: 'Shopping' }, slug: 'shopping', type: 'business', parentId: null, sortOrder: 2, isActive: true },
        ]),
    });
    renderApp('/manage/new');
    const user = userEvent.setup();
    const main = await screen.findByLabelText('Main category');
    await screen.findByRole('option', { name: 'Food & Dining' });
    expect(screen.queryByText('Food details')).toBeNull();
    await user.selectOptions(main, 'food');
    expect(await screen.findByText('Food details')).toBeInTheDocument();
    await user.selectOptions(main, 'shop');
    expect(screen.queryByText('Food details')).toBeNull();
  });
});

describe('food form helpers', () => {
  it('converts editor state and drops blank rows', () => {
    const s = foodToState({ priceRange: 2, food: { cuisines: ['cafe'], isVegFriendly: false, menu } });
    expect(s.menu[0].items[0]).toEqual({ name: 'Idli (2)', price: '30', isVeg: true });
    s.menu[0].items.push({ name: '', price: '', isVeg: true });
    expect(stateToFood(s)).toEqual({ priceRange: 2, food: { cuisines: ['cafe'], isVegFriendly: false, menu } });
    expect(stateToFood({ ...s, priceRange: '' }).priceRange).toBeNull();
  });

  it('validates sections, names and prices', () => {
    const base = { priceRange: '', cuisines: [], isVegFriendly: false };
    expect(validateFood({ ...base, menu: [] })).toBeNull();
    expect(validateFood({ ...base, menu: [{ section: '', items: [{ name: 'Tea', price: '10', isVeg: true }] }] })).toBe('food.v.section');
    expect(validateFood({ ...base, menu: [{ section: 'Drinks', items: [{ name: '', price: '10', isVeg: true }] }] })).toBe('food.v.itemName');
    expect(validateFood({ ...base, menu: [{ section: 'Drinks', items: [{ name: 'Tea', price: '-1', isVeg: true }] }] })).toBe('food.v.price');
    expect(validateFood({ ...base, menu: [{ section: 'Drinks', items: [{ name: 'Tea', price: 'abc', isVeg: true }] }] })).toBe('food.v.price');
  });
});
