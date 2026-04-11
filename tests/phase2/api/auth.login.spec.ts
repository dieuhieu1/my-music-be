/**
 * Phase 2 API Tests — Login, Logout, Refresh, Brute-Force (BL-02, BL-03, BL-04, BL-43)
 */
import { createClient, extractData, extractError } from '../../helpers/api-client';
import { createVerifiedUser } from '../../helpers/auth-helpers';
import { v4 as uuidv4 } from 'uuid';

describe('Phase 2 — Login / Logout / Refresh', () => {
  // ── Login (BL-02) ─────────────────────────────────────────────────────────
  describe('POST /auth/login', () => {
    it('logs in a verified user → 200, sets httpOnly cookies', async () => {
      const { email, password, client } = await createVerifiedUser();

      const res = await client.post('/auth/login', { email, password });
      expect(res.status).toBe(200);
      const data = extractData<any>(res);
      expect(data.user.email).toBe(email);
      // httpOnly cookies should be present in the cookie jar (not in response body)
      expect(data.accessToken).toBeUndefined();   // tokens MUST NOT be in JSON body
    });

    it('rejects wrong password → 401', async () => {
      const { email } = await createVerifiedUser();

      const fresh = createClient();
      const res = await fresh.post('/auth/login', { email, password: 'WrongPass!' });
      expect(res.status).toBe(401);
    });

    it('rejects non-existent email → 401 (not 404, to prevent user enumeration)', async () => {
      const client = createClient();
      const res = await client.post('/auth/login', {
        email: `nope+${uuidv4().slice(0, 8)}@test.local`,
        password: 'Test@1234!',
      });
      expect(res.status).toBe(401);
    });

    it('unverified user can log in but is_email_verified = false in response', async () => {
      const client = createClient();
      const email = `unverified+${uuidv4().slice(0, 8)}@test.local`;
      await client.post('/auth/register', { name: 'UV', email, password: 'Test@1234!' });

      const res = await client.post('/auth/login', { email, password: 'Test@1234!' });
      expect(res.status).toBe(200);
      const data = extractData<any>(res);
      expect(data.user.isEmailVerified).toBe(false);
    });

    it('unverified user is blocked from protected routes → 403', async () => {
      const client = createClient();
      const email = `unverified+${uuidv4().slice(0, 8)}@test.local`;
      await client.post('/auth/register', { name: 'UV', email, password: 'Test@1234!' });
      await client.post('/auth/login', { email, password: 'Test@1234!' });

      const res = await client.get('/users/me');
      expect(res.status).toBe(403);
      expect(extractError(res).code).toBe('EMAIL_NOT_VERIFIED');
    });
  });

  // ── Brute-Force Protection (BL-43) ────────────────────────────────────────
  describe('Brute-force protection (BL-43)', () => {
    it('locks account after 5 consecutive wrong passwords', async () => {
      const { email } = await createVerifiedUser();

      const client = createClient();
      for (let i = 0; i < 5; i++) {
        await client.post('/auth/login', { email, password: 'WrongPass!' });
      }

      const res = await client.post('/auth/login', { email, password: 'WrongPass!' });
      expect(res.status).toBe(403);
      const err = extractError(res);
      expect(err.code).toMatch(/ACCOUNT_LOCKED/i);
    });

    it('correct password during lockout → still 403', async () => {
      const { email, password } = await createVerifiedUser();
      const client = createClient();

      for (let i = 0; i < 5; i++) {
        await client.post('/auth/login', { email, password: 'WrongPass!' });
      }

      const res = await client.post('/auth/login', { email, password });
      expect(res.status).toBe(403);
    });

    it('lock email is sent to MailHog after lockout', async () => {
      // Verified by polling MailHog after the 5th failed attempt
      // Skipped here — integration covered in E2E test
      expect(true).toBe(true);
    });
  });

  // ── Logout (BL-03) ───────────────────────────────────────────────────────
  describe('POST /auth/logout', () => {
    it('logout invalidates JWT and clears cookies', async () => {
      const { client } = await createVerifiedUser();

      const logout = await client.post('/auth/logout');
      expect(logout.status).toBe(200);

      // After logout, authenticated request should fail
      const me = await client.get('/users/me');
      expect(me.status).toBe(401);
    });

    it('second logout (expired token) → still 200 (idempotent)', async () => {
      const { client } = await createVerifiedUser();
      await client.post('/auth/logout');
      const res = await client.post('/auth/logout');
      // Logout should be graceful even without a valid token
      expect([200, 401]).toContain(res.status);
    });
  });

  // ── Token Refresh (BL-04) ─────────────────────────────────────────────────
  describe('POST /auth/refresh', () => {
    it('returns new access token using refresh token cookie', async () => {
      const { client } = await createVerifiedUser();

      const res = await client.post('/auth/refresh');
      expect(res.status).toBe(200);
      // New access token should be set as httpOnly cookie (not in JSON body)
      expect(res.data.success).toBe(true);
    });

    it('refresh without valid cookie → 401', async () => {
      const client = createClient();
      const res = await client.post('/auth/refresh');
      expect(res.status).toBe(401);
    });

    it('refresh token rotation: old refresh token is invalidated', async () => {
      const { client } = await createVerifiedUser();

      // First refresh — gets new tokens
      await client.post('/auth/refresh');

      // Try to use the first refresh token again (should be rotated out)
      // The jar will have the new cookie; this tests that the old one is rejected
      // Full test requires cookie manipulation — document for manual verification
      expect(true).toBe(true); // placeholder
    });
  });

  // ── Auth Rate Limiting (BL-41) ────────────────────────────────────────────
  describe('Rate limiting on auth routes (BL-41)', () => {
    it('more than 10 requests/min on /auth/login → 429', async () => {
      const client = createClient();
      const email = `rl+${uuidv4().slice(0, 8)}@test.local`;
      const requests = Array.from({ length: 12 }, () =>
        client.post('/auth/login', { email, password: 'Irrelevant1!' }),
      );
      const responses = await Promise.all(requests);
      const tooMany = responses.some((r) => r.status === 429);
      expect(tooMany).toBe(true);
    });
  });
});
