import { describe, it, expect } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderApp } from '../../test/render.jsx';
import { mockApi, ok, sampleUser } from '../../test/mockApi.js';
import { reportActions, reportTargetLink } from './api.js';
import { scrubEvent } from '../../lib/errorReporting.js';

const admin = () => ok(sampleUser({ id: 'me', role: 'admin', name: 'Admin Me' }));
const page = (items, meta = {}) => ok(items, { page: 1, limit: 20, total: items.length, totalPages: 1, ...meta });

const report = (o = {}) => ({
  id: 'rp1', targetType: 'business', targetId: 'b1', target: { title: 'Padma Juice Corner', slug: 'padma-juice', businessId: null, status: 'published', isPublic: true },
  reason: 'wrong_info', details: 'Phone number is wrong.', status: 'open',
  reporter: { id: 'u2', name: 'Lakshmi', email: 'l@example.com' }, responsibleUser: { id: 'u3', name: 'Padma', email: 'p@example.com' },
  handledBy: null, handledAt: null, resolution: null, createdAt: '2026-11-25T04:00:00.000Z', ...o,
});

describe('admin tools are admin-only', () => {
  it('users and owners are refused', async () => {
    for (const path of ['/admin/reports', '/admin/users', '/admin/metrics']) {
      mockApi({ 'GET /auth/me': () => ok(sampleUser({ role: 'owner' })) });
      const { unmount } = renderApp(path);
      expect((await screen.findAllByText('Not allowed')).length).toBeGreaterThan(0);
      unmount();
    }
  });
});

