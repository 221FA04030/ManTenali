import { describe, it, expect } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderApp } from '../../test/render.jsx';
import { mockApi, ok, sampleUser } from '../../test/mockApi.js';
import { validateForm } from '../businesses/components/BusinessForm.jsx';
import { hoursToRows } from '../businesses/components/HoursEditor.jsx';
import { buildCategoryTree } from '../categories/api.js';

const categories = [
  { id: 'food', name: { en: 'Food & Dining', te: null }, slug: 'food-dining', type: 'business', parentId: null, icon: 'utensils', sortOrder: 10, isActive: true },
  { id: 'shop', name: { en: 'Shopping', te: null }, slug: 'shopping', type: 'business', parentId: null, icon: 'shopping-bag', sortOrder: 20, isActive: true },
  { id: 'tiffin', name: { en: 'Tiffin Centres', te: null }, slug: 'tiffin-centres', type: 'business', parentId: 'food', icon: 'coffee', sortOrder: 10, isActive: true },
  { id: 'bakery', name: { en: 'Sweets & Bakery', te: null }, slug: 'sweets-bakery', type: 'business', parentId: 'food', icon: 'cake', sortOrder: 20, isActive: true },
  { id: 'footwear', name: { en: 'Footwear', te: null }, slug: 'footwear', type: 'business', parentId: 'shop', icon: 'footprints', sortOrder: 10, isActive: true },
];

const row = (overrides = {}) => ({
  id: 'b1',
  slug: 'lakshmi-tiffins',
  name: 'Lakshmi Tiffins',
  kind: 'food',
  category: { id: 'food', name: { en: 'Food & Dining' }, slug: 'food-dining' },
  subcategory: { id: 'tiffin', name: { en: 'Tiffin Centres' }, slug: 'tiffin-centres' },
  area: 'Bose Road',
  status: 'pending',
  isVerified: false,
  isSeed: false,
  owner: null,
  submittedAt: new Date().toISOString(),
  reviewedAt: null,
  rejectionReason: null,
  photo: null,
  updatedAt: new Date().toISOString(),
  ...overrides,
});

describe('category tree', () => {
  it('builds main categories with their subcategories', () => {
    const tree = buildCategoryTree(categories);
    expect(tree.map((m) => [m.slug, m.children.map((c) => c.slug)])).toEqual([
      ['food-dining', ['tiffin-centres', 'sweets-bakery']],
      ['shopping', ['footwear']],
    ]);
  });
});

describe('Add your business', () => {
  it('filters subcategories by main category, validates, and submits for review without owner/status', async () => {
    const { calls } = mockApi({
      'GET /auth/me': () => ok(sampleUser()),
      'GET /categories': () => ok(categories),
      'POST /businesses/submissions': ({ body }) => ({ status: 201, body: ok({ id: 'b1', status: body.submit ? 'pending' : 'draft' }) }),
      'GET /businesses/mine': () => ok([row()]),
    });
    const { router } = renderApp('/manage/new');
    const user = userEvent.setup();

    // client validation first
    await user.click(await screen.findByRole('button', { name: 'Submit for review' }));
    expect(await screen.findByText('Please fix the highlighted fields.')).toBeInTheDocument();
    expect(screen.getByText('Choose a subcategory.')).toBeInTheDocument();
    expect(screen.getByText('Enter a valid phone number.')).toBeInTheDocument();
    expect(calls.some((c) => c.path === '/businesses/submissions')).toBe(false);

    const sub = screen.getByLabelText('Subcategory');
    expect(sub).toBeDisabled();
    await user.selectOptions(screen.getByLabelText('Main category'), 'shop');
    expect(within(sub).getAllByRole('option').map((o) => o.textContent)).toEqual(['Choose…', 'Footwear']);
    await user.selectOptions(screen.getByLabelText('Main category'), 'food');
    expect(within(sub).getAllByRole('option').map((o) => o.textContent)).toEqual(['Choose…', 'Tiffin Centres', 'Sweets & Bakery']);
    await user.selectOptions(sub, 'tiffin');

    await user.type(screen.getByLabelText('Business name'), 'Lakshmi Tiffins');
    await user.type(screen.getByLabelText('Street / landmark'), 'Near Clock Tower');
    await user.selectOptions(screen.getByLabelText('Area'), 'Bose Road');
    await user.type(screen.getByLabelText('Phone *'), '+91 98765 43210');
    await user.click(screen.getByRole('button', { name: 'Submit for review' }));

    await waitFor(() => expect(router.state.location.pathname).toBe('/manage'));
    const body = calls.find((c) => c.path === '/businesses/submissions').body;
    expect(body).toMatchObject({
      name: 'Lakshmi Tiffins',
      categoryId: 'food',
      subcategoryId: 'tiffin',
      address: { line: 'Near Clock Tower', area: 'Bose Road', pincode: '' },
      contact: { phone: '+91 98765 43210' },
      submit: true,
    });
    for (const forbidden of ['status', 'ownerId', 'kind', 'isVerified']) expect(body).not.toHaveProperty(forbidden);
  });

  it('requires sign-in', async () => {
    const { router } = renderApp('/manage/new');
    await waitFor(() => expect(router.state.location.pathname).toBe('/login'));
  });
});

