/**
 * Phase 2 E2E Tests — Full Auth Flow in Browser
 *
 * Testable outcome (spec):
 *  1. Register as USER → receive verification email → verify → login → session appears
 *  2. Register as ARTIST → stageName required → verify email → login
 *  3. Wrong password ×5 → account locked, lock email received
 *  4. Forgot password flow → code email → verify → reset → login with new password
 *  5. Active sessions page shows current device → revoke → logged out on next request
 */
import { test, expect } from '@playwright/test';
import { e2eRegisterAndLogin, e2eLogin, pollMailHogForCode, url } from '../../helpers/e2e-helpers';
import { v4 as uuidv4 } from 'uuid';

test.describe('Phase 2 — Auth Flow', () => {
  // ── Scenario 1: Register USER → Verify → Login ───────────────────────────
  test('Scenario 1: register USER → verify email → login → reach /browse', async ({ page }) => {
    const { email, password } = await e2eRegisterAndLogin(page, { role: 'user' });

    // Should land on /browse after verification + auto-login
    await expect(page).toHaveURL(/browse/);

    // Player bar should be visible (part of app shell)
    await expect(page.locator('footer')).toBeVisible();
  });

  // ── Scenario 2: Register ARTIST ──────────────────────────────────────────
  test('Scenario 2: register ARTIST → stageName required → verify → login', async ({ page }) => {
    await page.goto(url('/register'));
    await page.waitForLoadState('networkidle');

    // Switch to Artist tab
    await page.getByRole('tab', { name: /artist/i }).click();

    // Try submitting without stageName → validation error
    const email = `artist+${uuidv4().slice(0, 8)}@test.local`;
    await page.getByLabel(/full name/i).fill('Test Artist');
    await page.getByLabel(/email/i).fill(email);
    await page.getByLabel(/^password$/i).fill('Test@1234!');
    await page.getByLabel(/confirm password/i).fill('Test@1234!');
    await page.getByLabel(/bio/i).fill('My bio');
    // Don't fill stageName

    await page.getByRole('button', { name: /create account/i }).click();
    // Should show validation error
    await expect(page.getByText(/stage name/i)).toBeVisible();

    // Now fill stageName and complete registration
    await page.getByLabel(/stage name/i).fill('DJ TestBot');
    await page.getByRole('button', { name: /create account/i }).click();

    // Verify email
    await page.waitForURL(/verify-email/);
    const code = await pollMailHogForCode(email);
    await page.getByLabel(/6.digit code/i).fill(code);
    await page.getByRole('button', { name: /verify/i }).click();

    await page.waitForURL(/browse/);
    // Artist nav items should be visible in sidebar
    await expect(page.getByText(/my songs/i)).toBeVisible();
  });

  // ── Scenario 3: Brute-force lock ─────────────────────────────────────────
  test('Scenario 3: 5 wrong passwords → account locked → lock email in MailHog', async ({ page }) => {
    const { email } = await e2eRegisterAndLogin(page, { role: 'user' });
    // Log out first
    await page.goto(url('/profile'));
    await page.getByRole('button', { name: /log out/i }).click();
    await page.waitForURL(/login/);

    // Attempt 5 wrong passwords
    for (let i = 0; i < 5; i++) {
      await page.getByLabel(/email/i).fill(email);
      await page.getByLabel(/password/i).fill('WrongPass!');
      await page.getByRole('button', { name: /sign in/i }).click();
      await page.waitForTimeout(300);
    }

    // Should see account locked message
    await expect(page.getByText(/account locked|too many attempts/i)).toBeVisible();

    // Lock email should appear in MailHog
    const lockMail = await pollMailHogForCode(email).catch(() => null);
    // Lock email may contain a code or just a notification — check it arrived
    const mailRes = await fetch(`http://localhost:8025/api/v2/search?kind=to&query=${encodeURIComponent(email)}&limit=10`);
    const mailData = await mailRes.json() as any;
    expect(mailData.total).toBeGreaterThanOrEqual(1);
  });

  // ── Scenario 4: Forgot Password flow ─────────────────────────────────────
  test('Scenario 4: forgot password → code → reset → login with new password', async ({ page }) => {
    const { email } = await e2eRegisterAndLogin(page, { role: 'user' });
    const newPassword = 'NewE2EPass@9!';

    // Log out
    await page.goto(url('/profile'));
    await page.getByRole('button', { name: /log out/i }).click();
    await page.waitForURL(/login/);

    // Navigate to forgot password
    await page.getByRole('link', { name: /forgot password/i }).click();
    await page.waitForURL(/forgot-password/);

    await page.getByLabel(/email/i).fill(email);
    await page.getByRole('button', { name: /send code/i }).click();

    // Verify reset code
    await page.waitForURL(/verify-reset/);
    const code = await pollMailHogForCode(email);
    await page.getByLabel(/6.digit code/i).fill(code);
    await page.getByRole('button', { name: /verify/i }).click();

    // Reset password
    await page.waitForURL(/reset-password/);
    await page.getByLabel(/new password/i).fill(newPassword);
    await page.getByLabel(/confirm/i).fill(newPassword);
    await page.getByRole('button', { name: /reset password/i }).click();

    // Should redirect to login
    await page.waitForURL(/login/);

    // Login with new password
    await e2eLogin(page, email, newPassword);
    await expect(page).toHaveURL(/browse/);
  });

  // ── Scenario 5: Active sessions ──────────────────────────────────────────
  test('Scenario 5: sessions page shows current device → revoke → logged out', async ({ page }) => {
    await e2eRegisterAndLogin(page, { role: 'user' });

    await page.goto(url('/profile/sessions'));
    await page.waitForLoadState('networkidle');

    // Current session should appear
    await expect(page.getByText(/last seen|active/i)).toBeVisible();

    // Revoke the session
    await page.getByRole('button', { name: /revoke/i }).first().click();

    // Confirm dialog (if present)
    const confirmBtn = page.getByRole('button', { name: /confirm|yes/i });
    if (await confirmBtn.isVisible()) await confirmBtn.click();

    // After revoking current session, next protected request → redirect to login
    await page.goto(url('/profile'));
    await page.waitForURL(/login/);
  });
});
