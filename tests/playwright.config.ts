import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  // Discover E2E test files for each phase
  testMatch: '**/e2e/**/*.spec.ts',
  testDir: '.',
  timeout: 30_000,
  retries: 1,
  fullyParallel: false,   // phases must run in order — use --project to run a single phase
  reporter: [['html', { outputFolder: '../test-results/playwright' }], ['list']],
  use: {
    baseURL: 'http://localhost:3000',
    // Persist cookies (access_token httpOnly cookie) across test steps
    storageState: undefined,
    // Capture screenshot on failure
    screenshot: 'only-on-failure',
    video: 'on-first-retry',
    trace: 'on-first-retry',
  },
  projects: [
    { name: 'phase1', testMatch: '**/phase1/e2e/**/*.spec.ts', use: { ...devices['Desktop Chrome'] } },
    { name: 'phase2', testMatch: '**/phase2/e2e/**/*.spec.ts', use: { ...devices['Desktop Chrome'] } },
    { name: 'phase3', testMatch: '**/phase3/e2e/**/*.spec.ts', use: { ...devices['Desktop Chrome'] } },
    { name: 'phase4a', testMatch: '**/phase4a/e2e/**/*.spec.ts', use: { ...devices['Desktop Chrome'] } },
    { name: 'phase4b', testMatch: '**/phase4b/e2e/**/*.spec.ts', use: { ...devices['Desktop Chrome'] } },
    { name: 'phase5', testMatch: '**/phase5/e2e/**/*.spec.ts', use: { ...devices['Desktop Chrome'] } },
    { name: 'phase6', testMatch: '**/phase6/e2e/**/*.spec.ts', use: { ...devices['Desktop Chrome'] } },
    { name: 'phase7', testMatch: '**/phase7/e2e/**/*.spec.ts', use: { ...devices['Desktop Chrome'] } },
    { name: 'phase8', testMatch: '**/phase8/e2e/**/*.spec.ts', use: { ...devices['Desktop Chrome'] } },
    { name: 'phase9', testMatch: '**/phase9/e2e/**/*.spec.ts', use: { ...devices['Desktop Chrome'] } },
  ],
  // Servers are started via docker-compose — not managed by Playwright here
  // webServer: undefined,
});
