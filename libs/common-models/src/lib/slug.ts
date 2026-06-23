/**
 * Slug logic — pure and portable (no Node/DOM APIs), so the server mints slugs and the
 * client validates them from one definition. This is the unit Lab 03's property tests target.
 */

/** Base32 alphabet with ambiguous glyphs (0/o, 1/l/i) removed for human-typeable slugs. */
export const SLUG_ALPHABET = '23456789abcdefghjkmnpqrstuvwxyz';

export const SLUG_MIN = 4;
export const SLUG_MAX = 32;
export const SLUG_DEFAULT_LENGTH = 7;

export const SLUG_PATTERN = new RegExp(`^[${SLUG_ALPHABET}]{${SLUG_MIN},${SLUG_MAX}}$`);

export function isValidSlug(slug: string): boolean {
  return SLUG_PATTERN.test(slug);
}

/**
 * Generate a random slug. Randomness is injected so the function stays pure and testable;
 * the API passes a crypto-backed source, tests pass a seeded one.
 *
 * @param random a function returning a float in [0, 1) — defaults to `Math.random`
 * @param length slug length, clamped to [SLUG_MIN, SLUG_MAX]
 */
export function generateSlug(random: () => number = Math.random, length: number = SLUG_DEFAULT_LENGTH): string {
  const len = Math.max(SLUG_MIN, Math.min(SLUG_MAX, Math.trunc(length)));
  let out = '';
  for (let i = 0; i < len; i++) {
    const idx = Math.min(SLUG_ALPHABET.length - 1, Math.floor(random() * SLUG_ALPHABET.length));
    out += SLUG_ALPHABET.charAt(idx);
  }
  return out;
}
