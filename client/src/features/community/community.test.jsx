import { describe, it, expect } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderApp } from '../../test/render.jsx';
import { mockApi, ok, sampleUser } from '../../test/mockApi.js';

const post = (o = {}) => ({
  id: 'p1',
  kind: 'recommendation',
  text: 'The gongura chicken at Padma Meals is excellent.',
  photo: null,
  area: 'Kothapeta',
  business: { id: 'b1', name: 'Padma Meals', slug: 'padma-meals', area: 'Kothapeta', photo: null, isVerified: true, isSeed: false },
  author: { id: 'u9', name: 'Lakshmi', avatarUrl: null },
  likeCount: 2,
  commentCount: 1,
  likedByMe: false,
  isMine: false,
  isSeed: false,
  createdAt: new Date(Date.now() - 3_600_000).toISOString(),
  editedAt: null,
  ...o,
});
const comment = (o = {}) => ({ id: 'c1', postId: 'p1', text: 'Agreed, very fresh.', author: { id: 'u8', name: 'Anil', avatarUrl: null }, isMine: false, isSeed: false, createdAt: post().createdAt, ...o });
const page = (items) => ok(items, { page: 1, limit: 20, total: items.length, totalPages: 1 });
const signedIn = (o = {}) => ({ 'GET /auth/me': () => ok(sampleUser()), 'GET /favorites': () => ok([]), ...o });

describe('community feed', () => {
  it('shows posts with author, type, area, business and counts, and filters by type', async () => {
    const { calls } = mockApi({ 'GET /posts': ({ query }) => page(query.kind === 'question' ? [post({ id: 'p2', kind: 'question', text: 'Where is a good tailor?' })] : [post()]) });
    renderApp('/community');
    const user = userEvent.setup();
    const card = (await screen.findByText(/gongura chicken/)).closest('article');
    expect(within(card).getByText('Lakshmi')).toBeInTheDocument();
    expect(within(card).getByText('Recommendation')).toBeInTheDocument();
    expect(within(card).getByRole('link', { name: /^Padma Meals/ })).toHaveAttribute('href', '/businesses/padma-meals');
    expect(within(card).getByRole('button', { name: 'Like, 2 likes' })).toHaveAttribute('aria-pressed', 'false');
    expect(within(card).getByRole('link', { name: '1 comment' })).toHaveAttribute('href', '/community/p1#comments');
    await user.click(screen.getByRole('button', { name: 'Questions' }));
    expect(await screen.findByText('Where is a good tailor?')).toBeInTheDocument();
    expect(calls.some((c) => c.path === '/posts' && c.query.kind === 'question')).toBe(true);
  });

  it('visitors are sent to log in when they tap Like', async () => {
    mockApi({ 'GET /posts': () => page([post()]) });
    const { router } = renderApp('/community');
    const user = userEvent.setup();
    await user.click(await screen.findByRole('button', { name: 'Like, 2 likes' }));
    await waitFor(() => expect(router.state.location.pathname).toBe('/login'));
    expect(router.state.location.search).toBe('?next=%2Fcommunity');
  });

  it('signed-in people like and unlike; the count updates', async () => {
    let liked = false;
    const { calls } = mockApi(
      signedIn({
        'GET /posts': () => page([post({ likedByMe: liked, likeCount: liked ? 3 : 2 })]),
        'POST /posts/p1/like': () => {
          liked = true;
          return ok({ liked: true, likeCount: 3 });
        },
        'DELETE /posts/p1/like': () => {
          liked = false;
          return ok({ liked: false, likeCount: 2 });
        },
      }),
    );
    renderApp('/community');
    const user = userEvent.setup();
    await user.click(await screen.findByRole('button', { name: 'Like, 2 likes' }));
    expect(await screen.findByRole('button', { name: 'Like, 3 likes' })).toHaveAttribute('aria-pressed', 'true');
    await user.click(screen.getByRole('button', { name: 'Like, 3 likes' }));
    expect(await screen.findByRole('button', { name: 'Like, 2 likes' })).toHaveAttribute('aria-pressed', 'false');
    expect(calls.filter((c) => c.path === '/posts/p1/like').map((c) => c.method)).toEqual(['POST', 'DELETE']);
  });

  it('shows an empty state when there are no posts', async () => {
    mockApi({ 'GET /posts': () => page([]) });
    renderApp('/community');
    expect(await screen.findByText('No posts yet')).toBeInTheDocument();
  });
});

