import { describe, it, expect } from 'vitest';
import { act, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderApp } from '../test/render.jsx';
import { mockApi, ok } from '../test/mockApi.js';
import i18n from './i18n.js';

describe('everyday usability', () => {
  it('password fields have a Show password button that does not submit the form', async () => {
    const { calls } = mockApi();
    renderApp('/login');
    const user = userEvent.setup();
    const field = await screen.findByLabelText('Password');
    expect(field).toHaveAttribute('type', 'password');
    expect(field).toHaveAttribute('autocomplete', 'current-password');
    await user.type(field, 'my secret');
    const toggle = screen.getByRole('button', { name: 'Show password' });
    expect(toggle).toHaveAttribute('aria-pressed', 'false');
    await user.click(toggle);
    expect(field).toHaveAttribute('type', 'text');
    expect(field).toHaveValue('my secret');
    expect(screen.getByRole('button', { name: 'Hide password' })).toHaveAttribute('aria-pressed', 'true');
    await user.click(screen.getByRole('button', { name: 'Hide password' }));
    expect(field).toHaveAttribute('type', 'password');
    expect(calls.some((c) => c.path === '/auth/login')).toBe(false); // toggling never submits
  });

  it('every page names itself in the browser tab, in the chosen language', async () => {
    mockApi({ 'GET /news': () => ok([], { page: 1, limit: 20, total: 0, totalPages: 0 }) });
    const { unmount } = renderApp('/news');
    await waitFor(() => expect(document.title).toBe('News & Updates · Mana Tenali'));
    unmount();
    renderApp('/');
    await waitFor(() => expect(document.title).toBe('Mana Tenali - Your Tenali, In One App'));
    await act(() => i18n.changeLanguage('te'));
    await waitFor(() => expect(document.title).toMatch(/^మన తెనాలి - /));
  });

  it('shows a calm offline notice that goes away when the connection returns', async () => {
    renderApp('/');
    await screen.findByRole('button', { name: 'Search Mana Tenali' });
    const setOnline = (value) => {
      Object.defineProperty(window.navigator, 'onLine', { value, configurable: true });
      act(() => window.dispatchEvent(new Event(value ? 'online' : 'offline')));
    };
    try {
      setOnline(false);
      expect(await screen.findByText('You are offline.')).toBeInTheDocument();
      expect(screen.getByText(/You can still read what is already on screen/)).toBeInTheDocument();
      setOnline(true);
      await waitFor(() => expect(screen.queryByText('You are offline.')).not.toBeInTheDocument());
    } finally {
      delete window.navigator.onLine;
    }
  });

  it('new pages open at the top, and Back returns to the previous position', async () => {
    const { router } = renderApp('/');
    await screen.findByRole('button', { name: 'Search Mana Tenali' });
    window.scrollTo.mockClear();
    await act(() => router.navigate('/discover'));
    await waitFor(() => expect(window.scrollTo).toHaveBeenCalledWith(0, 0));
    window.scrollTo.mockClear();
    await act(() => router.navigate(-1));
    await waitFor(() => expect(window.scrollTo).toHaveBeenCalled()); // restores the saved position for Home
  });
});
