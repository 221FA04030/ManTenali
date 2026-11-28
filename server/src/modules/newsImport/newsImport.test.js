import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach, vi } from 'vitest';
import request from 'supertest';
import { buildTestApp, connectTestDb, disconnectTestDb, clearTestDb } from '../../tests/helpers.js';
import { loginAs } from '../../tests/factories.js';
import { resetEnvCache } from '../../config/env.js';
import { News } from '../news/news.model.js';
import { NewsImport, NewsImportRun } from './newsImport.model.js';
import { settleRunsForTests, readPost, draftText, SUMMARY_PLACEHOLDER } from './newsImport.service.js';

const TOKEN = 'apify_api_TEST_ONLY_not_a_real_token_123';
const SECRET = 'test-only-webhook-secret-0123456789abcdef';

/** Shape of a real item from sones/instagram-posts-scraper-lowcost (the one-post test, URLs shortened). */
const reel = (o = {}) => ({
  pk: '4040323809321517648',
  id: '4040323809321517648_72558278641',
  code: 'DgSHRkYKYJQ',
  taken_at: 1795864191,
  media_type: 2,
  product_type: 'clips',
  caption: { text: 'మాజీ సభ్యులు, సినీ నిర్మాత దాసరి కిరణ్ కుమార్ జన్మదిన వేడుకలు' },
  video_duration: 43.093334,
  image_url: 'https://instagram.example/cover.jpg',
  video_url: 'https://instagram.example/reel.mp4',
  user: { username: 'snewstenali', full_name: 'S NEWS TENALI' },
  scraped_username: 'snewstenali',
  post_url: 'https://www.instagram.com/p/DgSHRkYKYJQ/',
  ...o,
});
const photo = (o = {}) =>
  reel({ pk: '4040000000000000001', id: '4040000000000000001_72558278641', code: 'DgPHOTO0001', media_type: 1, product_type: 'feed', video_duration: null, video_url: null, caption: { text: 'Road repair on Bose Road from Monday morning' }, ...o });

let app;
let fetchSpy;
/** Answer Apify calls with `respond(url, init)`; everything Apify-bound is recorded. */
function mockApify(respond) {
  fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementation(async (url, init) => respond(String(url), init));
  return fetchSpy;
}
const json = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

beforeAll(async () => {
  await connectTestDb();
  app = buildTestApp();
});
afterAll(disconnectTestDb);
beforeEach(async () => {
  await clearTestDb();
  process.env.APIFY_TOKEN = TOKEN;
  process.env.APIFY_WEBHOOK_SECRET = SECRET;
  resetEnvCache();
});
afterEach(async () => {
  await settleRunsForTests();
  vi.restoreAllMocks();
  delete process.env.APIFY_TOKEN;
  delete process.env.APIFY_WEBHOOK_SECRET;
  resetEnvCache();
});

async function fetchAndWait(agent) {
  const start = await agent.post('/api/v1/admin/news-imports/fetch');
  expect(start.status).toBe(202);
  expect(start.body.data).toMatchObject({ status: 'running', trigger: 'manual', account: 'snewstenali', requested: 10 });
  await settleRunsForTests();
  return (await agent.get(`/api/v1/admin/news-imports/runs/${start.body.data.id}`)).body.data;
}

describe('reading Apify posts (no AI, caption only)', () => {
  it('keeps the post facts, never the video or image URL, and says the reel was not transcribed', () => {
    const { post } = readPost(reel(), 'snewstenali');
    expect(post).toMatchObject({
      postId: '4040323809321517648',
      shortCode: 'DgSHRkYKYJQ',
      postUrl: 'https://www.instagram.com/p/DgSHRkYKYJQ/',
      mediaType: 'reel',
      durationSec: 43,
      transcript: { status: 'not_transcribed' },
    });
    expect(post.postedAt.toISOString()).toBe('2026-11-28T11:09:51.000Z');
    expect(JSON.stringify(post)).not.toMatch(/mp4|cover\.jpg/);
  });

  it('marks posts without audio, and rejects other accounts and broken items', () => {
    expect(readPost(photo(), 'snewstenali').post).toMatchObject({ mediaType: 'image', transcript: { status: 'not_applicable' } });
    expect(readPost(reel({ user: { username: 'someoneelse' }, scraped_username: 'someoneelse' }), 'snewstenali').error).toMatch(/another account/);
    expect(readPost({ caption: { text: 'x' } }, 'snewstenali').error).toMatch(/incomplete/);
    expect(readPost(reel({ pk: undefined, id: 'abc' }), 'snewstenali').error).toMatch(/no Instagram id/);
  });

  it('starts the draft from the caption only; no caption means a placeholder the admin must replace', () => {
    const { post } = readPost(reel(), 'snewstenali');
    expect(draftText(post, 'S News Tenali')).toEqual({
      title: 'మాజీ సభ్యులు, సినీ నిర్మాత దాసరి కిరణ్ కుమార్ జన్మదిన వేడుకలు',
      summary: 'మాజీ సభ్యులు, సినీ నిర్మాత దాసరి కిరణ్ కుమార్ జన్మదిన వేడుకలు',
    });
    const { post: bare } = readPost(reel({ caption: null }), 'snewstenali');
    expect(draftText(bare, 'S News Tenali')).toEqual({ title: 'S News Tenali పోస్ట్ (28 Nov 2026)', summary: SUMMARY_PLACEHOLDER });
  });
});