describe('reports queue (FR-ADM-1)', () => {
  it('offers only the actions that apply, and links to the content', () => {
    expect(reportActions(report())).toEqual(['dismiss', 'mark_reviewed', 'hide_target', 'block_user', 'hide_and_block']);
    expect(reportActions(report({ status: 'reviewed' }))).toEqual(['dismiss', 'hide_target', 'block_user', 'hide_and_block']);
    expect(reportActions(report({ targetType: 'suggestion', target: null }))).toEqual(['dismiss', 'mark_reviewed', 'block_user']);
    expect(reportActions(report({ target: { ...report().target, isPublic: false }, responsibleUser: null }))).toEqual(['dismiss', 'mark_reviewed']);
    expect(reportActions(report({ status: 'dismissed' }))).toEqual([]);
    expect(reportTargetLink(report())).toBe('/businesses/padma-juice');
    expect(reportTargetLink(report({ targetType: 'offer', targetId: 'o9' }))).toBe('/offers/o9');
    expect(reportTargetLink(report({ targetType: 'review', target: { ...report().target, slug: 'padma-meals' } }))).toBe('/businesses/padma-meals');
    expect(reportTargetLink(report({ target: null }))).toBeNull();
  });

  it('lists open reports and hides content after confirmation, with a note', async () => {
    const { calls } = mockApi({
      'GET /auth/me': admin,
      'GET /admin/reports': ({ query }) => (query.status === 'open' ? page([report(), report({ id: 'rp2', targetType: 'suggestion', targetId: null, target: null, reason: 'idea', details: 'Add bus timings.', responsibleUser: null })]) : page([])),
      'PATCH /admin/reports/rp1': ({ body }) => ok(report({ status: 'actioned', resolution: body })),
    });
    renderApp('/admin/reports');
    const user = userEvent.setup();
    const link = await screen.findByRole('link', { name: /Padma Juice Corner/ });
    expect(link).toHaveAttribute('href', '/businesses/padma-juice');
    const first = link.closest('li');
    expect(within(first).getByText('Phone number is wrong.')).toBeInTheDocument();
    expect(within(first).getByText(/Lakshmi \(l@example\.com\)/)).toBeInTheDocument();
    const suggestion = screen.getByText('Add bus timings.').closest('li');
    expect(within(suggestion).queryByRole('button', { name: /Hide content/ })).not.toBeInTheDocument();

    await user.click(within(first).getByRole('button', { name: 'Hide content - Padma Juice Corner' }));
    const dialog = await screen.findByRole('dialog', { name: 'Hide this content?' });
    await user.type(within(dialog).getByLabelText('Note (optional)'), 'Confirmed by phone.');
    await user.click(within(dialog).getByRole('button', { name: 'Hide content' }));
    await waitFor(() => expect(calls.find((c) => c.method === 'PATCH').body).toEqual({ action: 'hide_target', note: 'Confirmed by phone.' }));
    expect(await screen.findByText('Report Actioned')).toBeInTheDocument();
  });

  it('switches status tabs and shows how handled reports were resolved', async () => {
    const { calls } = mockApi({
      'GET /auth/me': admin,
      'GET /admin/reports': ({ query }) =>
        query.status === 'actioned'
          ? page([report({ status: 'actioned', handledBy: 'Admin Me', handledAt: '2026-11-25T06:00:00.000Z', resolution: { action: 'block_user', note: 'Repeated spam' } })])
          : page([]),
    });
    renderApp('/admin/reports');
    const user = userEvent.setup();
    expect(await screen.findByText('Nothing here')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Actioned' }));
    expect(await screen.findByText(/Block user • Admin Me • .* • Repeated spam/)).toBeInTheDocument();
    expect(calls.filter((c) => c.path === '/admin/reports').at(-1).query).toMatchObject({ status: 'actioned', page: '1' });
    expect(screen.queryByRole('button', { name: /^Dismiss - / })).not.toBeInTheDocument(); // handled: no actions
  });
});

describe('user management', () => {
  const users = [
    { id: 'me', name: 'Admin Me', email: 'me@example.com', role: 'admin', status: 'active', signIn: ['password'], createdAt: '2026-01-01T00:00:00.000Z' },
    { id: 'u2', name: 'Lakshmi', email: 'l@example.com', role: 'user', status: 'active', signIn: ['google'], createdAt: '2026-02-01T00:00:00.000Z' },
  ];

  it('blocks a user and changes a role after confirmation; my own row has no controls', async () => {
    const { calls } = mockApi({
      'GET /auth/me': admin,
      'GET /admin/users': () => page(users),
      'PATCH /admin/users/u2': ({ body }) => ok({ ...users[1], ...body }),
    });
    renderApp('/admin/users');
    const user = userEvent.setup();
    const mine = (await screen.findByText('(you)')).closest('li');
    expect(within(mine).queryByRole('button')).not.toBeInTheDocument();
    const row = screen.getByText('Lakshmi').closest('li');
    expect(within(row).getByText(/Google/)).toBeInTheDocument();

    await user.click(within(row).getByRole('button', { name: 'Block - Lakshmi' }));
    let dialog = await screen.findByRole('dialog', { name: 'Confirm change' });
    expect(within(dialog).getByText(/Block Lakshmi\?/)).toBeInTheDocument();
    await user.click(within(dialog).getByRole('button', { name: 'Confirm' }));
    await waitFor(() => expect(calls.filter((c) => c.method === 'PATCH').at(-1).body).toEqual({ status: 'blocked' }));

    await user.selectOptions(within(row).getByLabelText('Role'), 'admin');
    dialog = await screen.findByRole('dialog', { name: 'Confirm change' });
    expect(within(dialog).getByText(/Only give this role to people you trust/)).toBeInTheDocument();
    await user.click(within(dialog).getByRole('button', { name: 'Confirm' }));
    await waitFor(() => expect(calls.filter((c) => c.method === 'PATCH').at(-1).body).toEqual({ role: 'admin' }));
  });

  it('searches and filters', async () => {
    const { calls } = mockApi({ 'GET /auth/me': admin, 'GET /admin/users': () => page(users) });
    renderApp('/admin/users');
    const user = userEvent.setup();
    await user.type(await screen.findByRole('searchbox'), 'laks');
    await user.selectOptions(screen.getAllByRole('combobox')[1], 'blocked');
    await waitFor(() => expect(calls.filter((c) => c.path === '/admin/users').at(-1).query).toMatchObject({ q: 'laks', status: 'blocked' }));
  });
});

describe('metrics (FR-ADM-2)', () => {
  const summary = (o = {}) => ({
    from: '2026-11-19', to: '2026-11-25', sessions: 42,
    totals: { view: 120, offer_view: 18, contact_click: 30, share: 4, search: 50 },
    byDay: Array.from({ length: 7 }, (_, i) => ({ date: `2026-11-${19 + i}`, view: i * 3, offer_view: 1, contact_click: i, share: 0, search: 2 })),
    metrics: {
      activeDevices7d: 37,
      searchToContact: { searchSessions: 20, converted: 5, rate: 25 },
      events: { views: 9, shares: 2 },
      retention7d: { cohort: 0, returned: 0, rate: null },
      freshness: { days: 30, businesses: { total: 10, fresh: 6, rate: 60 }, offers: { total: 3, fresh: 3, rate: 100 }, events: { total: 0, fresh: 0, rate: null } },
    },
    ...o,
  });

  it('shows the launch metrics, a daily chart with a table view, and changes the range', async () => {
    const { calls } = mockApi({ 'GET /auth/me': admin, 'GET /admin/analytics/summary': () => ok(summary()) });
    renderApp('/admin/metrics');
    const user = userEvent.setup();
    const tile = async (label) => (await screen.findByText(label)).parentElement;
    expect(within(await tile('Active devices')).getByText('37')).toBeInTheDocument();
    expect(within(await tile('Searches that led to a contact')).getByText('25%')).toBeInTheDocument();
    expect(within(await tile('Searches that led to a contact')).getByText('5 of 20')).toBeInTheDocument();
    expect(within(await tile('Came back after 7 days')).getByText('-')).toBeInTheDocument();
    expect(within(await tile('Came back after 7 days')).getByText('Not enough data yet')).toBeInTheDocument();
    const activity = screen.getByRole('region', { name: 'Activity in this range' });
    expect(within(within(activity).getByText('Contact taps').parentElement).getByText('30')).toBeInTheDocument();
    expect(screen.getByText('2 shares')).toBeInTheDocument();
    expect(screen.getByRole('img', { name: /Activity per day over 7 days: .* events in total/ })).toBeInTheDocument();
    expect(screen.getAllByRole('row')).toHaveLength(8); // header + 7 days

    await user.click(screen.getByRole('button', { name: 'Last 30 days' }));
    await waitFor(() => {
      const q = calls.filter((c) => c.path === '/admin/analytics/summary').at(-1).query;
      expect(Math.round((Date.parse(q.to) - Date.parse(q.from)) / 86_400_000)).toBe(29);
    });
  });
});

describe('browser error reporting', () => {
  it('scrubs events: no user, query string or breadcrumbs', () => {
    expect(scrubEvent({ request: { url: 'https://manatenali.in/search?q=private', headers: { a: 1 } }, user: { id: 'x' }, breadcrumbs: [{ message: 'typed text' }], message: 'boom' })).toEqual({
      request: { url: 'https://manatenali.in/search' },
      breadcrumbs: [],
      message: 'boom',
    });
  });
});
