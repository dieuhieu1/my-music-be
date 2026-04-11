/**
 * Phase 8 API Tests — Artist Live Drops & Notifications
 * BL-59, BL-60, BL-61, BL-62, BL-63, BL-64, BL-65, BL-80, BL-81, BL-82
 */
import * as fs from 'fs';
import * as path from 'path';
import FormData from 'form-data';
import { extractData, extractError } from '../../helpers/api-client';
import { createVerifiedArtist, createVerifiedUser } from '../../helpers/auth-helpers';
import { setSongStatusDirect } from '../../helpers/db-helpers';

const FIXTURE_MP3 = path.join(__dirname, '../../fixtures/sample.mp3');

async function uploadScheduledSong(client: any, hoursFromNow = 2): Promise<string> {
  const form = new FormData();
  form.append('title', 'Scheduled Drop');
  form.append('file', fs.createReadStream(FIXTURE_MP3), { filename: 'test.mp3', contentType: 'audio/mpeg' });
  const dropAt = new Date(Date.now() + hoursFromNow * 60 * 60 * 1000).toISOString();
  form.append('dropAt', dropAt);
  const res = await client.post('/songs', form, { headers: form.getHeaders() });
  const songId = extractData<any>(res).id;
  // Approve the song so it becomes SCHEDULED
  // (requires admin approval — use DB helper to set status directly for tests)
  await setSongStatusDirect(songId, 'SCHEDULED');
  return songId;
}

describe('Phase 8 — Drop Teaser (BL-60)', () => {
  describe('GET /songs/:id/teaser', () => {
    it('returns teaser info for SCHEDULED song (public, no auth)', async () => {
      const { client } = await createVerifiedArtist();
      const songId = await uploadScheduledSong(client);

      // Raw GET without auth
      const { rawApi } = await import('../../helpers/api-client');
      const res = await rawApi.get(`/songs/${songId}/teaser`);
      expect(res.status).toBe(200);
      const data = extractData<any>(res);
      expect(data.title).toBeDefined();
      expect(data.dropAt).toBeDefined();
      expect(data.fileUrl).toBeUndefined();  // audio never on teaser page
    });

    it('PENDING/REJECTED song teaser → 404', async () => {
      const { client } = await createVerifiedArtist();
      const form = new FormData();
      form.append('title', 'Hidden');
      form.append('file', fs.createReadStream(FIXTURE_MP3), { filename: 'test.mp3', contentType: 'audio/mpeg' });
      const songId = extractData<any>(await client.post('/songs', form, { headers: form.getHeaders() })).id;

      const { rawApi } = await import('../../helpers/api-client');
      const res = await rawApi.get(`/songs/${songId}/teaser`);
      expect(res.status).toBe(404);
    });
  });

  describe('Stream a SCHEDULED song → 423 Locked', () => {
    it('any stream request on SCHEDULED song returns 423', async () => {
      const { client } = await createVerifiedArtist();
      const songId = await uploadScheduledSong(client);

      const res = await client.get(`/songs/${songId}/stream`);
      expect(res.status).toBe(423);
    });
  });
});

describe('Phase 8 — Drop Notify Opt-in (BL-64)', () => {
  it('user opts in for drop notification', async () => {
    const { client: artistClient } = await createVerifiedArtist();
    const songId = await uploadScheduledSong(artistClient);

    const { client: userClient } = await createVerifiedUser();
    const res = await userClient.post(`/songs/${songId}/notify`);
    expect(res.status).toBe(201);
  });

  it('user opts out → DELETE removes the record', async () => {
    const { client: artistClient } = await createVerifiedArtist();
    const songId = await uploadScheduledSong(artistClient);
    const { client: userClient } = await createVerifiedUser();

    await userClient.post(`/songs/${songId}/notify`);
    const res = await userClient.delete(`/songs/${songId}/notify`);
    expect(res.status).toBe(200);
  });
});

describe('Phase 8 — Cancel Drop (BL-63)', () => {
  it('DELETE /songs/:id/drop → status=APPROVED, dropAt=null', async () => {
    const { client } = await createVerifiedArtist();
    const songId = await uploadScheduledSong(client);

    const res = await client.delete(`/songs/${songId}/drop`);
    expect(res.status).toBe(200);
    const song = extractData<any>(res);
    expect(song.status).toBe('APPROVED');
    expect(song.dropAt).toBeNull();
  });
});

describe('Phase 8 — Reschedule Drop (BL-65)', () => {
  it('first reschedule: updates dropAt', async () => {
    const { client } = await createVerifiedArtist();
    const songId = await uploadScheduledSong(client, 48);
    const newDropAt = new Date(Date.now() + 3 * 60 * 60 * 1000).toISOString();

    const res = await client.patch(`/songs/${songId}/drop`, { dropAt: newDropAt });
    expect(res.status).toBe(200);
    expect(extractData<any>(res).dropAt).toBe(newDropAt);
  });

  it('second reschedule: song goes back to PENDING for re-approval', async () => {
    const { client } = await createVerifiedArtist();
    const songId = await uploadScheduledSong(client, 72);

    // First reschedule
    await client.patch(`/songs/${songId}/drop`, {
      dropAt: new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString(),
    });

    // Second reschedule → must return PENDING
    const res = await client.patch(`/songs/${songId}/drop`, {
      dropAt: new Date(Date.now() + 25 * 60 * 60 * 1000).toISOString(),
    });
    expect(res.status).toBe(200);
    expect(extractData<any>(res).status).toBe('PENDING');
  });
});

describe('Phase 8 — Notifications (BL-80, BL-81, BL-82)', () => {
  describe('GET /notifications', () => {
    it('returns paginated notification list', async () => {
      const { client } = await createVerifiedUser();
      const res = await client.get('/notifications');
      expect(res.status).toBe(200);
      const data = extractData<any>(res);
      expect(Array.isArray(data.items ?? data)).toBe(true);
    });
  });

  describe('GET /notifications/unread-count (BL-82)', () => {
    it('returns numeric unread count', async () => {
      const { client } = await createVerifiedUser();
      const res = await client.get('/notifications/unread-count');
      expect(res.status).toBe(200);
      expect(typeof extractData<any>(res).count).toBe('number');
    });
  });

  describe('PATCH /notifications/:id/read (BL-81)', () => {
    it('marks notification as read', async () => {
      const { client } = await createVerifiedUser();
      const notifications = extractData<any>(await client.get('/notifications'));
      const unread = (notifications.items ?? notifications).find((n: any) => !n.isRead);
      if (!unread) return; // no notifications yet

      const res = await client.patch(`/notifications/${unread.id}/read`);
      expect(res.status).toBe(200);
      expect(extractData<any>(res).isRead).toBe(true);
    });

    it('cannot mark another user\'s notification → 403', async () => {
      const { client: clientA } = await createVerifiedUser();
      const { client: clientB } = await createVerifiedUser();

      const notifications = extractData<any>(await clientA.get('/notifications'));
      const notif = (notifications.items ?? notifications)[0];
      if (!notif) return;

      const res = await clientB.patch(`/notifications/${notif.id}/read`);
      expect(res.status).toBe(403);
    });
  });
});
