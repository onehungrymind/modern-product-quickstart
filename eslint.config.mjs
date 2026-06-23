import nx from '@nx/eslint-plugin';

export default [
  ...nx.configs['flat/base'],
  ...nx.configs['flat/typescript'],
  ...nx.configs['flat/javascript'],
  {
    ignores: ['**/dist', '**/out-tsc', '**/vitest.config.*.timestamp*'],
  },
  {
    files: ['**/*.ts', '**/*.tsx', '**/*.js', '**/*.jsx'],
    rules: {
      '@nx/enforce-module-boundaries': [
        'error',
        {
          enforceBuildableLibDependency: true,
          allow: ['^.*/eslint(\\.base)?\\.config\\.[cm]?[jt]s$'],
          // Tracer dependency graph — inner-ring module boundaries (carried from the SEALD reference).
          // type: domain (common-models) & ui-tokens (design-tokens) are the leaf cores: depend on nothing.
          // data → domain · state → data+domain · ui → ui-tokens+domain · app → everything.
          // scope: api & web may both use shared; web-only libs stay out of api.
          depConstraints: [
            { sourceTag: 'type:domain', onlyDependOnLibsWithTags: [] },
            { sourceTag: 'type:ui-tokens', onlyDependOnLibsWithTags: [] },
            {
              sourceTag: 'type:data',
              onlyDependOnLibsWithTags: ['type:domain'],
            },
            {
              sourceTag: 'type:state',
              onlyDependOnLibsWithTags: ['type:data', 'type:domain'],
            },
            {
              sourceTag: 'type:ui',
              onlyDependOnLibsWithTags: ['type:ui-tokens', 'type:domain'],
            },
            {
              sourceTag: 'type:app',
              onlyDependOnLibsWithTags: [
                'type:ui',
                'type:state',
                'type:data',
                'type:domain',
                'type:ui-tokens',
              ],
            },
            {
              sourceTag: 'scope:shared',
              onlyDependOnLibsWithTags: ['scope:shared'],
            },
            {
              sourceTag: 'scope:api',
              onlyDependOnLibsWithTags: ['scope:api', 'scope:shared'],
            },
            {
              sourceTag: 'scope:web',
              onlyDependOnLibsWithTags: ['scope:web', 'scope:shared'],
            },
          ],
        },
      ],
    },
  },
  {
    files: [
      '**/*.ts',
      '**/*.tsx',
      '**/*.cts',
      '**/*.mts',
      '**/*.js',
      '**/*.jsx',
      '**/*.cjs',
      '**/*.mjs',
    ],
    // Override or add rules here
    rules: {},
  },
];
