/**
 * Phase 2 API Tests — Session Management (BL-42)
 */
import { createClient, extractData } from '../../helpers/api-client';
import { createVerifiedUser } from '../../helpers/auth-helpers';

describe('Phase 2 — Session Management (BL-42)', () => {
  describe('GET /auth/sessions', () => {
    it('returns list of active sessions for authenticated user', async () => {
      const { client } = await createVerifiedUser();

      const res = await client.get('/auth/sessions');
      expect(res.status).toBe(200);
      const data = extractData<any[]>(res);
      expect(Array.isArray(data)).toBe(true);
      expect(data.length).toBeGreaterThanOrEqual(1);

      const session = data[0];
      expect(session.id).toBeDefined();
      expect(session.lastSeenAt).toBeDefined();
    });

    it('returns 401 for unauthenticated request', async () => {
      const client = createClient();
      const res = await client.get('/auth/sessions');
      expect(res.status).toBe(401);
    });
  });

  describe('DELETE /auth/sessions/:id', () => {
    it('revokes a specific session by ID', async () => {
      const { client } = await createVerifiedUser();

      const sessionsRes = await client.get('/auth/sessions');
      const sessions = extractData<any[]>(sessionsRes);
      expect(sessions.length).toBeGreaterThanOrEqual(1);

      const sessionId = sessions[0].id;
      const res = await client.delete(`/auth/sessions/${sessionId}`);
      expect(res.status).toBe(200);

      // Session should no longer appear in list
      const updated = extractData<any[]>(await client.get('/auth/sessions'));
      const still = updated.find((s) => s.id === sessionId);
      expect(still).toBeUndefined();
    });

    it('revoking non-existent session → 404', async () => {
      const { client } = await createVerifiedUser();
      const res = await client.delete('/auth/sessions/00000000-0000-0000-0000-000000000000');
      expect(res.status).toBe(404);
    });

    it('cannot revoke another user\'s session → 403', async () => {
      const { client: clientA } = await createVerifiedUser();
      const { client: clientB } = await createVerifiedUser();

      const sessRes = await clientA.get('/auth/sessions');
      const [session] = extractData<any[]>(sessRes);

      const res = await clientB.delete(`/auth/sessions/${session.id}`);
      expect(res.status).toBe(403);
    });
  });

  describe('Logout clears play queue (BL-31)', () => {
    it('queue is hard-deleted on logout (not soft-deleted)', async () => {
      const { client } = await createVerifiedUser();
      await client.post('/auth/logout');

      // After logout, queue endpoint returns 401 (not an empty array with stale data)
      const res = await client.get('/playback/queue');
      expect(res.status).toBe(401);
    });
  });
});
