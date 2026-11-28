import { describe, it, expect } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderApp } from '../../test/render.jsx';
import { mockApi, ok, sampleUser } from '../../test/mockApi.js';

const item = (o = {}) => ({
  id: 'n1',
  slug: 'water-cut-ward-12',
  title: 'No water supply in ward 12',
  summary: 'Pipeline repair: no supply from 6 am to 11 am.',
  type: 'water',
  category: null,
  coverImage: null,
  sourceName: 'Municipal water works',
  sourceUrl: null,
  publishedAt: '2026-11-25T04:00:00.000Z',
  updatedAt: '2026-11-25T04:00:00.000Z',
  validUntil: null,
  validUntilLocal: null,
  isPinned: false,
  isExpired: false,
  isSeed: false,
  ...o,
});
const page = (items, meta = {}) => ok(items, { page: 1, limit: 20, total: items.length, totalPages: 1, ...meta });
const row = (o = {}) => ({
  type: 'news',
  id: 'n1',
  title: 'No water supply in ward 12',
  slug: 'water-cut-ward-12',
  status: 'published',
  moderationStatus: 'published',
  archivedAt: null,
  archivedBy: null,
  moderationReason: null,
  author: { id: 'a1', name: 'Admin Anu', email: 'anu@example.com' },
  createdAt: '2026-11-25T04:00:00.000Z',
  publishedAt: '2026-11-25T04:00:00.000Z',
  ...o,
});
const MENU = /Admin moderation options for/;
const news = () => ({
  'GET /news': () => page([item()]),
  'GET /news/water-cut-ward-12': () => ok({ ...item(), body: 'Wards 12 and 13.' }),
});

describe('admin moderation controls are admin-only', () => {
  it('visitors and signed-in users never see the moderation menu', async () => {
    mockApi(news());
    const { unmount } = renderApp('/news');
    expect(await screen.findByText('No water supply in ward 12')).toBeInTheDocument();
    expect(screen.queryAllByRole('button', { name: MENU })).toHaveLength(0);
    unmount();

    for (const role of ['user', 'owner']) {
      mockApi({ ...news(), 'GET /auth/me': () => ok(sampleUser({ role })) });
      const r = renderApp('/news/water-cut-ward-12');
      expect(await screen.findByRole('heading', { name: 'No water supply in ward 12' })).toBeInTheDocument();
      expect(screen.queryAllByRole('button', { name: MENU })).toHaveLength(0);
      expect(screen.queryByText('Archive temporarily')).not.toBeInTheDocument();
      r.unmount();
    }
  });

  it('admins get the menu on cards and detail pages; archive asks for confirmation and sends the reason', async () => {
    const { calls } = mockApi({
      ...news(),
      'GET /auth/me': () => ok(sampleUser({ role: 'admin' })),
      'GET /admin/moderation/news/n1': () => ok(row()),
      'POST /admin/moderation/news/n1/archive': ({ body }) => ok(row({ status: 'hidden', moderationStatus: 'archived', moderationReason: body.reason })),
    });
    const user = userEvent.setup();
    renderApp('/news');
    await user.click(await screen.findByRole('button', { name: 'Admin moderation options for No water supply in ward 12' }));
    const menu = await screen.findByRole('dialog', { name: 'Admin moderation' });
    await user.click(await within(menu).findByRole('button', { name: /Archive temporarily/ }));

    const confirm = await screen.findByRole('dialog', { name: 'Archive this content?' });
    expect(calls.some((c) => c.path.endsWith('/archive'))).toBe(false); // nothing happens before confirming
    await user.type(within(confirm).getByLabelText('Reason (optional)'), 'Wrong ward');
    await user.click(within(confirm).getByRole('button', { name: 'Archive' }));
    await waitFor(() => expect(calls.find((c) => c.method === 'POST' && c.path === '/admin/moderation/news/n1/archive')?.body).toEqual({ reason: 'Wrong ward' }));
    expect(await screen.findByText('Archived. It is no longer on the website.')).toBeInTheDocument();
  });

  it('an archived item offers Restore instead of Archive', async () => {
    const { calls } = mockApi({
      ...news(),
      'GET /news/water-cut-ward-12': () => ok({ ...item(), body: 'x', status: 'hidden' }),
      'GET /auth/me': () => ok(sampleUser({ role: 'admin' })),
      'GET /admin/moderation/news/n1': () => ok(row({ status: 'hidden', moderationStatus: 'archived', moderationReason: 'Wrong ward' })),
      'POST /admin/moderation/news/n1/restore': () => ok(row()),
    });
    const user = userEvent.setup();
    renderApp('/news/water-cut-ward-12');
    await user.click(await screen.findByRole('button', { name: MENU }));
    const menu = await screen.findByRole('dialog', { name: 'Admin moderation' });
    expect(await within(menu).findByText('Reason: Wrong ward')).toBeInTheDocument();
    expect(within(menu).queryByRole('button', { name: /Archive temporarily/ })).not.toBeInTheDocument();
    await user.click(within(menu).getByRole('button', { name: /Restore/ }));
    await user.click(within(await screen.findByRole('dialog', { name: 'Restore this content?' })).getByRole('button', { name: 'Restore' }));
    await waitFor(() => expect(calls.some((c) => c.method === 'POST' && c.path === '/admin/moderation/news/n1/restore')).toBe(true));
  });

  it('delete permanently needs the "cannot be undone" tick, then leaves the deleted page', async () => {
    const { calls } = mockApi({
      ...news(),
      'GET /auth/me': () => ok(sampleUser({ role: 'admin' })),
      'GET /admin/moderation/news/n1': () => ok(row()),
      'DELETE /admin/moderation/news/n1': () => ok({ type: 'news', id: 'n1', deleted: true }),
    });
    const user = userEvent.setup();
    const { router } = renderApp('/news/water-cut-ward-12');
    await user.click(await screen.findByRole('button', { name: MENU }));
    await user.click(await within(await screen.findByRole('dialog', { name: 'Admin moderation' })).findByRole('button', { name: /Delete permanently/ }));
    const confirm = await screen.findByRole('dialog', { name: 'Delete permanently?' });
    expect(within(confirm).getByRole('alert')).toHaveTextContent('This cannot be undone.');
    const button = within(confirm).getByRole('button', { name: 'Delete permanently' });
    expect(button).toBeDisabled();
    await user.click(within(confirm).getByRole('checkbox', { name: 'I understand that this cannot be undone.' }));
    expect(button).toBeEnabled();
    await user.click(button);
    await waitFor(() => expect(calls.find((c) => c.method === 'DELETE')?.body).toEqual({ confirm: true }));
    await waitFor(() => expect(router.state.location.pathname).toBe('/news'));
  });
});

