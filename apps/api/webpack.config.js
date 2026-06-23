const { composePlugins, withNx } = require('@nx/webpack');
const { join } = require('path');
const nodeExternals = require('webpack-node-externals');

// withNx gives the standard Node/Nest build (tsc compile, assets, generatePackageJson).
// The customizer then sets externals explicitly: all real node_modules stay external
// (required at runtime / installed in the image), but the @tracer/* workspace libs are
// BUNDLED from source — their package `main` points at unpublished TypeScript via a
// node_modules symlink, so they must be compiled into the bundle for the standalone
// `node dist/apps/api/main.js` (and the container image) to run.
const rootNodeModules = join(__dirname, '..', '..', 'node_modules');

module.exports = composePlugins(
  withNx({
    target: 'node',
    compiler: 'tsc',
    main: join(__dirname, 'src/main.ts'),
    tsConfig: join(__dirname, 'tsconfig.app.json'),
    assets: [join(__dirname, 'src/assets')],
    optimization: false,
    outputHashing: 'none',
    generatePackageJson: true,
    sourceMap: true,
    useTsconfigPaths: true,
  }),
  (config) => {
    config.output = {
      ...config.output,
      path: join(__dirname, '../../dist/apps/api'),
      clean: true,
    };
    // Let webpack treat Node builtins (incl. the `node:` scheme) as external.
    config.externalsPresets = { ...(config.externalsPresets || {}), node: true };
    config.externals = [
      nodeExternals({
        modulesDir: rootNodeModules,
        allowlist: [/^@tracer\//],
        importType: 'node-commonjs',
      }),
    ];
    return config;
  },
);
