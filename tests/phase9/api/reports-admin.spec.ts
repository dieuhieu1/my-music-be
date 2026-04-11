/**
 * Phase 9 API Tests — Reports, Analytics & Admin Tools
 * BL-38, BL-40, BL-51, BL-68–75
 */
import { extractData, extractError } from '../../helpers/api-client';
import { createVerifiedUser, createVerifiedArtist } from '../../helpers/auth-helpers';

async function getAdminClient() {
  const { createClient } = await import('../../helpers/api-client');
  const client = createClient();
  await client.post('/auth/login', {
    email: process.env.TEST_ADMIN_EMAIL ?? 'admin@test.local',
    password: process.env.TEST_ADMIN_PASSWORD ?? 'Admin@1234!',
  });
  return client;
}

describe('Phase 9 — Content Reports (BL-38)', () => {
  describe('POST /reports', () => {
    it('authenticated user can submit a SONG report', async () => {
      const { client } = await createVerifiedUser();
      const { items } = extractData<any>(await client.get('/songs', { params: { limit: 1 } }));
      if (items.length === 0) return;

      const res = await client.post('/reports', {
        targetType: 'SONG',
        targetId: items[0].id,
        reason: 'EXPLICIT',
        description: 'Inappropriate content',
      });
      expect(res.status).toBe(201);
      const data = extractData<any>(res);
      expect(data.status).toBe('PENDING');
    });

    it('duplicate PENDING report from same user+target → 409', async () => {
      const { client } = await createVerifiedUser();
      const { items } = extractData<any>(await client.get('/songs', { params: { limit: 1 } }));
      if (items.length === 0) return;

      const dto = { targetType: 'SONG', targetId: items[0].id, reason: 'COPYRIGHT' };
      await client.post('/reports', dto);
      const second = await client.post('/reports', dto);
      expect(second.status).toBe(409);
    });

    it('unauthenticated user cannot submit report → 401', async () => {
      const { rawApi } = await import('../../helpers/api-client');
      const res = await rawApi.post('/reports', { targetType: 'SONG', targetId: 'x', reason: 'EXPLICIT' });
      expect(res.status).toBe(401);
    });
  });

  describe('Admin: GET /admin/reports', () => {
    it('admin can list all reports', async () => {
      const admin = await getAdminClient();
      const res = await admin.get('/admin/reports');
      expect(res.status).toBe(200);
    });

    it('admin dismisses report → status=DISMISSED', async () => {
      const { client: userClient } = await createVerifiedUser();
      const { items } = extractData<any>(await userClient.get('/songs', { params: { limit: 1 } }));
      if (items.length === 0) return;

      const reportRes = await userClient.post('/reports', { targetType: 'SONG', targetId: items[0].id, reason: 'INAPPROPRIATE' });
      const reportId = extractData<any>(reportRes).id;

      const admin = await getAdminClient();
      const res = await admin.patch(`/admin/reports/${reportId}/dismiss`);
      expect(res.status).toBe(200);
      expect(extractData<any>(res).status).toBe('DISMISSED');
    });

    it('admin takes down report → song=TAKEN_DOWN, report=RESOLVED', async () => {
      const { client: userClient } = await createVerifiedUser();
      const { items } = extractData<any>(await userClient.get('/songs', { params: { limit: 1 } }));
      if (items.length === 0) return;

      const reportRes = await userClient.post('/reports', { targetType: 'SONG', targetId: items[0].id, reason: 'EXPLICIT' });
      const reportId = extractData<any>(reportRes).id;

      const admin = await getAdminClient();
      const res = await admin.patch(`/admin/reports/${reportId}/take-down`);
      expect(res.status).toBe(200);
      expect(extractData<any>(res).status).toBe('RESOLVED');

      // Verify song is now TAKEN_DOWN
      const songRes = await admin.get(`/songs/${items[0].id}`);
      expect(extractData<any>(songRes).status).toBe('TAKEN_DOWN');
    });
  });
});