describe('writing a post', () => {
  it('needs sign-in', async () => {
    mockApi();
    const { router } = renderApp('/community/new');
    await waitFor(() => expect(router.state.location.pathname).toBe('/login'));
  });

  it('validates, then publishes the chosen type, text, area and linked business', async () => {
    const { calls } = mockApi(
      signedIn({
        'GET /businesses/padma-meals': () => ok({ id: 'b1', slug: 'padma-meals', name: 'Padma Meals', address: { area: 'Kothapeta' }, isVerified: true }),
        'POST /posts': ({ body }) => ({ status: 201, body: ok(post({ ...body, id: 'p9', isMine: true })) }),
        'GET /posts/p9': () => ok(post({ id: 'p9', isMine: true })),
        'GET /posts/p9/comments': () => page([]),
      }),
    );
    const { router } = renderApp('/community/new?business=padma-meals');
    const user = userEvent.setup();
    expect(await screen.findByRole('link', { name: /Padma Meals/ })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Post' }));
    expect(await screen.findByText('Write at least 3 characters.')).toBeInTheDocument();
    await user.click(screen.getByRole('radio', { name: 'Question' }));
    await user.type(screen.getByRole('textbox', { name: /Your post/ }), 'Is the Sunday thali still available?');
    await user.selectOptions(screen.getByRole('combobox', { name: 'Area (optional)' }), 'Kothapeta');
    await user.click(screen.getByRole('button', { name: 'Post' }));
    await waitFor(() => expect(router.state.location.pathname).toBe('/community/p9'));
    expect(calls.find((c) => c.method === 'POST' && c.path === '/posts').body).toEqual({
      kind: 'question',
      text: 'Is the Sunday thali still available?',
      area: 'Kothapeta',
      photo: null,
      businessId: 'b1',
    });
  });

  it('shows the daily limit message from the server', async () => {
    mockApi(
      signedIn({
        'POST /posts': () => ({ status: 429, body: { success: false, error: { code: 'RATE_LIMITED', message: 'You can post up to 10 times a day.' } } }),
      }),
    );
    renderApp('/community/new');
    const user = userEvent.setup();
    await user.type(await screen.findByRole('textbox', { name: /Your post/ }), 'Another update for today');
    await user.click(screen.getByRole('button', { name: 'Post' }));
    expect(await screen.findByText('You can post up to 10 times a day.')).toBeInTheDocument();
  });
});

describe('post page', () => {
  it('shows the full post and comments; signed-in people comment', async () => {
    let comments = [comment()];
    const { calls } = mockApi(
      signedIn({
        'GET /posts/p1': () => ok(post({ commentCount: comments.length })),
        'GET /posts/p1/comments': () => page(comments),
        'POST /posts/p1/comments': ({ body }) => {
          const c = comment({ id: 'c2', text: body.text, author: { id: 'u1', name: 'Ravi Kumar', avatarUrl: null }, isMine: true });
          comments = [...comments, c];
          return { status: 201, body: ok(c) };
        },
      }),
    );
    renderApp('/community/p1');
    const user = userEvent.setup();
    expect(await screen.findByText('Agreed, very fresh.')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: '1 comment' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^Report - comment by Anil/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^Save - Recommendation/ })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Send comment' }));
    expect(await screen.findByText('Write a comment first.')).toBeInTheDocument();
    await user.type(screen.getByRole('textbox', { name: 'Add a comment' }), 'Will try it this week.');
    await user.click(screen.getByRole('button', { name: 'Send comment' }));
    expect(await screen.findByText('Will try it this week.')).toBeInTheDocument();
    expect(calls.find((c) => c.method === 'POST' && c.path === '/posts/p1/comments').body).toEqual({ text: 'Will try it this week.' });
    expect(await screen.findByRole('heading', { name: '2 comments' })).toBeInTheDocument();
  });

  it('visitors see a log-in link instead of the comment box', async () => {
    mockApi({ 'GET /posts/p1': () => ok(post()), 'GET /posts/p1/comments': () => page([]) });
    renderApp('/community/p1');
    expect(await screen.findByRole('link', { name: 'Log in to comment' })).toHaveAttribute('href', '/login?next=%2Fcommunity%2Fp1');
    expect(screen.getByText('No comments yet. Be the first to reply.')).toBeInTheDocument();
  });

  it('authors edit and delete their own post (after confirming), and cannot report it', async () => {
    const { calls } = mockApi(
      signedIn({
        'GET /posts/p1': () => ok(post({ isMine: true })),
        'GET /posts/p1/comments': () => page([]),
        'DELETE /posts/p1': () => ok({ id: 'p1', status: 'removed' }),
        'GET /posts': () => page([]),
      }),
    );
    const { router } = renderApp('/community/p1');
    const user = userEvent.setup();
    expect(await screen.findByRole('link', { name: 'Edit' })).toHaveAttribute('href', '/community/p1/edit');
    expect(screen.queryByRole('button', { name: /^Report - / })).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Delete' }));
    const dialog = await screen.findByRole('dialog', { name: 'Delete this post?' });
    await user.click(within(dialog).getByRole('button', { name: 'Delete' }));
    await waitFor(() => expect(router.state.location.pathname).toBe('/community'));
    expect(calls.some((c) => c.method === 'DELETE' && c.path === '/posts/p1')).toBe(true);
  });

  it('a missing or hidden post shows "not available"', async () => {
    mockApi({ 'GET /posts/p1': () => ({ status: 404, body: { success: false, error: { code: 'NOT_FOUND', message: 'Post not found.' } } }) });
    renderApp('/community/p1');
    expect(await screen.findByText('Post not available')).toBeInTheDocument();
  });
});

describe('Post hub and saved posts', () => {
  it('the centre Post button opens the hub, which starts a community post', async () => {
    mockApi();
    const { router } = renderApp('/');
    const user = userEvent.setup();
    await user.click(within(await screen.findByRole('navigation', { name: 'Main navigation' })).getByRole('link', { name: 'Post' }));
    await waitFor(() => expect(router.state.location.pathname).toBe('/suggest'));
    expect(await screen.findByRole('link', { name: /Write a community post/ })).toHaveAttribute('href', '/community/new');
  });

  it('saved posts are listed in their own group', async () => {
    mockApi(signedIn({ 'GET /favorites': () => ok([{ id: 'f1', targetType: 'post', targetId: 'p1', createdAt: post().createdAt, item: post() }]) }));
    renderApp('/saved');
    expect(await screen.findByText('Community posts (1)')).toBeInTheDocument();
    expect(screen.getByText(/gongura chicken/)).toBeInTheDocument();
  });
});
