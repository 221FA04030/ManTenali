import { describe, it, expect } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import { renderApp } from '../../test/render.jsx';
import { mockApi, ok } from '../../test/mockApi.js';

describe('Discover screen', () => {
  it('links Phase 1 sections and real categories, and dims later-phase sections', async () => {
    mockApi({
      'GET /categories': () =>
        ok([
          { id: 'c-health', slug: 'health-medical', parentId: null, name: { en: 'Health & Medical', te: null } },
          { id: 'c-edu', slug: 'education', parentId: null, name: { en: 'Education', te: null } },
        ]),
    });
    renderApp('/discover');
    expect(await screen.findByRole('heading', { name: 'Discover Tenali' })).toBeInTheDocument();

    expect(screen.getByRole('link', { name: /Local Shops & Businesses/ })).toHaveAttribute('href', '/businesses');
    expect(screen.getByRole('link', { name: /Food & Restaurants/ })).toHaveAttribute('href', '/food');
    expect(screen.getByRole('link', { name: /Offers & Deals/ })).toHaveAttribute('href', '/offers');
    expect(screen.getByRole('link', { name: /News & Updates/ })).toHaveAttribute('href', '/news');
    expect(screen.getByRole('link', { name: /Events & Activities/ })).toHaveAttribute('href', '/events');
    expect(screen.getByRole('link', { name: /Community/ })).toHaveAttribute('href', '/community');
    await waitFor(() => expect(screen.getByRole('link', { name: /Health & Medical/ })).toHaveAttribute('href', '/businesses?categoryId=c-health'));
    expect(screen.getByRole('link', { name: /Education/ })).toHaveAttribute('href', '/businesses?categoryId=c-edu');

    for (const name of ['Transport', 'Public Services', 'Real Estate', 'Jobs & Internships']) {
      expect(screen.queryByRole('link', { name: new RegExp(name) })).toBeNull();
      const row = screen.getByText(name).closest('[data-coming-soon]');
      expect(row).toHaveAttribute('aria-disabled', 'true');
    }
    expect(screen.getAllByText('Coming soon')).toHaveLength(4);
  });

  it('the old /explore address still works', async () => {
    const { router } = renderApp('/explore');
    await waitFor(() => expect(router.state.location.pathname).toBe('/discover'));
  });
});
