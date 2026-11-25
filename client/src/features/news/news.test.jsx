import { describe, it, expect } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderApp } from '../../test/render.jsx';
import { mockApi, ok, sampleUser } from '../../test/mockApi.js';
import i18n from '../../app/i18n.js';
import { validateNews, newsPayload, newsToState } from './components/NewsForm.jsx';

const cat = { id: 'c1', name: { en: 'Civic', te: 'పౌర' }, slug: 'civic', type: 'news', parentId: null, sortOrder: 1, isActive: true };

const item = (o = {}) => ({
  id: 'n1',
  slug: 'water-cut-ward-12',
  title: 'No water supply in ward 12',
  summary: 'Pipeline repair: no supply from 6 am to 11 am.',
  type: 'water',
  category: { id: 'c1', name: cat.name, slug: 'civic' },
  coverImage: null,
  sourceName: 'Municipal water works',
  sourceUrl: null,
  publishedAt: '2026-11-25T04:00:00.000Z',
  updatedAt: '2026-11-25T04:00:00.000Z',
  validUntil: '2026-11-26T05:30:00.000Z',
  validUntilLocal: '2026-11-26T11:00',
  isPinned: false,
  isExpired: false,
  isSeed: false,
  ...o,
});
const page = (items, meta = {}) => ok(items, { page: 1, limit: 20, total: items.length, totalPages: 1, ...meta });

describe('news form rules', () => {
  const base = () => ({ ...newsToState(), title: 'Road closed', summary: 'Bose Road closed for repairs today.', sourceName: 'Traffic police' });
  const now = new Date('2026-11-25T10:00:00+05:30');

  it('requires headline, summary and source; checks the link and the "show until" time (IST)', () => {
    expect(validateNews(base(), { now })).toEqual({});
    expect(validateNews({ ...base(), title: 'x', summary: 'short', sourceName: '' }, { now })).toEqual({ title: 'news.v.title', summary: 'news.v.summary', sourceName: 'news.v.source' });
    expect(validateNews({ ...base(), sourceUrl: 'http://x.com' }, { now }).sourceUrl).toBe('news.v.sourceUrl');
    expect(validateNews({ ...base(), validUntil: '2026-11-25T09:59' }, { now }).validUntil).toBe('news.v.validUntilPast');
    expect(validateNews({ ...base(), validUntil: '2026-11-25T10:30' }, { now })).toEqual({});
    expect(validateNews({ ...base(), validUntil: '2028-01-01T10:00' }, { now }).validUntil).toBe('news.v.validUntilFar');
    // an expired notice can still be edited when its time is unchanged
    expect(validateNews({ ...base(), validUntil: '2026-11-20T10:00' }, { now, originalValidUntil: '2026-11-20T10:00' })).toEqual({});
  });

  it('builds the payload: status only on create, cleared fields as null on edit', () => {
    const created = newsPayload({ ...base(), status: 'published' });
    expect(created).toMatchObject({ title: 'Road closed', type: 'news', status: 'published', isPinned: false });
    expect(created).not.toHaveProperty('categoryId');
    expect(created).not.toHaveProperty('validUntil');
    const edited = newsPayload(base(), { editing: true });
    expect(edited).toMatchObject({ categoryId: null, coverImage: null, sourceUrl: null, validUntil: null });
    expect(edited).not.toHaveProperty('status');
  });
});

