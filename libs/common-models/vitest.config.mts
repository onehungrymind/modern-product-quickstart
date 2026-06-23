import { defineConfig } from 'vitest/config';
import { nxViteTsPaths } from '@nx/vite/plugins/nx-tsconfig-paths.plugin';
import { nxCopyAssetsPlugin } from '@nx/vite/plugins/nx-copy-assets.plugin';

export default defineConfig(() => ({
  root: __dirname,
  cacheDir: '../../node_modules/.vite/libs/common-models',
  plugins: [nxViteTsPaths(), nxCopyAssetsPlugin(['*.md'])],
  test: {
    name: 'common-models',
    watch: false,
    globals: true,
    environment: 'node',
    include: ['{src,tests}/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}'],
    reporters: ['default'],
    coverage: {
      reportsDirectory: '../../coverage/libs/common-models',
      provider: 'v8' as const,
      // Include only the pure-logic modules (slug + expiry).
      // The schemas/ folder contains declarative Zod schema objects with no
      // executable branches — coverage thresholds would never be meaningful there.
      include: ['src/lib/slug.ts', 'src/lib/expiry.ts'],
      // The slug + expiry pure-logic files are 100% covered by the property tests.
      // Thresholds are set just below the measured 100% to give headroom while
      // still enforcing a meaningful floor.
      thresholds: {
        statements: 90,
        functions: 90,
        lines: 90,
        branches: 80,
      },
    },
  },
}));
