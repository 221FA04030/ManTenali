import { describe, it, expect, afterEach, vi } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderApp } from '../../test/render.jsx';
import { mockApi, ok, sampleUser } from '../../test/mockApi.js';
import { safeNext } from './pages/LoginPage.jsx';

afterEach(() => vi.restoreAllMocks());

describe('safeNext', () => {
  it('only allows same-app relative paths', () => {
    expect(safeNext('/events')).toBe('/events');
    expect(safeNext('//evil.com')).toBe('/profile');
    expect(safeNext('https://evil.com')).toBe('/profile');
    expect(safeNext('/\\evil.com')).toBe('/profile');
    expect(safeNext(null)).toBe('/profile');
  });
});

describe('login and profile', () => {
  it('redirects anonymous users from /profile to login, then back after logging in', async () => {
    const { calls } = mockApi({
      'POST /auth/login': ({ body }) =>
        body.password === 'secret-pass' ? ok(sampleUser()) : { status: 401, body: { success: false, error: { code: 'UNAUTHENTICATED', message: 'x' } } },
    });
    const { router } = renderApp('/profile');
    const user = userEvent.setup();

    await waitFor(() => expect(router.state.location.pathname).toBe('/login'));
    expect(router.state.location.search).toBe('?next=%2Fprofile');

    await user.type(await screen.findByLabelText('Email'), 'ravi@example.com');
    await user.type(screen.getByLabelText('Password'), 'wrong');
    await user.click(screen.getByRole('button', { name: 'Log in' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Email or password is incorrect.');

    await user.clear(screen.getByLabelText('Password'));
    await user.type(screen.getByLabelText('Password'), 'secret-pass');
    await user.click(screen.getByRole('button', { name: 'Log in' }));

    await waitFor(() => expect(router.state.location.pathname).toBe('/profile'));
    expect(await screen.findByDisplayValue('Ravi Kumar')).toBeInTheDocument();
    const loginCall = calls.find((c) => c.path === '/auth/login' && c.body.password === 'secret-pass');
    expect(loginCall.body).toEqual({ email: 'ravi@example.com', password: 'secret-pass' });
  });

  it('validates the sign-up form before calling the API', async () => {
    const { calls } = mockApi();
    renderApp('/login?mode=register');
    const user = userEvent.setup();
    await user.click(await screen.findByRole('button', { name: 'Create account' }));
    expect(await screen.findByText('Name must be 2 to 80 characters.')).toBeInTheDocument();
    expect(screen.getByText('Enter a valid email address.')).toBeInTheDocument();
    expect(screen.getByText('Password must be 8 to 72 characters.')).toBeInTheDocument();
    expect(calls.some((c) => c.path === '/auth/register')).toBe(false);
  });

  it('shows server field errors on sign-up (duplicate email)', async () => {
    mockApi({
      'POST /auth/register': () => ({
        status: 409,
        body: { success: false, error: { code: 'CONFLICT', message: 'dup', details: [{ field: 'body.email', message: 'Email already registered' }] } },
      }),
    });
    renderApp('/login?mode=register');
    const user = userEvent.setup();
    await user.type(await screen.findByLabelText('Full name'), 'Ravi');
    await user.type(screen.getByLabelText('Email'), 'ravi@example.com');
    await user.type(screen.getByLabelText('Password'), 'longenough1');
    await user.click(screen.getByRole('button', { name: 'Create account' }));
    expect(await screen.findByText('Email already registered')).toBeInTheDocument();
  });

  it('updates the profile and switches language from the saved preference', async () => {
    const { calls } = mockApi({
      'GET /auth/me': () => ok(sampleUser()),
      'PATCH /users/me': ({ body }) => ok(sampleUser({ ...body })),
    });
    renderApp('/profile');
    const user = userEvent.setup();
    const name = await screen.findByLabelText('Full name');
    await user.clear(name);
    await user.type(name, 'Ravi K');
    await user.selectOptions(screen.getByLabelText('Preferred area'), 'Bose Road');
    await user.selectOptions(screen.getByLabelText('Language'), 'te');
    await user.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => expect(calls.some((c) => c.method === 'PATCH')).toBe(true));
    expect(calls.find((c) => c.method === 'PATCH').body).toEqual({ name: 'Ravi K', preferredArea: 'Bose Road', language: 'te' });
    expect(await screen.findByText('ప్రొఫైల్ ఫోటో')).toBeInTheDocument();
  });

  it('shows a forbidden screen to non-admins on /admin', async () => {
    mockApi({ 'GET /auth/me': () => ok(sampleUser()) });
    renderApp('/admin');
    expect(await screen.findAllByText('Not allowed')).not.toHaveLength(0);
  });

  it('logs out from the profile', async () => {
    const { calls } = mockApi({
      'GET /auth/me': () => ok(sampleUser()),
      'POST /auth/logout': () => ok({ loggedOut: true }),
    });
    const { router } = renderApp('/profile');
    const user = userEvent.setup();
    await user.click(await screen.findByRole('button', { name: 'Log out' }));
    await waitFor(() => expect(router.state.location.pathname).toBe('/login'));
    expect(calls.some((c) => c.path === '/auth/logout')).toBe(true);
  });
});
