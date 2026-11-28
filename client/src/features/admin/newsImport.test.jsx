import { describe, it, expect } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderApp } from '../../test/render.jsx';
import { mockApi, ok, sampleUser } from '../../test/mockApi.js';

const admin = () => ok(sampleUser({ id: 'me', role: 'admin', name: 'Admin Me' }));
const counts = (o = {}) => ({ needs_review: 0, published: 0, rejected: 0, failed: 0, ...o });
const page = (items, c = counts()) => ok(items, { page: 1, limit: 20, total: items.length, totalPages: 1, counts: c });
const run = (o = {}) => ({
  id: 'r1', trigger: 'manual', status: 'running', account: 'snewstenali', requested: 10,
  checked: 0, imported: 0, duplicates: 0, failed: 0, error: null, startedAt: '2026-11-28T11:20:00.000Z', finishedAt: null, ...o,
});
const TITLE = 'దాసరి కిరణ్ కుమార్ జన్మదినం సందర్భంగా పేదలకు అన్నదానం';
const SUMMARY = 'దాసరి కిరణ్ కుమార్ జన్మదినం సందర్భంగా ఆయన మిత్ర మండలి రైల్వే స్టేషన్ దగ్గర పేదలకు అన్నదానం నిర్వహించింది.';
const imported = (o = {}) => ({
  id: 'i1', status: 'needs_review', source: 'instagram', account: 'snewstenali', sourceName: 'S News Tenali',
  postId: '4040323809321517648', shortCode: 'DgSHRkYKYJQ', postUrl: 'https://www.instagram.com/p/DgSHRkYKYJQ/',
  caption: 'మాజీ సభ్యులు, సినీ నిర్మాత దాసరి కిరణ్ కుమార్ జన్మదిన వేడుకలు', postedAt: '2026-11-28T11:09:51.000Z',
  mediaType: 'reel', durationSec: 43,
  transcript: { status: 'not_transcribed', text: null, language: null, method: null, note: null },
  error: null, rejectReason: null,
  news: { id: 'n1', slug: 'item', title: 'మాజీ సభ్యులు, సినీ నిర్మాత దాసరి కిరణ్ కుమార్ జన్మదిన వేడుకలు', summary: 'మాజీ సభ్యులు, సినీ నిర్మాత దాసరి కిరణ్ కుమార్ జన్మదిన వేడుకలు', status: 'draft', sourceName: 'S News Tenali', sourceUrl: 'https://www.instagram.com/p/DgSHRkYKYJQ/' },
  importedAt: '2026-11-28T11:20:00.000Z', reviewedAt: null, ...o,
});

describe('Fetch News panel (Admin News)', () => {
  it('starts a fetch through our API, shows live progress, then the counts and a review link', async () => {
    let polls = 0;
    let total = counts({ needs_review: 1, published: 3, rejected: 1, failed: 0 });
    const { calls } = mockApi({
      'GET /auth/me': admin,
      'GET /admin/news': () => ok([], { page: 1, limit: 20, total: 0, totalPages: 0 }),
      'GET /admin/news-imports': () => page([], total),
      'GET /admin/news-imports/runs/latest': () => {
        polls += 1;
        if (polls === 1) return ok(null);
        if (polls === 2) return ok(run({ checked: 1, imported: 1 }));
        total = counts({ needs_review: 3, published: 3, rejected: 1, failed: 0 });
        return ok(run({ status: 'succeeded', checked: 3, imported: 2, duplicates: 1, finishedAt: '2026-11-28T11:21:00.000Z' }));
      },
      'POST /admin/news-imports/fetch': () => ({ status: 202, body: ok(run()) }),
    });
    renderApp('/admin/news');
    const panel = await screen.findByRole('region', { name: 'Fetch News' });
    const list = within(panel).getByRole('list', { name: 'Imported posts by status' });
    await waitFor(() => expect(within(list).getByRole('link', { name: /Needs review\s*1/ })).toHaveAttribute('href', '/admin/news/imports?status=needs_review'));
    expect(within(list).getByRole('link', { name: /Published\s*3/ })).toBeInTheDocument();
    expect(within(list).getByRole('link', { name: /Rejected\s*1/ })).toBeInTheDocument();
    expect(within(list).getByRole('link', { name: /Failed\s*0/ })).toHaveAttribute('href', '/admin/news/imports?status=failed');

    await userEvent.setup().click(within(panel).getByRole('button', { name: 'Fetch News' }));
    expect(calls.find((c) => c.method === 'POST' && c.path === '/admin/news-imports/fetch')).toBeTruthy();
    // While it runs: the button is disabled and progress is announced.
    expect(await within(panel).findByRole('button', { name: /Fetching/ })).toBeDisabled();
    expect(within(panel).getByRole('status')).toHaveTextContent('Fetching posts from @snewstenali');
    // Polled until done: per-run counts, then refreshed totals.
    const status = await within(panel).findByText('Last fetch finished', {}, { timeout: 6000 });
    const summary = status.closest('[role="status"]');
    expect(summary).toHaveTextContent(/3\s*Checked/);
    expect(summary).toHaveTextContent(/2\s*Imported/);
    expect(summary).toHaveTextContent(/1\s*Duplicates/);
    await waitFor(() => expect(within(panel).getByRole('link', { name: /Review imported drafts \(3 waiting\)/ })).toHaveAttribute('href', '/admin/news/imports?status=needs_review'));
    expect(within(panel).getByRole('button', { name: 'Fetch News' })).toBeEnabled();
  }, 15000);

  it('shows a useful error when the fetch fails or is not set up', async () => {
    mockApi({
      'GET /auth/me': admin,
      'GET /admin/news': () => ok([], { page: 1, limit: 20, total: 0, totalPages: 0 }),
      'GET /admin/news-imports': () => page([]),
      'GET /admin/news-imports/runs/latest': () => ok(run({ status: 'failed', error: 'Apify is limiting requests right now. Try again in a few minutes.', finishedAt: '2026-11-28T11:21:00.000Z' })),
      'POST /admin/news-imports/fetch': () => ({ status: 503, body: { success: false, error: { code: 'SERVICE_UNAVAILABLE', message: 'Fetch News is not set up on the server yet (APIFY_TOKEN is missing).' } } }),
    });
    renderApp('/admin/news');
    const panel = await screen.findByRole('region', { name: 'Fetch News' });
    expect(await within(panel).findByText('Last fetch failed')).toBeInTheDocument();
    expect(within(panel).getByText(/Apify is limiting requests/)).toBeInTheDocument();
    await userEvent.setup().click(within(panel).getByRole('button', { name: 'Fetch News' }));
    expect(await screen.findByText(/APIFY_TOKEN is missing/)).toBeInTheDocument();
  });
});

