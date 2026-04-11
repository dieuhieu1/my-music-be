import type { Config } from 'jest';

const config: Config = {
  // Run all API integration tests under tests/phase*/api/
  testMatch: ['<rootDir>/phase*/api/**/*.spec.ts'],
  transform: { '^.+\\.tsx?$': ['ts-jest', { tsconfig: '<rootDir>/tsconfig.json' }] },
  testEnvironment: 'node',
  // Allow up to 30 s per test (real DB + real HTTP round-trips)
  testTimeout: 30_000,
  // Run phases sequentially so DB state is predictable across test files
  maxWorkers: 1,
  // Map @mymusic/types to the local package source
  moduleNameMapper: {
    '^@mymusic/types$': '<rootDir>/../packages/types/src/index.ts',
  },
  globalSetup: '<rootDir>/helpers/global-setup.ts',
  globalTeardown: '<rootDir>/helpers/global-teardown.ts',
  // Collect coverage across all phases when running with --coverage
  collectCoverageFrom: [
    '../apps/api/src/**/*.ts',
    '!../apps/api/src/**/*.module.ts',
    '!../apps/api/src/main.ts',
    '!../apps/api/src/database/migrations/**',
  ],
};

export default config;
