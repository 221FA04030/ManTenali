import { describe, it, expect } from 'vitest';
import { slugify, generateUniqueSlug } from './slug.js';
import { getPagination, buildMeta } from './pagination.js';
import { toPoint, fromPoint, distanceMeters, clampRadiusKm, isValidLatLng } from './geo.js';

describe('slug', () => {
  it('slugifies names', () => {
    expect(slugify('Sri Krishna Sweets & Bakery!')).toBe('sri-krishna-sweets-and-bakery');
    expect(slugify('  Café  Déjà vu ')).toBe('cafe-deja-vu');
  });
  it('falls back for non-Latin names', () => {
    expect(slugify('తెనాలి')).toBe('item');
  });
  it('adds a suffix on collision', async () => {
    const taken = new Set(['bose-road-tiffins']);
    const slug = await generateUniqueSlug('Bose Road Tiffins', async (s) => taken.has(s));
    expect(slug).toMatch(/^bose-road-tiffins-[a-z0-9]{5}$/);
  });
});

describe('pagination', () => {
  it('defaults and clamps', () => {
    expect(getPagination({})).toEqual({ page: 1, limit: 20, skip: 0 });
    expect(getPagination({ page: '3', limit: '500' })).toEqual({ page: 3, limit: 50, skip: 100 });
    expect(getPagination({ page: '-2', limit: '0' })).toEqual({ page: 1, limit: 20, skip: 0 });
  });
  it('builds meta', () => {
    expect(buildMeta({ page: 1, limit: 20, total: 84 })).toEqual({
      page: 1,
      limit: 20,
      total: 84,
      totalPages: 5,
    });
    expect(buildMeta({ page: 1, limit: 20, total: 0 }).totalPages).toBe(0);
  });
});

describe('geo', () => {
  it('builds GeoJSON points in [lng, lat] order', () => {
    expect(toPoint(16.24, 80.64)).toEqual({ type: 'Point', coordinates: [80.64, 16.24] });
    expect(fromPoint({ coordinates: [80.64, 16.24] })).toEqual({ lat: 16.24, lng: 80.64 });
    expect(() => toPoint(100, 0)).toThrow();
    expect(isValidLatLng(16, 80)).toBe(true);
  });
  it('computes distances in metres', () => {
    const d = distanceMeters({ lat: 16.2379, lng: 80.6444 }, { lat: 16.2479, lng: 80.6444 });
    expect(d).toBeGreaterThan(1100);
    expect(d).toBeLessThan(1120);
  });
  it('clamps radius', () => {
    expect(clampRadiusKm(undefined)).toBe(5);
    expect(clampRadiusKm(100)).toBe(25);
    expect(clampRadiusKm(3)).toBe(3);
  });
});
