import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import { createHash } from 'node:crypto';
import { buildTestApp, connectTestDb, disconnectTestDb, clearTestDb, TEST_ORIGIN } from '../../tests/helpers.js';
import { loginAs } from '../../tests/factories.js';
import { resetEnvCache } from '../../config/env.js';
import { assertOwnImage, assertOwnImageUrl, assertOwnImages, signUpload } from './media.service.js';
import { signParams } from '../../common/integrations/cloudinary.js';

let app;
beforeAll(async () => {
  await connectTestDb();
  app = buildTestApp();
});
afterAll(disconnectTestDb);
beforeEach(clearTestDb);

const SECRET = process.env.CLOUDINARY_API_SECRET;
const img = (folder, id = 'abc123') => ({
  url: `https://res.cloudinary.com/test-cloud/image/upload/v1700000000/mana-tenali/${folder}/${id}.jpg`,
  publicId: `mana-tenali/${folder}/${id}`,
});

describe('POST /media/sign', () => {
  it('returns signed params for a logged-in user (avatar) without exposing the secret', async () => {
    const { agent } = await loginAs(app, 'user');
    const res = await agent.post('/api/v1/media/sign').send({ purpose: 'avatar' });
    expect(res.status).toBe(200);
    const d = res.body.data;
    expect(d).toMatchObject({
      uploadUrl: 'https://api.cloudinary.com/v1_1/test-cloud/image/upload',
      cloudName: 'test-cloud',
      apiKey: '123456789012345',
      maxBytes: 2 * 1024 * 1024,
      allowedTypes: ['image/jpeg', 'image/png', 'image/webp'],
    });
    expect(d.params).toMatchObject({ folder: 'mana-tenali/avatars', allowed_formats: 'jpg,jpeg,png,webp' });
    expect(d.params.transformation).toBe('c_limit,w_600,h_600');
    expect(d.signature).toBe(signParams(d.params, SECRET));
    expect(JSON.stringify(res.body)).not.toContain(SECRET);
  });

  it('enforces the role allowed for each purpose', async () => {
    const user = await loginAs(app, 'user');
    expect((await user.agent.post('/api/v1/media/sign').send({ purpose: 'business_photo' })).status).toBe(403);
    expect((await user.agent.post('/api/v1/media/sign').send({ purpose: 'event_banner' })).status).toBe(403);

    const owner = await loginAs(app, 'owner');
    expect((await owner.agent.post('/api/v1/media/sign').send({ purpose: 'business_photo' })).status).toBe(200);
    expect((await owner.agent.post('/api/v1/media/sign').send({ purpose: 'offer_image' })).status).toBe(200);
    expect((await owner.agent.post('/api/v1/media/sign').send({ purpose: 'news_cover' })).status).toBe(403);

    const admin = await loginAs(app, 'admin');
    for (const purpose of ['business_photo', 'offer_image', 'event_banner', 'news_cover', 'avatar']) {
      expect((await admin.agent.post('/api/v1/media/sign').send({ purpose })).status).toBe(200);
    }
  });

  it('requires login and a valid purpose', async () => {
    const anon = await request(app).post('/api/v1/media/sign').set('Origin', TEST_ORIGIN).send({ purpose: 'avatar' });
    expect(anon.status).toBe(401);
    const { agent } = await loginAs(app, 'admin');
    expect((await agent.post('/api/v1/media/sign').send({ purpose: 'video' })).status).toBe(400);
    expect((await agent.post('/api/v1/media/sign').send({ purpose: 'avatar', folder: '/' })).status).toBe(400);
  });

  describe('when Cloudinary is not configured', () => {
    let saved;
    beforeEach(() => {
      saved = process.env.CLOUDINARY_API_SECRET;
      delete process.env.CLOUDINARY_API_SECRET;
      resetEnvCache();
    });
    afterEach(() => {
      process.env.CLOUDINARY_API_SECRET = saved;
      resetEnvCache();
    });

    it('returns 503 SERVICE_UNAVAILABLE', async () => {
      const { agent } = await loginAs(app, 'user');
      const res = await agent.post('/api/v1/media/sign').send({ purpose: 'avatar' });
      expect(res.status).toBe(503);
      expect(res.body.error.code).toBe('SERVICE_UNAVAILABLE');
    });
  });
});

describe('media rules', () => {
  it('signature matches Cloudinary’s documented algorithm', () => {
    const params = { timestamp: 1315060510, public_id: 'sample_image', eager: 'w_400,h_300,c_pad' };
    const expected = createHash('sha1')
      .update('eager=w_400,h_300,c_pad&public_id=sample_image&timestamp=1315060510abcd')
      .digest('hex');
    expect(signParams(params, 'abcd')).toBe(expected);
  });

  it('signUpload uses the current time in seconds', () => {
    const r = signUpload({ role: 'admin' }, 'news_cover', 1_700_000_000_123);
    expect(r.params.timestamp).toBe(1_700_000_000);
    expect(r.params.folder).toBe('mana-tenali/news');
  });

  it('accepts only images from our account and the right folder', () => {
    expect(assertOwnImage(img('businesses'), 'business_photo')).toEqual(img('businesses'));
    const bad = [
      { ...img('businesses'), url: img('businesses').url.replace('test-cloud', 'other-cloud') },
      { url: 'https://evil.example/x.jpg', publicId: 'mana-tenali/businesses/x' },
      img('events'),
      { ...img('businesses'), publicId: 'mana-tenali/businesses/../events/x' },
      { ...img('businesses'), publicId: 'mana-tenali/businesses/other' },
    ];
    for (const b of bad) expect(() => assertOwnImage(b, 'business_photo')).toThrow();
  });

  it('checks avatar URLs and photo counts', () => {
    expect(assertOwnImageUrl(img('avatars').url, 'avatar')).toBe(img('avatars').url);
    expect(() => assertOwnImageUrl('https://example.com/me.png', 'avatar')).toThrow();
    expect(() => assertOwnImageUrl(img('businesses').url, 'avatar')).toThrow();
    const many = Array.from({ length: 9 }, (_, i) => img('businesses', `p${i}`));
    expect(() => assertOwnImages(many, 'business_photo', { max: 8 })).toThrow(/At most 8/);
    expect(assertOwnImages(many.slice(0, 8), 'business_photo', { max: 8 })).toHaveLength(8);
  });
});
