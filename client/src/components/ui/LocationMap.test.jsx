import { describe, it, expect } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import { renderWithProviders } from '../../test/render.jsx';
import { LocationMap } from './LocationMap.jsx';
import { OSM_TILES } from './LocationMapInner.jsx';

describe('LocationMap', () => {
  it('shows an OpenStreetMap map with attribution and a directions link', async () => {
    renderWithProviders(<LocationMap location={{ lat: 16.2379, lng: 80.6444 }} label="Padma Meals" />);
    const region = screen.getByRole('region', { name: 'Map: Padma Meals' });
    expect(screen.getByRole('link', { name: 'Get directions' })).toHaveAttribute(
      'href',
      'https://www.google.com/maps/dir/?api=1&destination=16.2379,80.6444',
    );
    await waitFor(() => expect(region.querySelector('.leaflet-container')).not.toBeNull());
    expect(region.querySelector('.leaflet-control-attribution').textContent).toMatch(/OpenStreetMap contributors/);
    const tile = region.querySelector('img.leaflet-tile');
    if (tile) expect(tile.getAttribute('src')).toMatch(/^https:\/\/tile\.openstreetmap\.org\/\d+\/\d+\/\d+\.png$/);
    expect(OSM_TILES).toBe('https://tile.openstreetmap.org/{z}/{x}/{y}.png');
  });

  it('shows nothing without a location', () => {
    renderWithProviders(<LocationMap location={null} label="x" />);
    expect(screen.queryByRole('region', { name: /Map/ })).toBeNull();
    expect(screen.queryByRole('link', { name: 'Get directions' })).toBeNull();
  });
});