describe('Fetch News (admin)', () => {
  it('fetches through the server with the token in the header only, and creates drafts for review', async () => {
    const calls = mockApify(() => json([reel(), photo()]));
    const { agent, user } = await loginAs(app, 'admin');
    const run = await fetchAndWait(agent);
    expect(run).toMatchObject({ status: 'succeeded', checked: 2, imported: 2, duplicates: 0, failed: 0, error: null });

    const [url, init] = calls.mock.calls[0];
    expect(url).toContain('/acts/sones~instagram-posts-scraper-lowcost/run-sync-get-dataset-items');
    expect(url).not.toContain(TOKEN);
    expect(init.headers.Authorization).toBe(`Bearer ${TOKEN}`);
    expect(JSON.parse(init.body)).toEqual({ usernames: ['snewstenali'], postsPerProfile: 10 });

    // Drafts only, attributed, linked to the post, with no image (the app's placeholder shows).
    const drafts = await News.find().lean();
    expect(drafts).toHaveLength(2);
    for (const n of drafts) {
      expect(n).toMatchObject({ status: 'draft', type: 'news', sourceName: 'S News Tenali' });
      expect(n.sourceUrl).toMatch(/^https:\/\/www\.instagram\.com\/p\/[A-Za-z0-9_-]+\/$/);
      expect(n.coverImage).toBeUndefined();
      expect(String(n.createdBy)).toBe(String(user._id));
    }
    expect((await request(app).get('/api/v1/news')).body.data).toHaveLength(0); // nothing public

    const list = await agent.get('/api/v1/admin/news-imports?status=needs_review');
    expect(list.status).toBe(200);
    expect(list.body.meta.counts).toMatchObject({ needs_review: 2, published: 0, rejected: 0, failed: 0 });
    const item = list.body.data.find((i) => i.shortCode === 'DgSHRkYKYJQ');
    expect(item).toMatchObject({
      status: 'needs_review',
      sourceName: 'S News Tenali',
      account: 'snewstenali',
      postUrl: 'https://www.instagram.com/p/DgSHRkYKYJQ/',
      mediaType: 'reel',
      durationSec: 43,
      transcript: { status: 'not_transcribed', text: null, language: null, method: null },
      news: { status: 'draft', title: 'మాజీ సభ్యులు, సినీ నిర్మాత దాసరి కిరణ్ కుమార్ జన్మదిన వేడుకలు' },
    });
    expect(item.postedAt).toBe('2026-11-28T11:09:51.000Z');
    expect(JSON.stringify(list.body)).not.toMatch(/mp4|cover\.jpg/);
  });

  it('skips posts already imported (same post id or link) and counts them as duplicates', async () => {
    mockApify(() => json([reel(), reel(), photo()])); // Apify can repeat a pinned post
    const { agent } = await loginAs(app, 'admin');
    expect(await fetchAndWait(agent)).toMatchObject({ checked: 3, imported: 2, duplicates: 1 });
    expect(await fetchAndWait(agent)).toMatchObject({ checked: 3, imported: 0, duplicates: 3, failed: 0 });
    expect(await NewsImport.countDocuments()).toBe(2);
    expect(await News.countDocuments()).toBe(2);
  });

  it('counts unusable posts as failed without stopping the others', async () => {
    mockApify(() => json([{ nonsense: true }, reel({ user: { username: 'other' }, scraped_username: 'other' }), photo()]));
    const { agent } = await loginAs(app, 'admin');
    expect(await fetchAndWait(agent)).toMatchObject({ status: 'succeeded', checked: 3, imported: 1, failed: 2 });
  });

  it('records a post whose draft could not be made as failed, and retries it on the next fetch', async () => {
    mockApify(() => json([reel()]));
    const { agent } = await loginAs(app, 'admin');
    const createSpy = vi.spyOn(News.prototype, 'save').mockRejectedValueOnce(new Error('db down'));
    expect(await fetchAndWait(agent)).toMatchObject({ imported: 0, failed: 1 });
    const failed = await NewsImport.findOne().lean();
    expect(failed).toMatchObject({ status: 'failed', error: expect.stringMatching(/retried on the next fetch/) });
    createSpy.mockRestore();
    expect(await fetchAndWait(agent)).toMatchObject({ imported: 1, failed: 0, duplicates: 0 });
    expect(await NewsImport.findOne().lean()).toMatchObject({ status: 'needs_review' });
  });

  it.each([
    [401, /rejected the server token/],
    [402, /run out of credit/],
    [429, /limiting requests/],
    [500, /HTTP 500/],
  ])('Apify HTTP %i ends the run with a useful message and no secrets', async (status, message) => {
    mockApify(() => json({ error: { message: `token ${TOKEN} bad` } }, status));
    const { agent } = await loginAs(app, 'admin');
    const run = await fetchAndWait(agent);
    expect(run.status).toBe('failed');
    expect(run.error).toMatch(message);
    expect(JSON.stringify(run)).not.toContain(TOKEN);
  });

  it('a timeout or network failure ends the run with a useful message', async () => {
    mockApify(() => {
      throw Object.assign(new Error('timed out'), { name: 'TimeoutError' });
    });
    const { agent } = await loginAs(app, 'admin');
    expect(await fetchAndWait(agent)).toMatchObject({ status: 'failed', error: expect.stringMatching(/did not answer in time/) });
    vi.restoreAllMocks();
    mockApify(() => {
      throw new TypeError('fetch failed');
    });
    expect(await fetchAndWait(agent)).toMatchObject({ status: 'failed', error: expect.stringMatching(/Could not reach Apify/) });
  });

  it('allows one fetch at a time; an interrupted one is closed after 15 minutes', async () => {
    const { agent, user } = await loginAs(app, 'admin');
    await NewsImportRun.create({ trigger: 'manual', account: 'snewstenali', startedBy: user._id });
    const busy = await agent.post('/api/v1/admin/news-imports/fetch');
    expect(busy.status).toBe(409);
    await NewsImportRun.updateMany({}, { startedAt: new Date(Date.now() - 16 * 60_000) });
    mockApify(() => json([]));
    expect(await fetchAndWait(agent)).toMatchObject({ status: 'succeeded', checked: 0 });
    expect(await NewsImportRun.countDocuments({ status: 'failed', error: /interrupted/ })).toBe(1);
    expect((await agent.get('/api/v1/admin/news-imports/runs/latest')).body.data).toMatchObject({ status: 'succeeded' });
  });

  it('says clearly when the server has no Apify token', async () => {
    delete process.env.APIFY_TOKEN;
    resetEnvCache();
    const { agent } = await loginAs(app, 'admin');
    const res = await agent.post('/api/v1/admin/news-imports/fetch');
    expect(res.status).toBe(503);
    expect(res.body.error.message).toMatch(/APIFY_TOKEN is missing/);
  });

  it('is for admins only', async () => {
    const calls = mockApify(() => json([]));
    expect((await request(app).post('/api/v1/admin/news-imports/fetch')).status).toBe(401);
    const { agent } = await loginAs(app, 'user');
    expect((await agent.post('/api/v1/admin/news-imports/fetch')).status).toBe(403);
    expect((await agent.get('/api/v1/admin/news-imports')).status).toBe(403);
    expect(calls).not.toHaveBeenCalled();
  });
});

