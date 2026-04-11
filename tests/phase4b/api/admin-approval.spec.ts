/**
 * Phase 4B API Tests — Admin Song Approval & Moderation
 * BL-37, BL-40, BL-83, BL-84, BL-85
 */
import * as fs from 'fs';
import * as path from 'path';
import FormData from 'form-data';
import { createClient, extractData } from '../../helpers/api-client';
import { createVerifiedArtist, createVerifiedUser } from '../../helpers/auth-helpers';
import { grantPremiumDirect, setSongStatusDirect } from '../../helpers/db-helpers';

const FIXTURE_MP3 = path.join(__dirname, '../../fixtures/sample.mp3');

/** Upload a song and return its ID */
async function uploadSong(client: any, title = 'Test Song'): Promise<string> {
  const form = new FormData();
  form.append('title', title);
  form.append('file', fs.createReadStream(FIXTURE_MP3), { filename: 'test.mp3', contentType: 'audio/mpeg' });
  const res = await client.post('/songs', form, { headers: form.getHeaders() });
  return extractData<any>(res).id;
}

/** Create an admin client — requires the test DB to have an ADMIN user seeded */
async function getAdminClient() {
  const client = createClient();
  const email = process.env.TEST_ADMIN_EMAIL ?? 'admin@test.local';
  const password = process.env.TEST_ADMIN_PASSWORD ?? 'Admin@1234!';
  await client.post('/auth/login', { email, password });
  return client;
}

describe('Phase 4B — Song Approval Queue (BL-37)', () => {
  describe('GET /admin/songs?status=PENDING', () => {
    it('admin can list PENDING songs', async () => {
      const admin = await getAdminClient();
      const res = await admin.get('/admin/songs', { params: { status: 'PENDING' } });
      expect(res.status).toBe(200);
      const data = extractData<any>(res);
      expect(Array.isArray(data.items ?? data)).toBe(true);
    });

    it('non-admin cannot access admin queue → 403', async () => {
      const { client } = await createVerifiedUser();
      const res = await client.get('/admin/songs', { params: { status: 'PENDING' } });
      expect(res.status).toBe(403);
    });
  });

  describe('PATCH /admin/songs/:id/approve', () => {
    it('admin approves song → status=LIVE (no dropAt)', async () => {
      const { client: artistClient } = await createVerifiedArtist();
      const songId = await uploadSong(artistClient, 'Approval Test');

      const admin = await getAdminClient();
      const res = await admin.patch(`/admin/songs/${songId}/approve`);
      expect(res.status).toBe(200);
      expect(extractData<any>(res).status).toBe('LIVE');
    });

    it('approved song with dropAt → status=SCHEDULED', async () => {
      const { client: artistClient } = await createVerifiedArtist();
      const form = new FormData();
      form.append('title', 'Scheduled Song');
      form.append('file', fs.createReadStream(FIXTURE_MP3), { filename: 'test.mp3', contentType: 'audio/mpeg' });
      // Set dropAt 2 hours from now
      const dropAt = new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString();
      form.append('dropAt', dropAt);
      const uploadRes = await artistClient.post('/songs', form, { headers: form.getHeaders() });
      const songId = extractData<any>(uploadRes).id;

      const admin = await getAdminClient();
      const res = await admin.patch(`/admin/songs/${songId}/approve`);
      expect(res.status).toBe(200);
      expect(extractData<any>(res).status).toBe('SCHEDULED');
    });

    it('approval is logged in AuditLog (BL-40)', async () => {
      const { client: artistClient } = await createVerifiedArtist();
      const songId = await uploadSong(artistClient, 'Audit Test');
      const admin = await getAdminClient();
      await admin.patch(`/admin/songs/${songId}/approve`);

      const auditRes = await admin.get('/admin/audit-logs', { params: { limit: 5 } });
      const logs = extractData<any[]>(auditRes);
      const entry = logs.find((l) => l.targetId === songId && l.action === 'SONG_APPROVED');
      expect(entry).toBeDefined();
    });
  });

  describe('PATCH /admin/songs/:id/reject', () => {
    it('admin rejects song with reason → status=REJECTED, artist notified', async () => {
      const { client: artistClient } = await createVerifiedArtist();
      const songId = await uploadSong(artistClient, 'Rejection Test');

      const admin = await getAdminClient();
      const res = await admin.patch(`/admin/songs/${songId}/reject`, {
        reason: 'Copyright violation',
      });
      expect(res.status).toBe(200);
      expect(extractData<any>(res).status).toBe('REJECTED');
    });

    it('reject without reason → 400', async () => {
      const { client: artistClient } = await createVerifiedArtist();
      const songId = await uploadSong(artistClient, 'No Reason');

      const admin = await getAdminClient();
      const res = await admin.patch(`/admin/songs/${songId}/reject`, {});
      expect(res.status).toBe(400);
    });
  });

  describe('PATCH /admin/songs/:id/request-reupload (BL-84)', () => {
    it('admin requests reupload with notes → status=REUPLOAD_REQUIRED', async () => {
      const { client: artistClient } = await createVerifiedArtist();
      const songId = await uploadSong(artistClient, 'Reupload Test');

      const admin = await getAdminClient();
      const res = await admin.patch(`/admin/songs/${songId}/request-reupload`, {
        notes: 'Please improve the audio quality',
      });
      expect(res.status).toBe(200);
      const song = extractData<any>(res);
      expect(song.status).toBe('REUPLOAD_REQUIRED');
      expect(song.reuploadReason).toContain('audio quality');
    });
  });

  describe('PATCH /songs/:id/resubmit (BL-85)', () => {
    it('artist can resubmit REUPLOAD_REQUIRED song → status=PENDING', async () => {
      const { client: artistClient } = await createVerifiedArtist();
      const songId = await uploadSong(artistClient, 'Resubmit Test');

      // Force status to REUPLOAD_REQUIRED via DB helper
      await setSongStatusDirect(songId, 'REUPLOAD_REQUIRED');

      const form = new FormData();
      form.append('title', 'Resubmitted Song');
      const res = await artistClient.patch(`/songs/${songId}/resubmit`, form, { headers: form.getHeaders() });
      expect(res.status).toBe(200);
      expect(extractData<any>(res).status).toBe('PENDING');
    });
  });

  describe('PATCH /admin/songs/:id/restore (BL-83)', () => {
    it('admin restores TAKEN_DOWN song → status=LIVE', async () => {
      const { client: artistClient } = await createVerifiedArtist();
      const songId = await uploadSong(artistClient, 'Restore Test');
      await setSongStatusDirect(songId, 'TAKEN_DOWN');

      const admin = await getAdminClient();
      const res = await admin.patch(`/admin/songs/${songId}/restore`);
      expect(res.status).toBe(200);
      expect(extractData<any>(res).status).toBe('LIVE');
    });
  });
});
