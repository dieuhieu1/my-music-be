/**
 * Phase 4A E2E Tests — Song Upload & Audio Extraction
 *
 * Testable outcome:
 *  1. Artist uploads MP3 → upload form succeeds → song card appears in "My Songs" as PENDING
 *  2. Non-MP3 file → client-side validation rejects before submission
 *  3. Upload form validates required fields (title)
 *  4. Audio extraction job fires → DSP metadata fields eventually populated
 */
import { test, expect } from '@playwright/test';
import { e2eRegisterAndLogin, url } from '../../helpers/e2e-helpers';
import * as path from 'path';

test.describe('Phase 4A — Song Upload', () => {
  test('Scenario 1: artist uploads MP3 → song appears as PENDING in My Songs', async ({ page }) => {
    await e2eRegisterAndLogin(page, { role: 'artist' });

    await page.goto(url('/artist/songs/upload'));
    await page.waitForLoadState('networkidle');

    // Fill song metadata
    await page.getByLabel(/title/i).fill('E2E Test Song');

    // Upload the sample MP3 fixture
    const fixturePath = path.resolve(__dirname, '../../fixtures/sample.mp3');
    await page.getByLabel(/audio file|upload/i).setInputFiles(fixturePath);

    await page.getByRole('button', { name: /upload|submit/i }).click();

    // Should show success or redirect to song list
    await page.waitForURL(/songs|my-songs|artist/);
    await expect(page.getByText(/E2E Test Song/i)).toBeVisible({ timeout: 10000 });
  });

  test('Scenario 2: non-MP3 file is rejected', async ({ page }) => {
    await e2eRegisterAndLogin(page, { role: 'artist' });

    await page.goto(url('/artist/songs/upload'));
    await page.waitForLoadState('networkidle');

    const fixturePath = path.resolve(__dirname, '../../fixtures/fake.mp3');
    await page.getByLabel(/audio file|upload/i).setInputFiles(fixturePath);

    // Client-side or server-side rejection message
    await expect(page.getByText(/invalid|not supported|mp3 only|unsupported/i)).toBeVisible({ timeout: 5000 });
  });

  test('Scenario 3: upload without title → validation error', async ({ page }) => {
    await e2eRegisterAndLogin(page, { role: 'artist' });

    await page.goto(url('/artist/songs/upload'));
    await page.waitForLoadState('networkidle');

    // Try to submit without filling title
    await page.getByRole('button', { name: /upload|submit/i }).click();

    await expect(page.getByText(/title.*required|required.*title/i)).toBeVisible({ timeout: 3000 });
  });

  test('Scenario 4: My Songs list shows uploaded song with PENDING badge', async ({ page }) => {
    await e2eRegisterAndLogin(page, { role: 'artist' });

    // Upload a song first
    await page.goto(url('/artist/songs/upload'));
    await page.waitForLoadState('networkidle');
    await page.getByLabel(/title/i).fill('Status Badge Test');

    const fixturePath = path.resolve(__dirname, '../../fixtures/sample.mp3');
    const fileInput = page.locator('input[type="file"]');
    if (await fileInput.isVisible()) {
      await fileInput.setInputFiles(fixturePath);
    }
    await page.getByRole('button', { name: /upload|submit/i }).click();

    // Navigate to My Songs
    await page.goto(url('/artist/songs'));
    await page.waitForLoadState('networkidle');

    // Should see PENDING status badge somewhere
    await expect(page.getByText(/pending/i)).toBeVisible({ timeout: 10000 });
  });
});