describe('/news list and detail', () => {
  it('lists items with type, source, "until" time, pinned and sample labels, and filters by type', async () => {
    const { calls } = mockApi({
      'GET /news': () => page([item({ isPinned: true }), item({ id: 'n2', slug: 'rain', title: 'Heavy rain this evening', type: 'weather', validUntilLocal: null, category: null, isSeed: true })]),
    });
    const { router } = renderApp('/news');
    const user = userEvent.setup();
    const card = (await screen.findByText('No water supply in ward 12')).closest('a');
    expect(card).toHaveAttribute('href', '/news/water-cut-ward-12');
    expect(within(card).getByText('Pinned')).toBeInTheDocument();
    expect(within(card).getByText('Water supply')).toBeInTheDocument();
    expect(within(card).getByText('Civic')).toBeInTheDocument();
    expect(within(card).getByText('Source: Municipal water works')).toBeInTheDocument();
    expect(within(card).getByText(/Until 26 Nov 2026/)).toBeInTheDocument();
    const rain = screen.getByText('Heavy rain this evening').closest('a');
    expect(within(rain).getByText('Sample data')).toBeInTheDocument();
    expect(within(rain).queryByText(/Until/)).not.toBeInTheDocument();
    expect(screen.getByText('2 items')).toBeInTheDocument();
    // Not edited since publishing (same content time): no "Updated" on the cards.
    expect(screen.queryByText(/Updated/)).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Traffic' }));
    await waitFor(() => expect(router.state.location.search).toBe('?type=traffic'));
    await waitFor(() => expect(calls.filter((c) => c.path === '/news').at(-1).query).toMatchObject({ type: 'traffic', page: '1' }));
    expect(screen.getByRole('button', { name: 'Traffic' })).toHaveAttribute('aria-pressed', 'true');
  });

  it('shows empty and error states with retry', async () => {
    mockApi({ 'GET /news': () => page([]) });
    const { unmount } = renderApp('/news?type=power');
    expect(await screen.findByText('No news right now')).toBeInTheDocument();
    expect(screen.getByText('Nothing of this type right now. Try All.')).toBeInTheDocument();
    unmount();

    let fail = true;
    mockApi({ 'GET /news': () => (fail ? { status: 500, body: { success: false, error: { code: 'INTERNAL_ERROR', message: 'x' } } } : page([item()])) });
    renderApp('/news');
    const retry = await screen.findByRole('button', { name: 'Try again' });
    fail = false;
    await userEvent.setup().click(retry);
    expect(await screen.findByText('No water supply in ward 12')).toBeInTheDocument();
  });

  it('detail shows full text, source link, published and updated times; expired notices are labelled', async () => {
    mockApi({
      'GET /news/water-cut-ward-12': () =>
        ok({ ...item({ sourceUrl: 'https://example.com/notice', updatedAt: '2026-11-25T06:00:00.000Z' }), body: 'Wards 12 and 13.\nTankers at the market.' }),
    });
    const { unmount } = renderApp('/news/water-cut-ward-12');
    expect(await screen.findByRole('heading', { name: 'No water supply in ward 12' })).toBeInTheDocument();
    expect(screen.getByText(/Tankers at the market/)).toBeInTheDocument();
    expect(screen.getByText('Source: Municipal water works')).toBeInTheDocument();
    expect(screen.getByText(/Published 25 Nov 2026/)).toBeInTheDocument();
    expect(screen.getByText(/Updated 25 Nov 2026/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Open the source/ })).toHaveAttribute('href', 'https://example.com/notice');
    expect(screen.getByRole('link', { name: /Open the source/ })).toHaveAttribute('rel', expect.stringContaining('noopener'));
    expect(screen.queryByText('This notice has expired')).not.toBeInTheDocument();
    unmount();

    mockApi({ 'GET /news/old': () => ok({ ...item({ slug: 'old', isExpired: true }), body: '' }) });
    const second = renderApp('/news/old');
    expect(await screen.findByText('This notice has expired')).toBeInTheDocument();
    expect(screen.getByText(/It was valid until 26 Nov 2026/)).toBeInTheDocument();
    second.unmount();

    mockApi({ 'GET /news/nope': () => ({ status: 404, body: { success: false, error: { code: 'NOT_FOUND', message: 'x' } } }) });
    renderApp('/news/nope');
    expect(await screen.findByText('News item not found')).toBeInTheDocument();
  });

  it('renders body text as plain text, never HTML', async () => {
    mockApi({ 'GET /news/x': () => ok({ ...item({ slug: 'x' }), body: '<img src=x onerror="alert(1)">Hello' }) });
    const { container } = renderApp('/news/x');
    expect(await screen.findByText(/<img src=x/)).toBeInTheDocument();
    expect(container.querySelector('img[onerror]')).toBeNull();
  });

  it('has Telugu labels', async () => {
    mockApi({ 'GET /news': () => page([item({ type: 'power' })]) });
    await i18n.changeLanguage('te');
    renderApp('/news');
    expect(await screen.findByRole('heading', { name: 'వార్తలు & అప్‌డేట్స్' })).toBeInTheDocument();
    expect((await screen.findAllByText('విద్యుత్ కోత')).length).toBeGreaterThan(0);
  });
});

