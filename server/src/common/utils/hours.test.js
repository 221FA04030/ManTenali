import { describe, it, expect } from 'vitest';
import { istNow, isOpenAt, isOvernight } from './hours.js';

// 2026-11-25 is a Wednesday (day 3). IST = UTC + 5:30.
const ist = (hhmm, dateStr = '2026-11-25') => new Date(`${dateStr}T${hhmm}:00+05:30`);

describe('opening hours (IST)', () => {
  it('converts any instant to IST weekday and time', () => {
    expect(istNow(new Date('2026-11-24T20:00:00Z'))).toEqual({ day: 3, time: '01:30' });
  });

  it('handles normal daytime slots', () => {
    const hours = [{ day: 3, open: '09:00', close: '21:00' }];
    expect(isOpenAt(hours, ist('08:59'))).toBe(false);
    expect(isOpenAt(hours, ist('09:00'))).toBe(true);
    expect(isOpenAt(hours, ist('20:59'))).toBe(true);
    expect(isOpenAt(hours, ist('21:00'))).toBe(false);
  });

  it('handles slots past midnight and closed days', () => {
    const hours = [{ day: 3, open: '18:00', close: '01:00' }, { day: 4, closed: true }];
    expect(isOvernight(hours[0])).toBe(true);
    expect(isOpenAt(hours, ist('23:30'))).toBe(true);
    expect(isOpenAt(hours, ist('00:30', '2026-11-26'))).toBe(true); // Thursday early hours
    expect(isOpenAt(hours, ist('12:00', '2026-11-26'))).toBe(false);
  });

  it('returns null when no hours are listed', () => {
    expect(isOpenAt([], ist('10:00'))).toBeNull();
  });
});