describe('/admin/moderation dashboard', () => {
  it('is admin-only', async () => {
    const { calls } = mockApi({ 'GET /auth/me': () => ok(sampleUser({ role: 'user' })) });
    renderApp('/admin/moderation');
    expect((await screen.findAllByText("Not allowed")).length).toBeGreaterThan(0);
    expect(screen.queryByRole('heading', { name: 'Content moderation' })).not.toBeInTheDocument();
    expect(calls.some((c) => c.path.startsWith('/admin/'))).toBe(false);
  });

  it('lists content by type and status, searches by author, and restores archived items', async () => {
    const { calls } = mockApi({
      'GET /auth/me': () => ok(sampleUser({ role: 'admin' })),
      'GET /admin/moderation': ({ query }) =>
        query.status === 'archived'
          ? page([row({ type: query.type, id: 'p9', title: 'Spam post', status: 'hidden', moderationStatus: 'archived', archivedBy: 'Admin Anu', archivedAt: '2026-11-26T04:00:00.000Z', moderationReason: 'Spam' })])
          : page([row({ type: query.type, id: 'b1', title: 'Annapurna Tiffins', slug: 'annapurna-tiffins' })], { total: 41, totalPages: 3 }),
      'POST /admin/moderation/post/p9/restore': () => ok(row({ type: 'post', id: 'p9', moderationStatus: 'published' })),
    });
    const user = userEvent.setup();
    renderApp('/admin/moderation');
    expect(await screen.findByRole('heading', { name: 'Content moderation' })).toBeInTheDocument();
    expect(await screen.findByText('Annapurna Tiffins')).toBeInTheDocument();
    expect(screen.getByText('41 items')).toBeInTheDocument();
    expect(screen.getByText('Admin Anu (anu@example.com)')).toBeInTheDocument();
    expect(calls.find((c) => c.path === '/admin/moderation').query).toMatchObject({ type: 'business', status: 'all', page: '1' });

    await user.click(screen.getByRole('button', { name: 'Posts' }));
    await user.click(screen.getByRole('button', { name: 'Archived' }));
    expect(await screen.findByText('Spam post')).toBeInTheDocument();
    expect(screen.getByText('Spam')).toBeInTheDocument();

    await user.type(screen.getByLabelText('Author'), 'anu@example');
    await user.click(screen.getByRole('button', { name: 'Search' }));
    await waitFor(() => expect(calls.at(-1).query).toMatchObject({ type: 'post', status: 'archived', author: 'anu@example' }));

    await user.click(await screen.findByRole('button', { name: 'Restore - Spam post' }));
    await user.click(within(await screen.findByRole('dialog', { name: 'Restore this content?' })).getByRole('button', { name: 'Restore' }));
    await waitFor(() => expect(calls.some((c) => c.method === 'POST' && c.path === '/admin/moderation/post/p9/restore')).toBe(true));
  });
});
