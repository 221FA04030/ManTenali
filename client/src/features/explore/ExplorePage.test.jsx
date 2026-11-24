import { describe, it, expect } from 'vitest';
import { screen } from '@testing-library/react';
import { renderApp } from '../../test/render.jsx';

describe('Explore screen', () => {
  it('links Phase 1 sections and dims later-phase sections', async () => {
    renderApp('/explore');
    expect(await screen.findByRole('heading', { name: 'Explore Tenali' })).toBeInTheDocument();

    const shops = screen.getByRole('link', { name: /Local Shops & Businesses/ });
    expect(shops).toHaveAttribute('href', '/businesses');
    expect(screen.getByRole('link', { name: /Food & Restaurants/ })).toHaveAttribute('href', '/food');
    expect(screen.getByRole('link', { name: /Offers & Deals/ })).toHaveAttribute('href', '/offers');
    expect(screen.getByRole('link', { name: /News & Updates/ })).toHaveAttribute('href', '/news');
    expect(screen.getByRole('link', { name: /Events & Activities/ })).toHaveAttribute('href', '/events');

    for (const name of ['Transport', 'Public Services', 'Health & Hospitals', 'Education', 'Real Estate', 'Jobs & Internships']) {
      expect(screen.queryByRole('link', { name: new RegExp(name) })).toBeNull();
      const row = screen.getByText(name).closest('[data-coming-soon]');
      expect(row).toHaveAttribute('aria-disabled', 'true');
    }
    expect(screen.getAllByText('Coming soon')).toHaveLength(6);
  });
});
