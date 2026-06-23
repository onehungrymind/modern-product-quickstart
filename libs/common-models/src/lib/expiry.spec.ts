import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { isExpired, isActive } from './expiry';

const NOW = new Date('2026-06-22T12:00:00.000Z');

describe('expiry', () => {
  it('a link with no expiry is never expired', () => {
    expect(isExpired({ expires_at: null }, NOW)).toBe(false);
    expect(isExpired({ expires_at: undefined }, NOW)).toBe(false);
    expect(isActive({ expires_at: null }, NOW)).toBe(true);
  });

  it('expires exactly at the boundary (<= now)', () => {
    expect(isExpired({ expires_at: NOW.toISOString() }, NOW)).toBe(true);
  });

  it('property: isExpired and isActive are exact complements', () => {
    fc.assert(
      fc.property(fc.option(fc.date({ min: new Date('2000-01-01'), max: new Date('2050-01-01'), noInvalidDate: true }), { nil: null }), (d) => {
        const link = { expires_at: d === null ? null : d.toISOString() };
        expect(isActive(link, NOW)).toBe(!isExpired(link, NOW));
      }),
    );
  });

  it('property: a future expiry is always active, a past one always expired', () => {
    fc.assert(
      fc.property(fc.integer({ min: 1, max: 10_000_000 }), (deltaMs) => {
        const future = new Date(NOW.getTime() + deltaMs).toISOString();
        const past = new Date(NOW.getTime() - deltaMs).toISOString();
        expect(isActive({ expires_at: future }, NOW)).toBe(true);
        expect(isExpired({ expires_at: past }, NOW)).toBe(true);
      }),
    );
  });
});
