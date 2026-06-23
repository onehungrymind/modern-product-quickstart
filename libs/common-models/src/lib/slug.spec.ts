import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { generateSlug, isValidSlug, SLUG_ALPHABET, SLUG_MIN, SLUG_MAX, SLUG_DEFAULT_LENGTH } from './slug';

describe('slug', () => {
  it('generates the default length and a valid slug with Math.random', () => {
    const slug = generateSlug();
    expect(slug).toHaveLength(SLUG_DEFAULT_LENGTH);
    expect(isValidSlug(slug)).toBe(true);
  });

  it('property: every generated slug validates and uses only the alphabet', () => {
    fc.assert(
      fc.property(fc.double({ min: 0, max: 0.999999, noNaN: true }), fc.integer({ min: SLUG_MIN, max: SLUG_MAX }), (r, len) => {
        const slug = generateSlug(() => r, len);
        expect(slug).toHaveLength(len);
        expect(isValidSlug(slug)).toBe(true);
        expect([...slug].every((c) => SLUG_ALPHABET.includes(c))).toBe(true);
      }),
    );
  });

  it('clamps length into [SLUG_MIN, SLUG_MAX]', () => {
    expect(generateSlug(Math.random, 1)).toHaveLength(SLUG_MIN);
    expect(generateSlug(Math.random, 999)).toHaveLength(SLUG_MAX);
  });

  it('rejects slugs with ambiguous or out-of-range characters', () => {
    expect(isValidSlug('abc')).toBe(false); // too short
    expect(isValidSlug('hello1')).toBe(false); // 'l', 'o', '1' are all excluded as ambiguous
    expect(isValidSlug('abcdefgh')).toBe(true); // all within the base32 alphabet
  });
});
