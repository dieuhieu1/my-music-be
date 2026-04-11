/**
 * Playwright E2E helpers — login, register, and common page actions.
 */
import { type Page, type BrowserContext, expect } from '@playwright/test';
import { v4 as uuidv4 } from 'uuid';

export const WEB_BASE = process.env.WEB_BASE ?? 'http://localhost:3000';
export const MAILHOG = process.env.MAILHOG_API ?? 'http://localhost:8025';

/** Navigate to a locale-aware path (/en/...) */
export function url(path: string, locale = 'en'): string {
  return `${WEB_BASE}/${locale}${path}`;
}

/**
 * Register + verify email + return logged-in page context.
 */
export async function e2eRegisterAndLogin(
  page: Page,
  opts: { role?: 'user' | 'artist'; email?: string; password?: string } = {},
): Promise<{ email: string; password: string }> {
  const email = opts.email ?? `e2e+${uuidv4().slice(0, 8)}@test.local`;
  const password = opts.password ?? 'Test@1234!';
  const role = opts.role ?? 'user';

  await page.goto(url('/register'));
  await page.waitForLoadState('networkidle');

  if (role === 'artist') {
    await page.getByRole('tab', { name: /artist/i }).click();
    await page.getByLabel(/stage name/i).fill(`Stage${uuidv4().slice(0, 6)}`);
    await page.getByLabel(/bio/i).fill('Test artist bio');
  }

  await page.getByLabel(/full name/i).fill('E2E Test User');
  await page.getByLabel(/email/i).fill(email);
  await page.getByLabel(/^password$/i).fill(password);
  await page.getByLabel(/confirm password/i).fill(password);
  await page.getByRole('button', { name: /create account/i }).click();

  // Should redirect to verify-email
  await page.waitForURL(/verify-email/);

  // Fetch code from MailHog
  const code = await pollMailHogForCode(email);
  await page.getByLabel(/6.digit code/i).fill(code);
  await page.getByRole('button', { name: /verify/i }).click();

  // Should redirect to /browse or /login
  await page.waitForURL(/browse|login/);

  return { email, password };
}

/** Log in with email + password via the login page */
export async function e2eLogin(page: Page, email: string, password: string): Promise<void> {
  await page.goto(url('/login'));
  await page.waitForLoadState('networkidle');
  await page.getByLabel(/email/i).fill(email);
  await page.getByLabel(/password/i).fill(password);
  await page.getByRole('button', { name: /sign in/i }).click();
  await page.waitForURL(/browse/);
}

/** Poll MailHog for a 6-digit code sent to `toEmail` */
export async function pollMailHogForCode(toEmail: string, retries = 15): Promise<string> {
  for (let i = 0; i < retries; i++) {
    const res = await fetch(
      `${MAILHOG}/api/v2/search?kind=to&query=${encodeURIComponent(toEmail)}&limit=10`,
    );
    const data = await res.json() as any;
    const items: any[] = [...(data?.items ?? [])].sort(
      (a: any, b: any) => new Date(b.Created).getTime() - new Date(a.Created).getTime(),
    );
    for (const msg of items) {
      const body: string = msg?.Content?.Body ?? msg?.MIME?.Parts?.[0]?.Body ?? '';
      const match = body.match(/\b(\d{6})\b/);
      if (match) return match[1];
    }
    await new Promise((r) => setTimeout(r, 1000));
  }
  throw new Error(`No verification email found for ${toEmail}`);
}