describe('Review imported news', () => {
  it('shows the placeholder (not the source image), attribution, link, caption and transcript status; edits and publishes', async () => {
    let item = imported();
    const { calls } = mockApi({
      'GET /auth/me': admin,
      'GET /admin/news-imports': ({ query }) => page(query.status === item.status ? [item] : [], counts({ [item.status]: 1 })),
      'POST /admin/news-imports/:id/publish': ({ body }) => {
        item = imported({ status: 'published', news: { ...item.news, ...body, status: 'published' } });
        return ok(item);
      },
    });
    renderApp('/admin/news/imports?status=needs_review');
    expect(await screen.findByText('Review imported news')).toBeInTheDocument();
    const card = (await screen.findByText('Original caption')).closest('li');
    expect(card.querySelector('img')).toBeNull(); // the app's placeholder, never the Instagram image
    expect(card).toHaveTextContent('S News Tenali');
    expect(card).toHaveTextContent('@snewstenali');
    expect(card).toHaveTextContent(/Reel · 43s/);
    const source = within(card).getByRole('link', { name: /Open the original post/ });
    expect(source).toHaveAttribute('href', 'https://www.instagram.com/p/DgSHRkYKYJQ/');
    expect(source).toHaveAttribute('rel', 'noopener noreferrer');
    expect(card).toHaveTextContent(/Transcript\s*· not transcribed/);
    expect(card).toHaveTextContent(/Watch the original post before publishing/);

    const user = userEvent.setup();
    const headline = within(card).getByLabelText('Headline (Telugu)');
    await user.clear(headline);
    await user.type(headline, TITLE);
    const summary = within(card).getByLabelText('Summary (Telugu)');
    await user.clear(summary);
    await user.type(summary, SUMMARY);
    await user.click(within(card).getByRole('button', { name: 'Publish' }));
    await waitFor(() => expect(calls.find((c) => c.method === 'POST' && c.path === '/admin/news-imports/i1/publish')?.body).toEqual({ title: TITLE, summary: SUMMARY }));
    expect(await screen.findByText('Nothing waiting for review')).toBeInTheDocument();
  });

  it('rejects with an optional reason; failed imports show why', async () => {
    let item = imported();
    const { calls } = mockApi({
      'GET /auth/me': admin,
      'GET /admin/news-imports': ({ query }) => page(query.status === item.status ? [item] : [], counts({ [item.status]: 1 })),
      'POST /admin/news-imports/:id/reject': ({ body }) => {
        item = imported({ status: 'rejected', rejectReason: body.reason, news: { ...item.news, status: 'archived' } });
        return ok(item);
      },
    });
    renderApp('/admin/news/imports');
    const user = userEvent.setup();
    const card = (await screen.findByText('Original caption')).closest('li');
    await user.click(within(card).getByRole('button', { name: 'Reject' }));
    const dialog = await screen.findByRole('dialog', { name: 'Reject this post?' });
    await user.type(within(dialog).getByLabelText('Reason (optional)'), 'Birthday wishes, not news');
    await user.click(within(dialog).getByRole('button', { name: 'Reject' }));
    await waitFor(() => expect(calls.find((c) => c.path === '/admin/news-imports/i1/reject')?.body).toEqual({ reason: 'Birthday wishes, not news' }));

    item = imported({ id: 'i2', status: 'failed', error: 'The news draft could not be created. It will be retried on the next fetch.', news: null });
    await user.click(screen.getByRole('tab', { name: /Failed/ }));
    expect(await screen.findByText(/retried on the next fetch/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Publish' })).toBeNull();
  });

  it('is admin-only', async () => {
    mockApi({ 'GET /auth/me': () => ok(sampleUser({ role: 'owner' })) });
    renderApp('/admin/news/imports');
    expect((await screen.findAllByText('Not allowed')).length).toBeGreaterThan(0);
  });
});