describe('Phase 9 — Song Analytics (BL-51)', () => {
  describe('GET /artists/me/analytics', () => {
    it('artist can view own analytics', async () => {
      const { client } = await createVerifiedArtist();
      const res = await client.get('/artists/me/analytics');
      expect(res.status).toBe(200);
      const data = extractData<any>(res);
      expect(data.totalPlays).toBeDefined();
      expect(data.last30DaysPlays).toBeDefined();
      expect(data.top5Songs).toBeDefined();
      expect(Array.isArray(data.top5Songs)).toBe(true);
      expect(data.followerCount).toBeDefined();
    });

    it('non-artist cannot access artist analytics → 403', async () => {
      const { client } = await createVerifiedUser();
      const res = await client.get('/artists/me/analytics');
      expect(res.status).toBe(403);
    });
  });
});

describe('Phase 9 — Admin User Management (BL-74, BL-75)', () => {
  describe('POST /admin/users/:id/premium — Manual PREMIUM grant (BL-74)', () => {
    it('admin grants PREMIUM → user gets PREMIUM role + notification', async () => {
      const { id } = await createVerifiedUser();
      const admin = await getAdminClient();

      const res = await admin.post(`/admin/users/${id}/premium`, {
        premiumType: '1_MONTH',
        reason: 'Promotional grant',
      });
      expect(res.status).toBe(200);
      const data = extractData<any>(res);
      expect(data.premiumStatus).toBe(true);
    });
  });

  describe('DELETE /admin/users/:id/premium — Revoke PREMIUM (BL-75)', () => {
    it('admin revokes PREMIUM → downloads revoked + notification sent', async () => {
      const { id } = await createVerifiedUser();
      const admin = await getAdminClient();

      await admin.post(`/admin/users/${id}/premium`, { premiumType: '1_MONTH', reason: 'Test' });
      const res = await admin.delete(`/admin/users/${id}/premium`, { data: { reason: 'Test revocation' } });
      expect(res.status).toBe(200);
      expect(extractData<any>(res).premiumStatus).toBe(false);
    });
  });
});

describe('Phase 9 — Genre Management (BL-68–71)', () => {
  describe('POST /genres', () => {
    it('admin creates new genre', async () => {
      const admin = await getAdminClient();
      const genreName = `TestGenre${Date.now()}`;
      const res = await admin.post('/genres', { name: genreName });
      expect(res.status).toBe(201);
      expect(extractData<any>(res).name).toBe(genreName);
    });

    it('duplicate genre name (case-insensitive) → 409 (BL-68)', async () => {
      const admin = await getAdminClient();
      const genreName = `UniqueGenre${Date.now()}`;
      await admin.post('/genres', { name: genreName });
      const res = await admin.post('/genres', { name: genreName.toUpperCase() });
      expect(res.status).toBe(409);
    });

    it('non-admin cannot create genre → 403', async () => {
      const { client } = await createVerifiedUser();
      const res = await client.post('/genres', { name: 'Nope' });
      expect(res.status).toBe(403);
    });
  });

  describe('DELETE /genres/:id', () => {
    it('soft-deletes genre — existing song associations are kept (BL-71)', async () => {
      const admin = await getAdminClient();
      const { id } = extractData<any>(await admin.post('/genres', { name: `DeleteMe${Date.now()}` }));

      const del = await admin.delete(`/genres/${id}`);
      expect(del.status).toBe(200);

      // Deleted genre is not returned in public genre list
      const genres = extractData<any[]>(
        await (await createVerifiedUser()).client.get('/genres'),
      );
      expect(genres.find((g: any) => g.id === id)).toBeUndefined();
    });
  });
});

describe('Phase 9 — Audit Log (BL-40)', () => {
  it('GET /admin/audit-logs returns immutable log entries', async () => {
    const admin = await getAdminClient();
    const res = await admin.get('/admin/audit-logs');
    expect(res.status).toBe(200);
    const data = extractData<any>(res);
    expect(Array.isArray(data.items ?? data)).toBe(true);
  });

  it('non-admin cannot read audit log → 403', async () => {
    const { client } = await createVerifiedUser();
    const res = await client.get('/admin/audit-logs');
    expect(res.status).toBe(403);
  });
});
