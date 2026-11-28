import { describe, it, expect, vi, afterEach } from 'vitest';
import { screen, within, waitFor, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderApp } from '../../test/render.jsx';
import { mockApi, ok } from '../../test/mockApi.js';
import { ENGAGEMENT, HOME_FEATURES } from '../../config/features.js';
import { applyEvent, decayed, mergeAdd, rankFeatures } from './engagement/scoring.js';
import {
  getSnapshot,
  resetEngagementForTests,
  sessionOrder,
  setEngagementOwner,
  trackFeature,
  trackLocation,
} from './engagement/engagementStore.js';

const DAY = 86_400_000;
const NOW = Date.parse('2026-11-28T10:00:00.000Z');
const rank = (features, now = NOW) => rankFeatures(HOME_FEATURES, features, now, ENGAGEMENT);
const top8 = (features, now) => rank(features, now).slice(0, 8);

/** Simulate someone using one feature over several sessions. */
function use(features, feature, sessions, perSession = 1, start = NOW - sessions * DAY) {
  let f = features;
  for (let s = 0; s < sessions; s += 1) {
    for (let i = 0; i < perSession; i += 1) {
      f = applyEvent(f, { feature, type: 'open', sessionId: `s${s}`, now: start + s * DAY + i * 60_000 }, ENGAGEMENT);
    }
  }
  return f;
}

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('engagement scoring', () => {
  it('weights opens, actions and returns as configured, and decays with time', () => {
    let f = applyEvent({}, { feature: 'news', type: 'open', sessionId: 'a', now: NOW }, ENGAGEMENT);
    expect(f.news.score).toBe(ENGAGEMENT.weights.open);
    f = applyEvent(f, { feature: 'news', type: 'action', sessionId: 'a', now: NOW }, ENGAGEMENT);
    expect(f.news.score).toBe(ENGAGEMENT.weights.open + ENGAGEMENT.weights.action);
    // Same feature in a new session: open + return bonus.
    f = applyEvent(f, { feature: 'news', type: 'open', sessionId: 'b', now: NOW }, ENGAGEMENT);
    expect(f.news.score).toBe(2 * ENGAGEMENT.weights.open + ENGAGEMENT.weights.action + ENGAGEMENT.weights.return);
    // Half as much after one half-life.
    expect(decayed(f.news, NOW + ENGAGEMENT.halfLifeDays * DAY, ENGAGEMENT)).toBeCloseTo(f.news.score / 2);
  });

  it('a first-time visitor gets the balanced default order', () => {
    expect(top8({})).toEqual(['food', 'offers', 'news', 'events', 'shopping', 'healthMedical', 'community', 'services']);
  });

  it('someone who keeps opening News & Updates gets it first; someone who uses Offers gets Offers first', () => {
    expect(top8(use({}, 'news', 4))[0]).toBe('news');
    expect(top8(use({}, 'offers', 4))[0]).toBe('offers');
    // A feature from More features moves onto Home once it is used regularly.
    expect(top8({})).not.toContain('hotels');
    expect(top8(use({}, 'hotels', 3))).toContain('hotels');
  });

  it('adapts gradually: one tap does not reshuffle Home, and old interest fades', () => {
    const once = applyEvent({}, { feature: 'businesses', type: 'open', sessionId: 'a', now: NOW }, ENGAGEMENT);
    expect(top8(once)).toEqual(top8({})); // still in More features
    const newsFan = use({}, 'news', 5, 2, NOW - 120 * DAY);
    const offersNow = use({}, 'offers', 3);
    expect(rank({ ...newsFan, ...offersNow }).indexOf('offers')).toBeLessThan(rank({ ...newsFan, ...offersNow }).indexOf('news'));
  });

  it('adds signed-out use to the account scores', () => {
    const merged = mergeAdd({ news: { score: 4, updatedAt: new Date(NOW).toISOString(), lastSession: 'a' } }, { news: { score: 2, updatedAt: new Date(NOW).toISOString(), lastSession: 'b' } }, NOW, ENGAGEMENT);
    expect(merged.news.score).toBe(6);
  });
});