describe('reviewing imported drafts', () => {
  async function imported() {
    mockApify(() => json([reel()]));
    const admin = await loginAs(app, 'admin');
    await fetchAndWait(admin.agent);
    const [item] = (await admin.agent.get('/api/v1/admin/news-imports')).body.data;
    return { ...admin, item };
  }
  const TITLE = 'దాసరి కిరణ్ కుమార్ జన్మదినం సందర్భంగా పేదలకు అన్నదానం';
  const SUMMARY =
    'దాసరి కిరణ్ కుమార్ జన్మదినం సందర్భంగా ఆయన మిత్ర మండలి రైల్వే స్టేషన్ దగ్గర పేదలకు అన్నదానం నిర్వహించింది. కార్యక్రమంలో పాల్గొన్న వక్త ఆయనకు ఆరోగ్యం, ఐశ్వర్యం కలగాలని ఆకాంక్షించారు.';

  it('saves edits as a draft, then publishes with the source attribution and link kept', async () => {
    const { agent, item } = await imported();
    const saved = await agent.patch(`/api/v1/admin/news-imports/${item.id}`).send({ title: TITLE, summary: SUMMARY });
    expect(saved.status).toBe(200);
    expect(saved.body.data).toMatchObject({ status: 'needs_review', news: { status: 'draft', title: TITLE, summary: SUMMARY } });

    const pub = await agent.post(`/api/v1/admin/news-imports/${item.id}/publish`).send({ title: TITLE, summary: SUMMARY });
    expect(pub.status).toBe(200);
    expect(pub.body.data).toMatchObject({ status: 'published', news: { status: 'published' } });
    const [publicItem] = (await request(app).get('/api/v1/news')).body.data;
    expect(publicItem).toMatchObject({ title: TITLE, sourceName: 'S News Tenali', sourceUrl: 'https://www.instagram.com/p/DgSHRkYKYJQ/', coverImage: null });

    expect((await agent.post(`/api/v1/admin/news-imports/${item.id}/publish`).send({ title: TITLE, summary: SUMMARY })).status).toBe(409);
  });

  it('will not publish the "write a summary" placeholder', async () => {
    mockApify(() => json([reel({ caption: null })]));
    const { agent } = await loginAs(app, 'admin');
    await fetchAndWait(agent);
    const [item] = (await agent.get('/api/v1/admin/news-imports')).body.data;
    expect(item.news.summary).toBe(SUMMARY_PLACEHOLDER);
    const res = await agent.post(`/api/v1/admin/news-imports/${item.id}/publish`).send({ title: TITLE, summary: SUMMARY_PLACEHOLDER });
    expect(res.status).toBe(400);
  });

  it('rejects: the draft is removed, never public, and the post is not imported again', async () => {
    const { agent, item } = await imported();
    const res = await agent.post(`/api/v1/admin/news-imports/${item.id}/reject`).send({ reason: 'Birthday wishes, not news' });
    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({ status: 'rejected', rejectReason: 'Birthday wishes, not news', news: { status: 'archived' } });
    expect((await request(app).get('/api/v1/news')).body.data).toHaveLength(0);
    expect(await fetchAndWait(agent)).toMatchObject({ imported: 0, duplicates: 1 });
  });

  it('validates the headline and summary', async () => {
    const { agent, item } = await imported();
    expect((await agent.patch(`/api/v1/admin/news-imports/${item.id}`).send({ title: 'x', summary: SUMMARY })).status).toBe(400);
    expect((await agent.post(`/api/v1/admin/news-imports/${item.id}/publish`).send({ title: TITLE, summary: 'short' })).status).toBe(400);
    expect((await agent.post(`/api/v1/admin/news-imports/${item.id}/publish`).send({ title: TITLE, summary: SUMMARY, status: 'x' })).status).toBe(400);
  });
});

