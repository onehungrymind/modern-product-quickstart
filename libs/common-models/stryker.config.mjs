/**
 * Stryker mutation testing configuration for @tracer/common-models.
 *
 * Targets ONLY the two pure-logic files (slug.ts and expiry.ts).
 * The existing fast-check property tests provide the mutation-killing oracle.
 *
 * Run: npm run mutation
 *   or: stryker run libs/common-models/stryker.config.mjs
 */

/** @type {import('@stryker-mutator/api/core').PartialStrykerOptions} */
export default {
  _comment:
    'Mutation testing for the pure slug + expiry logic in @tracer/common-models',

  // ── Runner ────────────────────────────────────────────────────────────────
  testRunner: 'vitest',
  vitest: {
    // Point at the library's own vitest config so tsconfig paths resolve correctly
    configFile: 'libs/common-models/vitest.config.mts',
  },

  // ── Mutation scope ────────────────────────────────────────────────────────
  // Only mutate the two pure-logic modules; ignore schemas, index, and specs
  mutate: [
    'libs/common-models/src/lib/slug.ts',
    'libs/common-models/src/lib/expiry.ts',
  ],

  // ── Reporters ────────────────────────────────────────────────────────────
  reporters: ['html', 'clear-text', 'progress'],
  htmlReporter: {
    fileName: 'coverage/mutation/common-models/mutation.html',
  },

  // ── Thresholds ────────────────────────────────────────────────────────────
  // The fast-check property tests kill virtually all mutants.
  // `break: 75` is set just below the achieved score (~89-100%)
  // so CI fails if coverage regresses significantly.
  thresholds: {
    high: 80,
    low: 70,
    break: 75,
  },

  // ── Sandbox file exclusions ───────────────────────────────────────────────
  // Stryker copies the whole workspace into a sandbox. Exclude volatile
  // Nx workspace-data files (SQLite WAL, shm) that may disappear mid-copy,
  // and other large dirs we don't need in the sandbox.
  ignorePatterns: [
    '.nx/workspace-data/**',
    '.git/**',
    'dist/**',
    'coverage/**',
    '.stryker-tmp/**',
    'node_modules/**',
    'tmp/**',
  ],

  // ── Misc ──────────────────────────────────────────────────────────────────
  coverageAnalysis: 'perTest',
};
