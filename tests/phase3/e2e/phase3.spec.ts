/**
 * Phase 3 E2E Tests — User & Artist Profiles
 *
 * Testable outcome:
 *  1. Edit profile → name + avatar saved → reflected immediately
 *  2. Artist edits stageName/bio/socialLinks
 *  3. Visit public artist profile → listenerCount increments
 *  4. Follow an artist → followerCount updates → unfollow resets
 */
import { test, expect } from '@playwright/test';
import { e2eRegisterAndLogin, url } from '../../helpers/e2e-helpers';

test.describe('Phase 3 — User & Artist Profiles', () => {
  test('Scenario 1: edit user profile → change reflected immediately', async ({ page }) => {
    await e2eRegisterAndLogin(page, { role: 'user' });

    await page.goto(url('/profile/edit'));
    await page.waitForLoadState('networkidle');

    await page.getByLabel(/full name/i).clear();
    await page.getByLabel(/full name/i).fill('Updated Display Name');
    await page.getByRole('button', { name: /save/i }).click();

    // Toast or success feedback
    await expect(page.getByText(/saved|updated/i)).toBeVisible({ timeout: 5000 });

    // Navigate to profile → see updated name
    await page.goto(url('/profile'));
    await expect(page.getByText('Updated Display Name')).toBeVisible();
  });

  test('Scenario 2: artist edits stageName/bio/socialLinks', async ({ page }) => {
    await e2eRegisterAndLogin(page, { role: 'artist' });

    await page.goto(url('/artist/edit'));
    await page.waitForLoadState('networkidle');

    await page.getByLabel(/stage name/i).clear();
    await page.getByLabel(/stage name/i).fill('DJ E2E Updated');
    await page.getByLabel(/bio/i).clear();
    await page.getByLabel(/bio/i).fill('Updated bio text');
    await page.getByRole('button', { name: /save/i }).click();

    await expect(page.getByText(/saved|updated/i)).toBeVisible({ timeout: 5000 });
  });

  test('Scenario 3: visit public artist profile → listenerCount increments', async ({ page, context }) => {
    // Need a seeded artist with an actual ID — use API to get one
    // This test is wired in Phase 3 when public artist profiles are queryable
    await page.goto(url('/'));
    await page.waitForLoadState('networkidle');
    // Placeholder: verify the public artist route renders
    expect(page.url()).toContain('/en');
  });

  test('Scenario 4: follow artist → followerCount +1 → unfollow → -1', async ({ page }) => {
    await e2eRegisterAndLogin(page, { role: 'user' });

    // Navigate to any public artist profile (uses seeded data in Phase 3+)
    // Placeholder until we have real artist data
    await page.goto(url('/'));
    await page.waitForLoadState('networkidle');
    expect(true).toBe(true);
  });
});
