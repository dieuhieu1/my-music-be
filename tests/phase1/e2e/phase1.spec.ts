/**
 * Phase 1 E2E Tests — App Shell & Routing
 *
 * Testable outcome:
 *   http://localhost:3000 → Next.js app loads with empty shell, no errors
 *   Locale routing: /en/* and /vi/* prefixes work
 *   Middleware redirects: unauthenticated (app) routes → /login
 *                         authenticated (auth) routes → /browse
 */
import { test, expect } from '@playwright/test';

const BASE = 'http://localhost:3000';

test.describe('Phase 1 — App Shell', () => {
  test('root / redirects to /en (default locale)', async ({ page }) => {
    await page.goto(BASE);
    await page.waitForURL(/\/en/);
    expect(page.url()).toContain('/en');
  });

  test('home page loads without JS errors', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (err) => errors.push(err.message));

    await page.goto(`${BASE}/en`);
    await page.waitForLoadState('networkidle');

    expect(errors).toHaveLength(0);
  });

  test('page title contains "My Music"', async ({ page }) => {
    await page.goto(`${BASE}/en`);
    await expect(page).toHaveTitle(/My Music/i);
  });

  test('/vi locale loads correctly', async ({ page }) => {
    await page.goto(`${BASE}/vi`);
    await page.waitForLoadState('networkidle');
    expect(page.url()).toContain('/vi');
  });

  test('unauthenticated user visiting /en/browse → redirect to /en/login', async ({ page }) => {
    // Clear all cookies to ensure logged out state
    await page.context().clearCookies();
    await page.goto(`${BASE}/en/browse`);
    await page.waitForURL(/\/login/);
    expect(page.url()).toContain('/login');
  });

  test('unauthenticated user visiting /en/profile → redirect to /en/login', async ({ page }) => {
    await page.context().clearCookies();
    await page.goto(`${BASE}/en/profile`);
    await page.waitForURL(/\/login/);
  });

  test('unauthenticated user visiting /en/admin → redirect to /en/login', async ({ page }) => {
    await page.context().clearCookies();
    await page.goto(`${BASE}/en/admin`);
    await page.waitForURL(/\/login/);
  });

  test('public artist profile page is accessible without auth', async ({ page }) => {
    await page.context().clearCookies();
    // Route exists — returns 200 (even with a fake ID, it renders the placeholder)
    const res = await page.goto(`${BASE}/en/artists/00000000-0000-0000-0000-000000000000`);
    // The page should render (not redirect to login)
    expect(page.url()).not.toContain('/login');
  });

  test('LanguageSwitcher is present on home page', async ({ page }) => {
    await page.goto(`${BASE}/en`);
    await page.waitForLoadState('networkidle');
    // The switcher renders EN and VI buttons
    const en = page.getByRole('button', { name: 'EN' });
    const vi = page.getByRole('button', { name: 'VI' });
    await expect(en).toBeVisible();
    await expect(vi).toBeVisible();
  });

  test('LanguageSwitcher switches locale to /vi', async ({ page }) => {
    await page.goto(`${BASE}/en`);
    await page.waitForLoadState('networkidle');
    await page.getByRole('button', { name: 'VI' }).click();
    await page.waitForURL(/\/vi/);
    expect(page.url()).toContain('/vi');
  });

  test('login page renders (A4)', async ({ page }) => {
    await page.goto(`${BASE}/en/login`);
    await page.waitForLoadState('networkidle');
    await expect(page.getByRole('heading', { name: /sign in/i })).toBeVisible();
  });

  test('register page renders (A1/A2)', async ({ page }) => {
    await page.goto(`${BASE}/en/register`);
    await page.waitForLoadState('networkidle');
    await expect(page.getByRole('heading', { name: /create account/i })).toBeVisible();
  });

  test('forgot-password page renders (A5)', async ({ page }) => {
    await page.goto(`${BASE}/en/forgot-password`);
    await page.waitForLoadState('networkidle');
    await expect(page.getByRole('heading', { name: /forgot password/i })).toBeVisible();
  });
});
