import { describe, it, expect, afterEach } from 'vitest';
import { istToday, endsIn, formatIsoDate, addOneYear, isIsoDate } from './dates.js';
import { validateOffer, offerToState } from '../features/offers/components/OfferForm.jsx';

/**
 * The browser may run in any time zone (including ones with daylight saving),
 * but offer dates are always Tenali (IST) calendar dates. These checks mirror
 * the server tests in offers.review.test.js.
 */
describe('date-only helpers are independent of the browser time zone', () => {
  const savedTz = process.env.TZ;
  afterEach(() => {
    process.env.TZ = savedTz;
  });

  for (const tz of ['UTC', 'Asia/Kolkata', 'America/New_York', 'Europe/London', 'Pacific/Auckland']) {
    it(`gives the same IST results with TZ=${tz}`, () => {
      process.env.TZ = tz;
      // IST "today" flips at 18:30 UTC
      expect(istToday(new Date('2026-11-25T18:29:59Z'))).toBe('2026-11-25');
      expect(istToday(new Date('2026-11-25T18:30:00Z'))).toBe('2026-11-26');
      // around US / EU daylight-saving changes
      expect(istToday(new Date('2026-03-08T07:30:00Z'))).toBe('2026-03-08');
      expect(istToday(new Date('2026-10-25T01:30:00Z'))).toBe('2026-10-25');
      // countdown uses IST calendar days
      const lateEveningIst = new Date('2026-11-25T23:59:00+05:30');
      expect(endsIn('2026-11-25', lateEveningIst)).toEqual({ key: 'offers.endsToday', count: 0 });
      expect(endsIn('2026-11-26', lateEveningIst)).toEqual({ key: 'offers.endsTomorrow', count: 1 });
      expect(endsIn('2027-11-25', lateEveningIst)).toEqual({ key: 'offers.endsInDays', count: 365 });
      // display never shifts the date
      expect(formatIsoDate('2026-12-31', 'en')).toBe('31 Dec 2026');
      expect(formatIsoDate('2028-02-29', 'en')).toBe('29 Feb 2028');
    });
  }

  it('calendar rules match the server', () => {
    expect(addOneYear('2026-11-25')).toBe('2027-11-25');
    expect(addOneYear('2028-02-29')).toBe('2029-03-01');
    expect(isIsoDate('2027-02-29')).toBe(false);
    expect(isIsoDate('2026-04-31')).toBe(false);
  });
});

describe('offer date rules match the server (shared table)', () => {
  const today = '2026-11-25';
  const plus = (n) => new Date(Date.UTC(2026, 10, 25 + n)).toISOString().slice(0, 10);
  const form = (s, e) => ({ ...offerToState(), title: 'Sale', discountLabel: '10% off', terms: 'Terms apply always.', validFrom: plus(s), validTo: plus(e) });

  it.each([
    [0, 0, null], // one-day offer
    [0, 364, null],
    [5, 4, 'offers.v.endBeforeStart'],
    [-5, -1, 'offers.v.endPast'],
    [-3, 2, null], // already running
    [0, 365, 'offers.v.maxYear'], // same date next year is not allowed
  ])('start %i, end %i -> %s', (s, e, expected) => {
    expect(validateOffer(form(s, e), undefined, today).validTo ?? null).toBe(expected);
  });

  it('an unchanged past end date is allowed when editing (as on the server)', () => {
    expect(validateOffer(form(-10, -3), { validToDate: plus(-3) }, today)).toEqual({});
    expect(validateOffer(form(-10, -1), { validToDate: plus(-3) }, today)).toEqual({ validTo: 'offers.v.endPast' });
  });
});
