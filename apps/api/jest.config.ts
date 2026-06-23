export default {
  displayName: 'api',
  preset: '../../jest.preset.js',
  testEnvironment: 'node',
  transform: {
    '^.+\\.[tj]s$': ['ts-jest', { tsconfig: '<rootDir>/tsconfig.spec.json' }],
  },
  moduleFileExtensions: ['ts', 'js', 'html'],
  // Exclude integration specs from the unit-test suite (they run via `npx nx run api:integration`)
  testPathIgnorePatterns: ['/node_modules/', '\\.integration\\.spec\\.ts$'],
  coverageDirectory: '../../coverage/apps/api',
  // Coverage floor on the unit-tested logic. Measured over the files the unit suite
  // exercises; floors sit just below the current baseline so a real regression trips them.
  coverageThreshold: {
    global: {
      statements: 82,
      branches: 58,
      functions: 58,
      lines: 82,
    },
  },
};
