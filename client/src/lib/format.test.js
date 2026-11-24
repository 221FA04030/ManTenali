import { describe, it, expect } from 'vitest';
import { formatDateTime, formatINR, formatDistance, formatRelative } from './format.js';
import { whatsappUrl, telUrl } from './geo.js';

describe('format', () => {
  it('displays UTC times in IST', () => {
    // 2026-01-01T00:00Z is 05:30 IST
    expect(formatDateTime('2026-01-01T00:00:00Z', 'en')).toMatch(/5:30/);
  });
  it('formats rupees', () => {
    expect(formatINR(1250)).toBe('₹1,250');
  });
  it('formats distances', () => {
    expect(formatDistance(347)).toBe('350 m');
    expect(formatDistance(2420)).toBe('2.4 km');
  });
  it('formats relative times', () => {
    const now = Date.parse('2026-01-01T12:00:00Z');
    expect(formatRelative('2026-01-01T10:00:00Z', 'en', now)).toBe('2 hours ago');
  });
  it('builds contact links', () => {
    expect(whatsappUrl('98480 12345')).toBe('https://wa.me/919848012345');
    expect(telUrl('+91 98480-12345')).toBe('tel:+919848012345');
  });
});
