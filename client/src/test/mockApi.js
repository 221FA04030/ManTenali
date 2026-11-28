import { vi } from 'vitest';

/**
 * Route-based fetch mock. `handlers` maps "METHOD /path" (path without the
 * /api/v1 prefix and without query string) to a function returning
 * { status, body } or a plain envelope body. Unmatched calls -> 404 envelope.
 * GET /auth/me defaults to 401 (anonymous) unless overridden.
 */
export function mockApi(handlers = {}) {
  const calls = [];
  const fetchMock = vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init = {}) => {
    const url = new URL(String(input), 'http://localhost');
    const path = url.pathname.replace(/^\/api\/v1/, '');
    const method = (init.method ?? 'GET').toUpperCase();
    const body = init.body ? JSON.parse(init.body) : undefined;
    calls.push({ method, path, query: Object.fromEntries(url.searchParams), body });

    const key = `${method} ${path}`;
    let handler = handlers[key];
    if (!handler) {
      handler = Object.entries(handlers).find(([k]) => {
        const [m, pattern] = k.split(' ');
        if (m !== method || !pattern.includes(':')) return false;
        const rx = new RegExp(`^${pattern.replace(/:[^/]+/g, '[^/]+')}$`);
        return rx.test(path);
      })?.[1];
    }
    if (!handler && key === 'GET /auth/me') {
      handler = () => ({ status: 401, body: { success: false, error: { code: 'UNAUTHENTICATED', message: 'no' } } });
    }
    if (!handler) {
      return json({ success: false, error: { code: 'NOT_FOUND', message: `No mock for ${key}` } }, 404);
    }
    const result = await handler({ method, path, query: Object.fromEntries(url.searchParams), body });
    if (result && 'status' in result && 'body' in result) return json(result.body, result.status);
    return json(result, 200);
  });
  return { fetchMock, calls };
}

export const ok = (data, meta) => ({ success: true, data, ...(meta ? { meta } : {}) });

function json(body, status) {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

export const sampleUser = (overrides = {}) => ({
  id: 'u1',
  name: 'Ravi Kumar',
  email: 'ravi@example.com',
  role: 'user',
  avatarUrl: null,
  preferredArea: null,
  language: 'en',
  status: 'active',
  hasPassword: true,
  hasGoogle: false,
  ...overrides,
});
