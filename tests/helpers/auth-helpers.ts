/**
 * Reusable auth helpers for integration tests.
 * Returns an authenticated client (with cookies) for use in subsequent requests.
 */
import { createClient, API_BASE } from './api-client';
import type { AxiosInstance } from 'axios';
import { v4 as uuidv4 } from 'uuid';

export interface TestUser {
  id: string;
  email: string;
  password: string;
  name: string;
  client: AxiosInstance;
}

export interface TestArtist extends TestUser {
  stageName: string;
  artistProfileId: string;
}

/**
 * Register + verify email + login a fresh USER, return authenticated client.
 * Uses MailHog API to grab the verification code.
 */
export async function createVerifiedUser(overrides?: Partial<{ name: string; email: string; password: string }>): Promise<TestUser> {
  const email = overrides?.email ?? `user+${uuidv4().slice(0, 8)}@test.local`;
  const password = overrides?.password ?? 'Test@1234!';
  const name = overrides?.name ?? 'Test User';
  const client = createClient();

  // Register
  const reg = await client.post('/auth/register', { name, email, password });
  if (reg.status !== 201) throw new Error(`Register failed: ${JSON.stringify(reg.data)}`);

  const userId = reg.data.data.user?.id;

  // Grab verification code from MailHog
  const code = await getVerificationCodeFromMailHog(email);

  // Verify email
  const verify = await client.post('/auth/verify-email', { code });
  if (verify.status !== 200) throw new Error(`Verify email failed: ${JSON.stringify(verify.data)}`);

  // Login (sets httpOnly cookies in jar)
  const login = await client.post('/auth/login', { email, password });
  if (login.status !== 200) throw new Error(`Login failed: ${JSON.stringify(login.data)}`);

  return { id: userId, email, password, name, client };
}

/**
 * Register + verify email + login a fresh ARTIST.
 */
export async function createVerifiedArtist(overrides?: Partial<{ name: string; email: string; stageName: string }>): Promise<TestArtist> {
  const email = overrides?.email ?? `artist+${uuidv4().slice(0, 8)}@test.local`;
  const password = 'Test@1234!';
  const name = overrides?.name ?? 'Test Artist';
  const stageName = overrides?.stageName ?? `Stage${uuidv4().slice(0, 6)}`;
  const client = createClient();

  const reg = await client.post('/auth/register/artist', {
    name,
    email,
    password,
    stageName,
    bio: 'Test bio for automated tests',
    genreIds: [],  // will need at least one real genre in Phase 4+
  });
  if (reg.status !== 201) throw new Error(`Artist register failed: ${JSON.stringify(reg.data)}`);

  const userId = reg.data.data.user?.id;
  const artistProfileId = reg.data.data.artistProfile?.id;

  const code = await getVerificationCodeFromMailHog(email);
  await client.post('/auth/verify-email', { code });
  await client.post('/auth/login', { email, password });

  return { id: userId, email, password, name, stageName, artistProfileId, client };
}

/**
 * Poll MailHog API for the most recent email to `toEmail` and extract the 6-digit code.
 */
export async function getVerificationCodeFromMailHog(toEmail: string, retries = 10): Promise<string> {
  const mailhogUrl = process.env.MAILHOG_API ?? 'http://localhost:8025';
  for (let i = 0; i < retries; i++) {
    const res = await fetch(`${mailhogUrl}/api/v2/search?kind=to&query=${encodeURIComponent(toEmail)}&limit=10`);
    const data = await res.json() as any;
    const items: any[] = data?.items ?? [];
    // Sort newest first
    items.sort((a: any, b: any) => new Date(b.Created).getTime() - new Date(a.Created).getTime());
    for (const msg of items) {
      const body: string = msg?.Content?.Body ?? msg?.MIME?.Parts?.[0]?.Body ?? '';
      const match = body.match(/\b(\d{6})\b/);
      if (match) return match[1];
    }
    await new Promise((r) => setTimeout(r, 1000));
  }
  throw new Error(`No verification email found for ${toEmail} after ${retries}s`);
}