describe('engagement store', () => {
  it('ignores repeated rapid opens and the same action twice, and counts real page visits', async () => {
    await setEngagementOwner(null);
    expect(trackFeature('offers')).toBe(true);
    expect(trackFeature('offers')).toBe(false); // a double tap or back-and-forth within 30 s
    expect(trackLocation('/offers/o1')).toBe(true); // opening an offer is a meaningful action
    expect(trackLocation('/offers/o1')).toBe(false); // the same one again in this session
    expect(trackLocation('/profile')).toBe(false); // not a Home feature
    expect(trackFeature('not-a-feature')).toBe(false);
    expect(getSnapshot().features.offers.score).toBe(ENGAGEMENT.weights.open + ENGAGEMENT.weights.action);
  });

  it('a business opened from Food counts for Food', async () => {
    await setEngagementOwner(null);
    trackLocation('/food');
    trackLocation('/businesses/padma-meals');
    expect(getSnapshot().features.food.score).toBe(ENGAGEMENT.weights.open + ENGAGEMENT.weights.action);
  });

  it('signed-out scores and the session order survive a refresh', async () => {
    await setEngagementOwner(null);
    for (let i = 0; i < 6; i += 1) {
      vi.spyOn(Date, 'now').mockReturnValue(NOW + i * 60_000 * 5);
      trackFeature('news', 'action', `n${i}`);
    }
    vi.restoreAllMocks();
    const before = getSnapshot().features;
    resetEngagementForTests(); // the page reloads: memory is gone, localStorage is not
    await setEngagementOwner(null);
    expect(getSnapshot().features).toEqual(before);
    const order = sessionOrder('anon', () => rank(getSnapshot().features, Date.now()));
    expect(order[0]).toBe('news');
    // Within the session the order is kept, even if the scores change meanwhile.
    expect(sessionOrder('anon', () => ['food'])).toEqual(order);
  });

  it('keeps each signed-in user\'s scores separate, and saves them to their account', async () => {
    const saved = {};
    mockApi({
      'GET /users/me/engagement': () => ok({ features: {} }),
      'PATCH /users/me/engagement': ({ body }) => ok({ features: body.features, applied: true }),
    });
    await setEngagementOwner('ua');
    trackFeature('news');
    saved.a = getSnapshot().features;
    await setEngagementOwner('ub');
    expect(getSnapshot().features).toEqual({});
    trackFeature('offers');
    await setEngagementOwner('ua');
    expect(Object.keys(getSnapshot().features)).toEqual(['news']);
    expect(saved.a.news.score).toBe(1);
  });

  it('adds signed-out use to the account once after login, then clears it', async () => {
    await setEngagementOwner(null);
    trackFeature('offers');
    trackFeature('offers', 'action', 'o1');
    const anonId = JSON.parse(window.localStorage.getItem('mt.engagement.anon')).id;
    const { calls } = mockApi({
      'GET /users/me/engagement': () => ok({ features: { news: { score: 2, updatedAt: new Date().toISOString(), lastSession: 'x' } } }),
      'PATCH /users/me/engagement': ({ body }) => ok({ features: body.features, applied: true }),
    });
    await setEngagementOwner('u1');
    const patch = calls.find((c) => c.method === 'PATCH');
    expect(patch.body.mergeId).toBe(anonId);
    expect(patch.body.features.offers.score).toBe(3);
    expect(patch.body.features.news.score).toBeCloseTo(2);
    expect(window.localStorage.getItem('mt.engagement.anon')).toBeNull();
    expect(getSnapshot()).toMatchObject({ owner: 'u:u1', ready: true });

    // Already added (e.g. the first response was lost): the server says so and nothing is counted twice.
    resetEngagementForTests();
    window.localStorage.setItem('mt.engagement.anon', JSON.stringify({ id: anonId, features: { offers: { score: 3, updatedAt: new Date().toISOString() } } }));
    window.localStorage.removeItem('mt.engagement.user.u1');
    mockApi({
      'GET /users/me/engagement': () => ok({ features: { offers: { score: 3, updatedAt: new Date().toISOString() } } }),
      'PATCH /users/me/engagement': () => ok({ features: { offers: { score: 3, updatedAt: new Date().toISOString() } }, applied: false }),
    });
    await setEngagementOwner('u1');
    expect(getSnapshot().features.offers.score).toBe(3);
  });
});

