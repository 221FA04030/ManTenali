import { describe, it, expect } from 'vitest';
import { screen, within, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderApp } from '../../test/render.jsx';

describe('Home screen and app shell', () => {
  it('renders header, search and tiles; later-phase tiles are not tappable', async () => {
    renderApp('/');
    expect(await screen.findByText('Mana Tenali')).toBeInTheDocument();
    expect(screen.getByRole('searchbox', { name: 'Search Mana Tenali' })).toBeInTheDocument();

    const grid = screen.getByRole('region', { name: 'Browse categories' });
    expect(within(grid).getByRole('link', { name: /News & Updates/ })).toHaveAttribute('href', '/news');
    expect(within(grid).getByRole('link', { name: /Local Shops/ })).toHaveAttribute('href', '/businesses');
    expect(within(grid).getByRole('link', { name: /Services/ })).toHaveAttribute('href', '/businesses?kind=service');
    expect(within(grid).getByRole('link', { name: /More/ })).toHaveAttribute('href', '/explore');
    expect(within(grid).queryByRole('link', { name: /Bus Tracking/ })).toBeNull();
    expect(within(grid).queryByRole('link', { name: /Jobs/ })).toBeNull();
    expect(within(grid).getAllByText('Soon')).toHaveLength(2);
  });

  it('search submits to /search with the query', async () => {
    const { router } = renderApp('/');
    const user = userEvent.setup();
    await user.type(await screen.findByRole('searchbox'), 'biryani{Enter}');
    expect(router.state.location.pathname).toBe('/search');
    expect(router.state.location.search).toBe('?q=biryani');
  });

  it('bottom navigation marks the active tab and navigates', async () => {
    const { router } = renderApp('/');
    const user = userEvent.setup();
    const nav = await screen.findByRole('navigation', { name: 'Main navigation' });
    expect(within(nav).getByRole('link', { name: 'Home' })).toHaveAttribute('aria-current', 'page');
    await user.click(within(nav).getByRole('link', { name: 'Explore' }));
    expect(router.state.location.pathname).toBe('/explore');
    await waitFor(() =>
      expect(within(nav).getByRole('link', { name: 'Explore' })).toHaveAttribute('aria-current', 'page'),
    );
    for (const label of ['Suggest', 'Saved', 'Profile']) {
      expect(within(nav).getByRole('link', { name: label })).toBeInTheDocument();
    }
  });

  it('switches the UI to Telugu from the menu and remembers it', async () => {
    renderApp('/');
    const user = userEvent.setup();
    await user.click(await screen.findByRole('button', { name: 'Open menu' }));
    await user.click(screen.getByRole('button', { name: 'తెలుగు' }));
    expect(await screen.findAllByText('మన తెనాలి')).not.toHaveLength(0);
    expect(screen.getByText('స్థానిక దుకాణాలు')).toBeInTheDocument();
    expect(document.documentElement.lang).toBe('te');
    expect(JSON.parse(window.localStorage.getItem('mt.lang'))).toBe('te');
  });

  it('shows a not-found page for unknown routes', async () => {
    renderApp('/nope');
    expect(await screen.findAllByText('Page not found')).not.toHaveLength(0);
  });
});