describe('My Businesses', () => {
  it('shows status, the rejection reason and lets the owner resubmit', async () => {
    const { calls } = mockApi({
      'GET /auth/me': () => ok(sampleUser()),
      'GET /businesses/mine': () =>
        ok([
          row({ id: 'b1', status: 'rejected', rejectionReason: 'Please add a shop front photo.' }),
          row({ id: 'b2', name: 'Draft Place', status: 'draft' }),
          row({ id: 'b3', name: 'Live Place', status: 'published' }),
          row({ id: 'b4', name: 'Waiting Place', status: 'pending' }),
        ]),
      'POST /businesses/b1/submit': () => ok(row({ status: 'pending' })),
    });
    renderApp('/manage');
    const user = userEvent.setup();
    const rejected = (await screen.findByText('Lakshmi Tiffins')).closest('li');
    expect(within(rejected).getByText('Rejected')).toBeInTheDocument();
    expect(within(rejected).getByText('Please add a shop front photo.')).toBeInTheDocument();
    expect(within(screen.getByText('Draft Place').closest('li')).getByText('Draft')).toBeInTheDocument();
    expect(within(screen.getByText('Live Place').closest('li')).getByText('Approved')).toBeInTheDocument();
    const waiting = screen.getByText('Waiting Place').closest('li');
    expect(within(waiting).getByText('Pending review')).toBeInTheDocument();
    expect(within(waiting).queryByRole('button', { name: /Submit|Resubmit/ })).toBeNull();

    await user.click(within(rejected).getByRole('button', { name: /Resubmit/ }));
    await waitFor(() => expect(calls.some((c) => c.path === '/businesses/b1/submit')).toBe(true));
  });

  it('approved listings lock name, category and address for the owner', async () => {
    mockApi({
      'GET /auth/me': () => ok(sampleUser({ role: 'owner' })),
      'GET /businesses/mine/b3': () =>
        ok({
          ...row({ id: 'b3', status: 'published' }),
          description: '',
          tags: [],
          address: { line: 'Bose Road', area: 'Bose Road', pincode: null },
          location: { lat: 16.24, lng: 80.64 },
          contact: { phone: '+91 98765 43210', whatsapp: null, email: null, website: null },
          openingHours: [],
          photos: [],
          canManage: true,
        }),
    });
    renderApp('/manage/businesses/b3');
    expect(await screen.findByLabelText('Description')).toBeInTheDocument();
    expect(screen.queryByLabelText('Business name')).toBeNull();
    expect(screen.queryByLabelText('Main category')).toBeNull();
    expect(screen.queryByLabelText('Street / landmark')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Submit for review' })).toBeNull();
  });
});

describe('admin review', () => {
  const detail = {
    ...row(),
    description: 'Idli and dosa',
    tags: [],
    address: { line: 'Near Clock Tower', area: 'Bose Road', pincode: '522201' },
    location: { lat: 16.24, lng: 80.64 },
    contact: { phone: '+91 98765 43210', whatsapp: null, email: null, website: null },
    openingHours: [],
    photos: [],
    canManage: true,
    owner: { id: 'u9', name: 'Ravi' },
    reviewedBy: null,
  };

  it('requires a rejection reason before rejecting', async () => {
    const { calls } = mockApi({
      'GET /auth/me': () => ok(sampleUser({ role: 'admin' })),
      'GET /admin/submissions/b1': () => ok(detail),
      'POST /admin/submissions/b1/reject': ({ body }) => ok({ ...detail, status: 'rejected', rejectionReason: body.reason }),
      'GET /admin/submissions': () => ok([], { page: 1, limit: 20, total: 0, totalPages: 0 }),
    });
    const { router } = renderApp('/admin/submissions/b1');
    const user = userEvent.setup();
    expect(await screen.findByText('Idli and dosa')).toBeInTheDocument();
    expect(screen.getByText('Ravi')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /Reject/ }));
    const dialog = await screen.findByRole('dialog');
    await user.click(within(dialog).getByRole('button', { name: 'Reject' }));
    expect(await within(dialog).findByText('Please give a reason (at least 5 characters).')).toBeInTheDocument();
    expect(calls.some((c) => c.path === '/admin/submissions/b1/reject')).toBe(false);

    await user.type(within(dialog).getByLabelText('Reason (shown to the owner)'), 'Please add a shop front photo.');
    await user.click(within(dialog).getByRole('button', { name: 'Reject' }));
    await waitFor(() => expect(router.state.location.pathname).toBe('/admin/submissions'));
    expect(calls.find((c) => c.path === '/admin/submissions/b1/reject').body).toEqual({ reason: 'Please add a shop front photo.' });
  });

  it('approves a pending submission from the queue', async () => {
    const { calls } = mockApi({
      'GET /auth/me': () => ok(sampleUser({ role: 'admin' })),
      'GET /admin/submissions': ({ query }) =>
        ok(query.status === 'pending' ? [row({ owner: { id: 'u9', name: 'Ravi' } })] : [], { page: 1, limit: 20, total: 1, totalPages: 1 }),
      'GET /admin/submissions/b1': () => ok(detail),
      'POST /admin/submissions/b1/approve': () => ok({ ...detail, status: 'published' }),
    });
    renderApp('/admin/submissions');
    const user = userEvent.setup();
    await user.click(await screen.findByRole('link', { name: /Lakshmi Tiffins/ }));
    await user.click(await screen.findByRole('button', { name: /Approve/ }));
    await waitFor(() => expect(calls.some((c) => c.path === '/admin/submissions/b1/approve')).toBe(true));
  });

  it('non-admins cannot open the review screens', async () => {
    mockApi({ 'GET /auth/me': () => ok(sampleUser({ role: 'owner' })) });
    renderApp('/admin/submissions');
    expect(await screen.findAllByText('Not allowed')).not.toHaveLength(0);
  });
});