const photoPost = (id, o = {}) => ({
  id, kind: 'update', text: `Evening at the canal ${id}`, area: 'Kothapeta', business: null,
  photo: { url: `https://res.cloudinary.com/demo/image/upload/v1/mana-tenali/posts/${id}.jpg`, publicId: `mana-tenali/posts/${id}` },
  author: { id: 'u9', name: 'Lakshmi', avatarUrl: null }, likeCount: 4, commentCount: 2, likedByMe: false, isMine: false,
  isSeed: false, createdAt: '2026-11-28T08:00:00.000Z', editedAt: null, ...o,
});

describe('Home personalised shortcuts (screen)', () => {
  it('shows a returning user\'s most used feature first, and keeps the More features tile last', async () => {
    const at = new Date().toISOString();
    window.localStorage.setItem('mt.engagement.anon', JSON.stringify({ id: 'anon-1234567890', features: { news: { score: 12, updatedAt: at, lastSession: 'old' } } }));
    renderApp('/');
    const grid = await screen.findByRole('region', { name: 'Browse categories' });
    await waitFor(() => expect(within(grid).getAllByRole('link')[0]).toHaveTextContent('News & Updates'));
    expect(within(grid).getAllByRole('link')).toHaveLength(8);
    const children = [...grid.children];
    expect(children.at(-1)).toHaveAccessibleName(/More features/); // the button comes after the 8 shortcuts
  });

  it('opening a shortcut counts as using that feature', async () => {
    const { router } = renderApp('/');
    const grid = await screen.findByRole('region', { name: 'Browse categories' });
    await userEvent.setup().click(within(grid).getByRole('link', { name: /Offers/ }));
    await waitFor(() => expect(router.state.location.pathname).toBe('/offers'));
    await waitFor(() => expect(getSnapshot().features.offers?.score).toBe(1));
  });
});