describe('admin news', () => {
  const adminItem = (o = {}) => ({ ...item(), body: '', status: 'published', categoryId: 'c1', createdAt: '2026-11-25T04:00:00.000Z', ...o });

  it('is admin-only', async () => {
    mockApi({ 'GET /auth/me': () => ok(sampleUser()) });
    renderApp('/admin/news');
    expect((await screen.findAllByText('Not allowed')).length).toBeGreaterThan(0);
  });

  it('lists items and publishes, hides, pins and removes; shows the pin-limit message', async () => {
    const { calls } = mockApi({
      'GET /auth/me': () => ok(sampleUser({ role: 'admin' })),
      'GET /admin/news': () => page([adminItem(), adminItem({ id: 'n2', title: 'Draft note', status: 'draft' })]),
      'PATCH /news/n1': ({ body }) =>
        body.isPinned ? { status: 409, body: { success: false, error: { code: 'CONFLICT', message: 'At most 5 items can be pinned. Unpin one first.' } } } : ok(adminItem({ status: body.status ?? 'published' })),
      'PATCH /news/n2': ({ body }) => ok(adminItem({ id: 'n2', status: body.status })),
      'DELETE /news/n1': () => ok({ id: 'n1', status: 'archived' }),
    });
    renderApp('/admin/news');
    const user = userEvent.setup();
    await user.click(await screen.findByRole('button', { name: 'Publish Draft note' }));
    await waitFor(() => expect(calls.find((c) => c.method === 'PATCH' && c.path === '/news/n2')?.body).toEqual({ status: 'published' }));

    await user.click(screen.getByRole('button', { name: 'Hide No water supply in ward 12' }));
    await waitFor(() => expect(calls.find((c) => c.method === 'PATCH' && c.path === '/news/n1')?.body).toEqual({ status: 'hidden' }));

    await user.click(screen.getByRole('button', { name: 'Pin No water supply in ward 12' }));
    expect(await screen.findByText('At most 5 items can be pinned. Unpin one first.')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Remove No water supply in ward 12' }));
    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByText(/The record is kept/)).toBeInTheDocument();
    await user.click(within(dialog).getByRole('button', { name: 'Remove' }));
    await waitFor(() => expect(calls.some((c) => c.method === 'DELETE' && c.path === '/news/n1')).toBe(true));
  });

  it('creates an item: validates, then sends IST "show until" and status', async () => {
    const { calls } = mockApi({
      'GET /auth/me': () => ok(sampleUser({ role: 'admin' })),
      'GET /categories': () => ok([cat]),
      'POST /news': ({ body }) => ({ status: 201, body: ok(adminItem({ ...body, id: 'n9' })) }),
      'GET /admin/news': () => page([]),
    });
    const { router } = renderApp('/admin/news/new');
    const user = userEvent.setup();
    await user.click(await screen.findByRole('button', { name: 'Save' }));
    expect(await screen.findByText('Enter a headline (at least 3 characters).')).toBeInTheDocument();
    expect(screen.getByText('Name the source.')).toBeInTheDocument();
    expect(calls.some((c) => c.method === 'POST')).toBe(false);

    await user.selectOptions(screen.getByLabelText('Type *'), 'power');
    expect(screen.getByText(/Notices like this usually end/)).toBeInTheDocument();
    await user.type(screen.getByLabelText('Headline *'), 'Power cut in Kothapeta');
    await user.type(screen.getByLabelText('Summary *'), 'No supply from 10 am to 2 pm for maintenance.');
    await user.type(screen.getByLabelText('Source name *'), 'Electricity office');
    await user.selectOptions(screen.getByLabelText('Category'), await screen.findByRole('option', { name: 'Civic' }));
    await user.click(screen.getByLabelText(/Pin to the top/));
    await user.selectOptions(screen.getByLabelText('Status'), 'published');
    await user.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(router.state.location.pathname).toBe('/admin/news'));
    expect(calls.find((c) => c.method === 'POST').body).toEqual({
      title: 'Power cut in Kothapeta',
      summary: 'No supply from 10 am to 2 pm for maintenance.',
      body: '',
      type: 'power',
      categoryId: 'c1',
      sourceName: 'Electricity office',
      isPinned: true,
      status: 'published',
    });
  });

  it('edits an existing item and clears optional fields with null', async () => {
    const { calls } = mockApi({
      'GET /auth/me': () => ok(sampleUser({ role: 'admin' })),
      'GET /categories': () => ok([cat]),
      'GET /admin/news/n1': () => ok(adminItem({ validUntilLocal: '2026-11-20T10:00', isExpired: true })),
      'PATCH /news/n1': ({ body }) => ok(adminItem(body)),
      'GET /admin/news': () => page([]),
    });
    const { router } = renderApp('/admin/news/n1/edit');
    const user = userEvent.setup();
    const headline = await screen.findByLabelText('Headline *');
    expect(headline).toHaveValue('No water supply in ward 12');
    expect(screen.queryByLabelText('Status')).not.toBeInTheDocument();
    await user.clear(headline);
    await user.type(headline, 'Water supply restored in ward 12');
    await user.click(screen.getByRole('button', { name: 'Clear time' }));
    await user.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(router.state.location.pathname).toBe('/admin/news'));
    expect(calls.find((c) => c.method === 'PATCH').body).toMatchObject({ title: 'Water supply restored in ward 12', validUntil: null, sourceUrl: null, coverImage: null });
  });

  it('keeps a category that was deactivated since: shown as inactive, selected and sent back unchanged', async () => {
    const { calls } = mockApi({
      'GET /auth/me': () => ok(sampleUser({ role: 'admin' })),
      'GET /categories': () => ok([{ ...cat, id: 'c2', name: { en: 'Sports', te: 'క్రీడలు' }, slug: 'sports' }]), // "Civic" is no longer active
      'GET /admin/news/n1': () => ok(adminItem()),
      'PATCH /news/n1': ({ body }) => ok(adminItem(body)),
      'GET /admin/news': () => page([]),
    });
    renderApp('/admin/news/n1/edit');
    const user = userEvent.setup();
    const select = await screen.findByLabelText('Category');
    await waitFor(() => expect(within(select).getByRole('option', { name: 'Civic (inactive)' })).toBeInTheDocument());
    expect(select).toHaveValue('c1');
    await user.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(calls.find((c) => c.method === 'PATCH')?.body).toMatchObject({ categoryId: 'c1' }));
  });

  it('"Clear time" meets the 44 px tap target', async () => {
    mockApi({
      'GET /auth/me': () => ok(sampleUser({ role: 'admin' })),
      'GET /categories': () => ok([cat]),
      'GET /admin/news/n1': () => ok(adminItem()),
    });
    renderApp('/admin/news/n1/edit');
    expect(await screen.findByRole('button', { name: 'Clear time' })).toHaveClass('min-h-tap');
  });
});
