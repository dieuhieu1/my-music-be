/**
 * Phase 2 API Tests — Change Password, Forgot/Reset Password (BL-05, BL-06, BL-07, BL-08)
 */
import { createClient, extractData } from '../../helpers/api-client';
import { createVerifiedUser, getVerificationCodeFromMailHog } from '../../helpers/auth-helpers';
import { v4 as uuidv4 } from 'uuid';

describe('Phase 2 — Password Management', () => {
  // ── Change Password (BL-05) ───────────────────────────────────────────────
  describe('POST /auth/change-password', () => {
    it('changes password when current password is correct', async () => {
      const { email, password, client } = await createVerifiedUser();
      const newPassword = 'NewPass@5678!';

      const res = await client.post('/auth/change-password', {
        currentPassword: password,
        newPassword,
      });
      expect(res.status).toBe(200);

      // Log in with new password
      const fresh = createClient();
      const login = await fresh.post('/auth/login', { email, password: newPassword });
      expect(login.status).toBe(200);
    });

    it('rejects wrong current password → 401', async () => {
      const { client } = await createVerifiedUser();
      const res = await client.post('/auth/change-password', {
        currentPassword: 'WrongCurrent!',
        newPassword: 'NewPass@5678!',
      });
      expect(res.status).toBe(401);
    });

    it('rejects weak new password → 400', async () => {
      const { password, client } = await createVerifiedUser();
      const res = await client.post('/auth/change-password', {
        currentPassword: password,
        newPassword: '123',
      });
      expect(res.status).toBe(400);
    });
  });

  // ── Forgot Password (BL-06) ───────────────────────────────────────────────
  describe('POST /auth/forgot-password', () => {
    it('sends 6-digit code email → 200', async () => {
      const { email } = await createVerifiedUser();

      const client = createClient();
      const res = await client.post('/auth/forgot-password', { email });
      expect(res.status).toBe(200);

      const code = await getVerificationCodeFromMailHog(email);
      expect(code).toMatch(/^\d{6}$/);
    });

    it('non-existent email → 200 (prevent user enumeration)', async () => {
      const client = createClient();
      const res = await client.post('/auth/forgot-password', {
        email: `ghost+${uuidv4().slice(0, 8)}@test.local`,
      });
      // Must return 200 regardless — security requirement
      expect(res.status).toBe(200);
    });
  });

  // ── Verify Reset Code (BL-07) ────────────────────────────────────────────
  describe('POST /auth/verify-code', () => {
    it('returns a reset JWT for a valid code', async () => {
      const { email } = await createVerifiedUser();
      const client = createClient();
      await client.post('/auth/forgot-password', { email });

      const code = await getVerificationCodeFromMailHog(email);
      const res = await client.post('/auth/verify-code', { email, code });

      expect(res.status).toBe(200);
      const data = extractData<any>(res);
      expect(data.resetToken).toBeDefined();
    });

    it('rejects invalid code → 400', async () => {
      const { email } = await createVerifiedUser();
      const client = createClient();
      await client.post('/auth/forgot-password', { email });

      const res = await client.post('/auth/verify-code', { email, code: '000000' });
      expect(res.status).toBe(400);
    });
  });

  // ── Reset Password (BL-08) ───────────────────────────────────────────────
  describe('POST /auth/reset-password', () => {
    it('resets password with valid reset JWT → can log in with new password', async () => {
      const { email } = await createVerifiedUser();
      const newPassword = 'ResetPass@9999!';
      const client = createClient();

      await client.post('/auth/forgot-password', { email });
      const code = await getVerificationCodeFromMailHog(email);
      const verifyRes = await client.post('/auth/verify-code', { email, code });
      const { resetToken } = extractData<any>(verifyRes);

      const resetRes = await client.post('/auth/reset-password', { token: resetToken, newPassword });
      expect(resetRes.status).toBe(200);

      // Login with new password
      const fresh = createClient();
      const login = await fresh.post('/auth/login', { email, password: newPassword });
      expect(login.status).toBe(200);
    });

    it('rejects expired or invalid reset token → 400', async () => {
      const client = createClient();
      const res = await client.post('/auth/reset-password', {
        token: 'invalid.jwt.token',
        newPassword: 'NewPass@1234!',
      });
      expect(res.status).toBe(400);
    });

    it('deletes VerificationCodes for that email after successful reset (BL-08)', async () => {
      // Verify old code no longer works after reset
      const { email } = await createVerifiedUser();
      const client = createClient();

      await client.post('/auth/forgot-password', { email });
      const code = await getVerificationCodeFromMailHog(email);
      const { resetToken } = extractData<any>(
        await client.post('/auth/verify-code', { email, code }),
      );
      await client.post('/auth/reset-password', { token: resetToken, newPassword: 'NewPass@9!' });

      // The same code should now be rejected
      const res = await client.post('/auth/verify-code', { email, code });
      expect(res.status).toBe(400);
    });
  });
});