describe('scheduled Apify task webhook', () => {
  const hook = (body, secret = SECRET) => {
    const req = request(app).post('/api/v1/integrations/apify/news-import');
    return (secret ? req.set('X-Mana-Tenali-Secret', secret) : req).send(body);
  };
  const succeeded = { eventType: 'ACTOR.RUN.SUCCEEDED', resource: { status: 'SUCCEEDED', defaultDatasetId: 'jWoCeqhYEWAz4BewM' }, userId: 'x' };

  it('imports the finished run\'s dataset as drafts', async () => {
    const calls = mockApify(() => json([reel()]));
    const res = await hook(succeeded);
    expect(res.status).toBe(202);
    expect(res.body.data).toMatchObject({ trigger: 'schedule', status: 'running' });
    await settleRunsForTests();
    expect(calls.mock.calls[0][0]).toContain('/datasets/jWoCeqhYEWAz4BewM/items?clean=true&format=json&limit=10');
    expect(await NewsImportRun.findById(res.body.data.id).lean()).toMatchObject({ status: 'succeeded', imported: 1 });
    const draft = await News.findOne().lean();
    expect(draft.status).toBe('draft');
    expect(draft.createdBy).toBeUndefined(); // scheduled: no admin pressed the button
  });

  it('needs the shared secret, and is off until one is configured', async () => {
    const calls = mockApify(() => json([reel()]));
    expect((await hook(succeeded, null)).status).toBe(401);
    expect((await hook(succeeded, 'wrong-secret')).status).toBe(401);
    delete process.env.APIFY_WEBHOOK_SECRET;
    resetEnvCache();
    expect((await hook(succeeded)).status).toBe(404);
    expect(calls).not.toHaveBeenCalled();
  });

  it('ignores other events and rejects malformed payloads', async () => {
    const calls = mockApify(() => json([reel()]));
    const ignored = await hook({ eventType: 'ACTOR.RUN.FAILED', resource: { status: 'FAILED' } });
    expect(ignored.status).toBe(200);
    expect(ignored.body.data.ignored).toBe(true);
    expect((await hook({ eventType: 'ACTOR.RUN.SUCCEEDED', resource: { defaultDatasetId: '../../x' } })).status).toBe(400);
    expect(calls).not.toHaveBeenCalled();
  });
});
