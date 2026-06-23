import playwright from 'eslint-plugin-playwright';
import baseConfig from '../../eslint.config.mjs';

export default [
  playwright.configs['flat/recommended'],
  ...baseConfig,
  {
    files: ['**/*.ts', '**/*.js'],
    // Override or add rules here
    rules: {},
  },
  {
    // Generated BDD spec files — relax rules that don't apply to machine-generated code
    files: ['.features-gen/**/*.js', '.features-gen/**/*.ts'],
    rules: {
      'no-empty-pattern': 'off',
      'playwright/expect-expect': 'off',
    },
  },
  {
    // Step definition files — expect() is valid outside test() blocks in playwright-bdd
    // The empty object pattern {} is required by playwright-bdd for steps with no fixtures.
    files: ['steps/**/*.ts'],
    rules: {
      'playwright/no-standalone-expect': 'off',
      'no-empty-pattern': 'off',
    },
  },
  {
    // Ignore generated files entirely from linting
    ignores: ['.features-gen/**'],
  },
];
