import request from 'supertest';
import { User } from '../modules/users/users.model.js';
import { hashPassword } from '../modules/users/users.service.js';
import { TEST_ORIGIN } from './helpers.js';

let counter = 0;
export const TEST_PASSWORD = 'correct-horse-battery';
let cachedHash;

/** Insert a user directly (bypassing the API) with a known password. */
export async function createUser(overrides = {}) {
  counter += 1;
  cachedHash ??= await hashPassword(TEST_PASSWORD);
  const user = await User.create({
    name: `Test User ${counter}`,
    email: `user${counter}-${Date.now()}@example.com`,
    passwordHash: cachedHash,
    role: 'user',
    ...overrides,
  });
  return user.toObject();
}

/** Insert a category directly. */
export async function createCategory(overrides = {}) {
  counter += 1;
  const { Category } = await import('../modules/categories/categories.model.js');
  const c = await Category.create({
    name: { en: `Category ${counter}` },
    slug: `category-${counter}`,
    type: 'business',
    ...overrides,
  });
  return c.toObject();
}

/** Insert a business directly (published by default). */
export async function createBusiness(overrides = {}) {
  counter += 1;
  const { Business } = await import('../modules/businesses/businesses.model.js');
  const categoryId = overrides.categoryId ?? (await createCategory())._id;
  const b = await Business.create({
    name: `Business ${counter}`,
    slug: `business-${counter}`,
    categoryId,
    kind: 'shop',
    address: { line: 'Main Road', area: 'Main Road' },
    location: { type: 'Point', coordinates: [80.6444, 16.2379] },
    status: 'published',
    ...overrides,
  });
  return b.toObject();
}

/** A supertest agent that sends the allowed Origin and carries the session cookie. */
export function agentFor(app) {
  return request.agent(app).set('Origin', TEST_ORIGIN);
}

/** Create a user with a role and return a logged-in agent. */
export async function loginAs(app, role = 'user', overrides = {}) {
  const user = await createUser({ role, ...overrides });
  const agent = agentFor(app);
  const res = await agent.post('/api/v1/auth/login').send({ email: user.email, password: TEST_PASSWORD });
  if (res.status !== 200) throw new Error(`login failed in test: ${res.status} ${JSON.stringify(res.body)}`);
  return { agent, user };
}
