import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import request from 'supertest';
import { buildTestApp, connectTestDb, disconnectTestDb, clearTestDb, TEST_ORIGIN } from '../../tests/helpers.js';
import { agentFor, createUser, loginAs, TEST_PASSWORD } from '../../tests/factories.js';
import { User } from '../users/users.model.js';

vi.mock('../../common/integrations/googleAuth.js', () => ({
  verifyGoogleIdToken: vi.fn(),
}));
const { verifyGoogleIdToken } = await import('../../common/integrations/googleAuth.js');

let app;
beforeAll(async () => {
  await connectTestDb();
  app = buildTestApp();
});
afterAll(disconnectTestDb);
beforeEach(clearTestDb);

const register = (body) => request(app).post('/api/v1/auth/register').set('Origin', TEST_ORIGIN).send(body);

describe('POST /auth/register', () => {
  it('creates a user, sets an httpOnly session cookie and never returns the hash', async () => {
    const res = await register({ name: 'Ravi Kumar', email: 'Ravi@Example.com', password: 'longpassword1' });
    expect(res.status).toBe(201);
    expect(res.body.data).toMatchObject({ name: 'Ravi Kumar', email: 'ravi@example.com', role: 'user', language: 'en' });
    expect(JSON.stringify(res.body)).not.toMatch(/passwordHash|\$2b\$/);
    const cookie = res.headers['set-cookie'].join(';');
    expect(cookie).toMatch(/mt_session=/);
    expect(cookie).toMatch(/HttpOnly/i);
    expect(cookie).toMatch(/SameSite=Lax/i);
    const stored = await User.findOne({ email: 'ravi@example.com' }).select('+passwordHash').lean();
    expect(stored.passwordHash).toMatch(/^\$2b\$12\$/);
  });

  it('rejects a duplicate email with 409', async () => {
    await register({ name: 'A User', email: 'dup@example.com', password: 'longpassword1' });
    const res = await register({ name: 'B User', email: 'DUP@example.com', password: 'longpassword2' });
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('CONFLICT');
  });

  it('validates input and rejects attempts to set a role', async () => {
    const res = await register({ name: 'X', email: 'not-an-email', password: 'short', role: 'admin' });
    expect(res.status).toBe(400);
    const fields = res.body.error.details.map((d) => d.field);
    expect(fields).toEqual(expect.arrayContaining(['body.name', 'body.email', 'body.password']));
    expect(await User.countDocuments()).toBe(0);
  });
});

describe('POST /auth/login, GET /auth/me, POST /auth/logout', () => {
  it('logs in, keeps the session across requests and logs out', async () => {
    const user = await createUser();
    const agent = agentFor(app);
    const login = await agent.post('/api/v1/auth/login').send({ email: user.email, password: TEST_PASSWORD });
    expect(login.status).toBe(200);
    expect(login.body.data.id).toBe(String(user._id));

    const me = await agent.get('/api/v1/auth/me');
    expect(me.status).toBe(200);
    expect(me.body.data.email).toBe(user.email);

    const out = await agent.post('/api/v1/auth/logout');
    expect(out.status).toBe(200);
    const after = await agent.get('/api/v1/auth/me');
    expect(after.status).toBe(401);
  });

  it('rejects wrong passwords and unknown emails with the same 401', async () => {
    const user = await createUser();
    const wrong = await request(app)
      .post('/api/v1/auth/login')
      .set('Origin', TEST_ORIGIN)
      .send({ email: user.email, password: 'nope-nope-nope' });
    const unknown = await request(app)
      .post('/api/v1/auth/login')
      .set('Origin', TEST_ORIGIN)
      .send({ email: 'ghost@example.com', password: 'nope-nope-nope' });
    expect(wrong.status).toBe(401);
    expect(unknown.status).toBe(401);
    expect(wrong.body.error.message).toBe(unknown.body.error.message);
  });

  it('blocks login and existing sessions for blocked users', async () => {
    const { agent, user } = await loginAs(app, 'user');
    await User.updateOne({ _id: user._id }, { status: 'blocked' });
    expect((await agent.get('/api/v1/auth/me')).status).toBe(403);
    const res = await request(app)
      .post('/api/v1/auth/login')
      .set('Origin', TEST_ORIGIN)
      .send({ email: user.email, password: TEST_PASSWORD });
    expect(res.status).toBe(403);
  });

  it('returns 401 for missing or forged session cookies', async () => {
    expect((await request(app).get('/api/v1/auth/me')).status).toBe(401);
    const forged = await request(app).get('/api/v1/auth/me').set('Cookie', 'mt_session=eyJhbGciOiJub25lIn0.e30.');
    expect(forged.status).toBe(401);
  });
});

describe('POST /auth/google', () => {
  const idToken = 'x'.repeat(40);

  it('creates an account on first Google sign-in and reuses it after', async () => {
    verifyGoogleIdToken.mockResolvedValue({
      googleId: 'g-123',
      email: 'priya@gmail.com',
      emailVerified: true,
      name: 'Priya',
      picture: 'https://lh3.googleusercontent.com/a/x',
    });
    const first = await request(app).post('/api/v1/auth/google').set('Origin', TEST_ORIGIN).send({ idToken });
    expect(first.status).toBe(200);
    expect(first.body.data).toMatchObject({ name: 'Priya', email: 'priya@gmail.com', role: 'user', hasGoogle: true });
    const second = await request(app).post('/api/v1/auth/google').set('Origin', TEST_ORIGIN).send({ idToken });
    expect(second.body.data.id).toBe(first.body.data.id);
    expect(await User.countDocuments()).toBe(1);
  });

  it('links Google to an existing email account when the email is verified', async () => {
    const user = await createUser({ email: 'link@example.com' });
    verifyGoogleIdToken.mockResolvedValue({ googleId: 'g-777', email: 'link@example.com', emailVerified: true, name: 'L' });
    const res = await request(app).post('/api/v1/auth/google').set('Origin', TEST_ORIGIN).send({ idToken });
    expect(res.body.data.id).toBe(String(user._id));
    expect(res.body.data.hasPassword).toBe(true);
    expect(res.body.data.hasGoogle).toBe(true);
  });

  it('rejects an invalid Google token with 401', async () => {
    const { AppError } = await import('../../common/errors/index.js');
    verifyGoogleIdToken.mockRejectedValue(AppError.unauthenticated('bad token'));
    const res = await request(app).post('/api/v1/auth/google').set('Origin', TEST_ORIGIN).send({ idToken });
    expect(res.status).toBe(401);
  });
});