describe('Home Community Posts', () => {
  it('shows real photo posts with author, place, time, likes and comments; a post opens its detail page', async () => {
    const posts = [photoPost('p1'), photoPost('p2', { text: 'New park benches', area: null, likeCount: 1, commentCount: 0 })];
    const { calls } = mockApi({
      'GET /posts': () => ok(posts),
      'GET /posts/:id': () => ok(posts[0]),
      'GET /posts/:id/comments': () => ok([], { page: 1, limit: 50, total: 0, totalPages: 0 }),
    });
    const { router } = renderApp('/');
    const section = await screen.findByRole('region', { name: /Community Posts/ });
    expect(within(section).getByText("What's happening around Tenali?")).toBeInTheDocument();
    const feed = await within(section).findByRole('group', { name: 'Community posts with photos' });
    expect(calls.find((c) => c.path === '/posts').query).toMatchObject({ withPhoto: 'true', limit: '12' });

    const card = within(feed).getByRole('link', { name: /Post by Lakshmi: Evening at the canal p1/ });
    expect(card.querySelector('img').getAttribute('src')).toContain('/mana-tenali/posts/p1.jpg');
    expect(card.querySelector('img')).toHaveAttribute('loading', 'lazy');
    expect(card).toHaveTextContent('Kothapeta');
    expect(within(card).getByLabelText('4 likes')).toBeInTheDocument();
    expect(within(card).getByLabelText('2 comments')).toBeInTheDocument();
    // Copies used for the seamless loop are hidden from screen readers and the keyboard.
    expect(within(feed).getAllByRole('link')).toHaveLength(2);

    await userEvent.setup().click(card);
    await waitFor(() => expect(router.state.location.pathname).toBe('/community/p1'));
  });

  it('pauses while touched and moves again after the touch', async () => {
    mockApi({ 'GET /posts': () => ok([photoPost('p1')]) });
    renderApp('/');
    const feed = await screen.findByRole('group', { name: 'Community posts with photos' });
    const track = feed.querySelector('.float-track');
    expect(track.style.animationPlayState).toBe('running');
    fireEvent.pointerDown(feed, { pointerType: 'touch' });
    expect(feed).toHaveAttribute('data-paused', 'true');
    expect(track.style.animationPlayState).toBe('paused');
    fireEvent.pointerUp(feed, { pointerType: 'touch' });
    await waitFor(() => expect(feed).toHaveAttribute('data-paused', 'false'), { timeout: 4000 });
  });

  it('two rows moving opposite ways when there are enough posts', async () => {
    mockApi({ 'GET /posts': () => ok(['a', 'b', 'c', 'd', 'e', 'f'].map((id) => photoPost(id))) });
    renderApp('/');
    const feed = await screen.findByRole('group', { name: 'Community posts with photos' });
    const tracks = feed.querySelectorAll('.float-track');
    expect(tracks).toHaveLength(2);
    expect(tracks[1]).toHaveClass('float-track-reverse');
  });

  it('respects reduced motion: a still row people can scroll', async () => {
    vi.stubGlobal('matchMedia', (q) => ({
      matches: q.includes('prefers-reduced-motion'), media: q, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {},
    }));
    mockApi({ 'GET /posts': () => ok([photoPost('p1')]) });
    renderApp('/');
    const list = await screen.findByRole('list', { name: 'Community posts with photos' });
    expect(list.querySelector('.float-track')).toBeNull();
    expect(within(list).getAllByRole('link')).toHaveLength(1);
  });

  it('a clean empty state when nobody has posted a photo yet', async () => {
    renderApp('/');
    const section = await screen.findByRole('region', { name: /Community Posts/ });
    expect(await within(section).findByText(/No photo posts yet/)).toBeInTheDocument();
    expect(within(section).getByRole('link', { name: 'Share a post' })).toHaveAttribute('href', '/community/new');
  });

  it('a useful error with retry when posts cannot load, and broken images are left out', async () => {
    let fail = true;
    mockApi({
      'GET /posts': () => (fail ? { status: 500, body: { success: false, error: { code: 'INTERNAL_ERROR', message: 'x' } } } : ok([photoPost('p1'), photoPost('p2')])),
      'GET /home': () => ok({ banner: [], today: { notices: [], nextEvent: null }, nearby: { mode: 'all', items: [] }, offers: [], events: [], news: [], food: [], featured: [], community: [] }),
    });
    renderApp('/');
    const section = await screen.findByRole('region', { name: /Community Posts/ });
    const retry = await within(section).findByRole('button', { name: 'Try again' });
    fail = false;
    await userEvent.setup().click(retry);
    const feed = await within(section).findByRole('group', { name: 'Community posts with photos' });
    fireEvent.error(within(feed).getByRole('link', { name: /canal p2/ }).querySelector('img'));
    await waitFor(() => expect(within(feed).queryByRole('link', { name: /canal p2/ })).toBeNull());
    expect(within(feed).getByRole('link', { name: /canal p1/ })).toBeInTheDocument();
  });

  it('leaves room for the bottom navigation under the last section', async () => {
    renderApp('/');
    const main = await screen.findByRole('main');
    expect(main.parentElement).toHaveClass('pb-nav');
  });
});
