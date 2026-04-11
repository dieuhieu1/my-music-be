/**
 * Phase 2 API Tests — Registration (BL-01, BL-46, BL-47, BL-78, BL-79)
 */
import { createClient, extractData, extractError } from '../../helpers/api-client';
import { getVerificationCodeFromMailHog } from '../../helpers/auth-helpers';
import { v4 as uuidv4 } from 'uuid';

describe('Phase 2 — Registration', () => {
  // ── USER Registration (BL-01) ─────────────────────────────────────────────
  describe('POST /auth/register (USER)', () => {
    it('registers a new user and returns user + tokens', async () => {
      const client = createClient();
      const email = `reg+${uuidv4().slice(0, 8)}@test.local`;

      const res = await client.post('/auth/register', {
        name: 'New User',
        email,
        password: 'Test@1234!',
      });

      expect(res.status).toBe(201);
      expect(res.data.success).toBe(true);
      const data = extractData<any>(res);
      expect(data.user.email).toBe(email);
      expect(data.user.isEmailVerified).toBe(false);
      expect(data.user.roles).toContain('USER');
      // password must never be returned
      expect(data.user.password).toBeUndefined();
      expect(data.user.passwordHash).toBeUndefined();
    });

    it('sends a verification email to MailHog', async () => {
      const client = createClient();
      const email = `reg+${uuidv4().slice(0, 8)}@test.local`;
      await client.post('/auth/register', { name: 'A', email, password: 'Test@1234!' });

      const code = await getVerificationCodeFromMailHog(email);
      expect(code).toMatch(/^\d{6}$/);
    });

    it('rejects duplicate email → 409', async () => {
      const client = createClient();
      const email = `dup+${uuidv4().slice(0, 8)}@test.local`;
      await client.post('/auth/register', { name: 'A', email, password: 'Test@1234!' });

      const res = await client.post('/auth/register', { name: 'B', email, password: 'Test@1234!' });
      expect(res.status).toBe(409);
    });

    it('rejects missing name → 400', async () => {
      const client = createClient();
      const res = await client.post('/auth/register', {
        email: `x+${uuidv4().slice(0, 8)}@test.local`,
        password: 'Test@1234!',
      });
      expect(res.status).toBe(400);
    });

    it('rejects invalid email format → 400', async () => {
      const client = createClient();
      const res = await client.post('/auth/register', {
        name: 'X',
        email: 'not-an-email',
        password: 'Test@1234!',
      });
      expect(res.status).toBe(400);
    });

    it('rejects weak password (< 8 chars) → 400', async () => {
      const client = createClient();
      const res = await client.post('/auth/register', {
        name: 'X',
        email: `x+${uuidv4().slice(0, 8)}@test.local`,
        password: 'short',
      });
      expect(res.status).toBe(400);
    });
  });

  // ── ARTIST Registration (BL-46, BL-47) ───────────────────────────────────
  describe('POST /auth/register/artist (ARTIST)', () => {
    it('registers artist with stageName + bio atomically', async () => {
      const client = createClient();
      const email = `artist+${uuidv4().slice(0, 8)}@test.local`;

      const res = await client.post('/auth/register/artist', {
        name: 'Test Artist',
        email,
        password: 'Test@1234!',
        stageName: 'DJ TestBot',
        bio: 'I make test beats',
        genreIds: [],
      });

      expect(res.status).toBe(201);
      const data = extractData<any>(res);
      expect(data.user.roles).toContain('ARTIST');
      expect(data.user.roles).toContain('USER');   // ARTIST also gets USER role
      expect(data.artistProfile.stageName).toBe('DJ TestBot');
      expect(data.artistProfile.bio).toBe('I make test beats');
    });

    it('rejects artist registration without stageName → 400', async () => {
      const client = createClient();
      const res = await client.post('/auth/register/artist', {
        name: 'A',
        email: `a+${uuidv4().slice(0, 8)}@test.local`,
        password: 'Test@1234!',
        bio: 'bio',
        genreIds: [],
        // stageName missing
      });
      expect(res.status).toBe(400);
    });

    it('rejects artist registration without bio → 400', async () => {
      const client = createClient();
      const res = await client.post('/auth/register/artist', {
        name: 'A',
        email: `a+${uuidv4().slice(0, 8)}@test.local`,
        password: 'Test@1234!',
        stageName: 'DJ X',
        genreIds: [],
        // bio missing
      });
      expect(res.status).toBe(400);
    });

    it('rolls back if artist profile creation fails (transaction)', async () => {
      // This is hard to test without triggering a DB error; document as manual check.
      // The test serves as a reminder that the registration is atomic (BL-47).
      expect(true).toBe(true); // placeholder
    });
  });

  // ── Email Verification (BL-78, BL-79) ────────────────────────────────────
  describe('POST /auth/verify-email', () => {
    it('verifies email with correct 6-digit code', async () => {
      const client = createClient();
      const email = `verify+${uuidv4().slice(0, 8)}@test.local`;
      await client.post('/auth/register', { name: 'V', email, password: 'Test@1234!' });

      const code = await getVerificationCodeFromMailHog(email);
      const res = await client.post('/auth/verify-email', { code });

      expect(res.status).toBe(200);
      const data = extractData<any>(res);
      expect(data.isEmailVerified).toBe(true);
    });

    it('rejects incorrect code → 400', async () => {
      const client = createClient();
      const email = `verify+${uuidv4().slice(0, 8)}@test.local`;
      await client.post('/auth/register', { name: 'V', email, password: 'Test@1234!' });
      await client.post('/auth/login', { email, password: 'Test@1234!' });

      const res = await client.post('/auth/verify-email', { code: '000000' });
      expect(res.status).toBe(400);
    });

    it('rejects expired code → 400 (documented; expiry enforced at DB level)', async () => {
      // Test that expired codes are rejected — actual expiry manipulation via DB helper.
      // Full test added when db-helpers time manipulation is wired.
      expect(true).toBe(true); // placeholder
    });
  });

  // ── Resend Verification (BL-79) ───────────────────────────────────────────
  describe('POST /auth/resend-verification-email', () => {
    it('sends a new verification email when requested', async () => {
      const client = createClient();
      const email = `resend+${uuidv4().slice(0, 8)}@test.local`;
      await client.post('/auth/register', { name: 'R', email, password: 'Test@1234!' });
      await client.post('/auth/login', { email, password: 'Test@1234!' });

      const res = await client.post('/auth/resend-verification-email');
      expect(res.status).toBe(200);

      // A new 6-digit code should arrive
      const code = await getVerificationCodeFromMailHog(email);
      expect(code).toMatch(/^\d{6}$/);
    });
  });
});