describe('admin categories', () => {
  it('adds a subcategory under a main category and deactivates a category', async () => {
    const { calls } = mockApi({
      'GET /auth/me': () => ok(sampleUser({ role: 'admin' })),
      'GET /categories': () => ok(categories),
      'POST /categories': ({ body }) => ({ status: 201, body: ok({ id: 'new', ...body }) }),
      'PATCH /categories/:id': ({ body }) => ok({ ...categories[3], ...body }),
    });
    renderApp('/admin/categories');
    const user = userEvent.setup();
    const food = (await screen.findByText('Food & Dining')).closest('li');
    await user.click(within(food).getByRole('button', { name: /Add subcategory/ }));
    const dialog = await screen.findByRole('dialog');
    await user.type(within(dialog).getByLabelText('Name (English)'), 'Street Food');
    await user.click(within(dialog).getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(calls.some((c) => c.method === 'POST' && c.path === '/categories')).toBe(true));
    expect(calls.find((c) => c.method === 'POST').body).toEqual({ name: { en: 'Street Food' }, type: 'business', parentId: 'food' });

    await user.click(screen.getByRole('button', { name: 'Deactivate Sweets & Bakery' }));
    await waitFor(() => expect(calls.some((c) => c.method === 'PATCH' && c.path === '/categories/bakery')).toBe(true));
    expect(calls.find((c) => c.method === 'PATCH').body).toEqual({ isActive: false });
    expect(calls.find((c) => c.path === '/categories').query).toEqual({ type: 'business', includeInactive: 'true' });
  });
});

describe('form validation', () => {
  it('mirrors the server rules per mode', () => {
    const base = {
      name: 'Shop', categoryId: 'food', subcategoryId: 'tiffin', line: 'Bose Road', area: 'Bose Road', pincode: '',
      lat: 16.2, lng: 80.6, phone: '+91 98765 43210', whatsapp: '', website: '', hours: hoursToRows([]),
    };
    expect(validateForm(base, 'submission')).toEqual({});
    expect(validateForm({ ...base, phone: '' }, 'submission')).toHaveProperty(['contact.phone']);
    expect(validateForm({ ...base, phone: '' }, 'owner')).toEqual({});
    expect(validateForm({ ...base, subcategoryId: '' }, 'admin')).toHaveProperty('subcategoryId');
    expect(validateForm({ ...base, pincode: '123' }, 'submission')).toHaveProperty(['address.pincode']);
    const hours = hoursToRows([]);
    hours[0] = { ...hours[0], open: '09:00', close: '' };
    expect(validateForm({ ...base, hours }, 'owner')).toHaveProperty('openingHours');
  });
});
