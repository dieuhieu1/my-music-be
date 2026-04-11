/**
 * Phase 3 API Tests — User & Artist Profiles, Follow/Unfollow
 * BL-11, BL-32, BL-66, BL-67, BL-72, BL-73
 */
import { createClient, extractData } from '../../helpers/api-client';
import { createVerifiedUser, createVerifiedArtist } from '../../helpers/auth-helpers';

describe('Phase 3 — User Profile (BL-66)', () => {
  describe('GET /users/me', () => {
    it('returns own profile', async () => {
      const { client, name, email } = await createVerifiedUser();
      const res = await client.get('/users/me');
      expect(res.status).toBe(200);
      const data = extractData<any>(res);
      expect(data.email).toBe(email);
      expect(data.name).toBe(name);
      expect(data.passwordHash).toBeUndefined();
    });
  });

  describe('PATCH /users/me', () => {
    it('updates name successfully', async () => {
      const { client } = await createVerifiedUser();
      const res = await client.patch('/users/me', { name: 'Updated Name' });
      expect(res.status).toBe(200);
      expect(extractData<any>(res).name).toBe('Updated Name');
    });

    it('rejects empty name → 400', async () => {
      const { client } = await createVerifiedUser();
      const res = await client.patch('/users/me', { name: '' });
      expect(res.status).toBe(400);
    });
  });

  describe('GET /users/:id', () => {
    it('returns public profile of another user', async () => {
      const { id, client: clientA } = await createVerifiedUser();
      const { client: clientB } = await createVerifiedUser();
      const res = await clientB.get(`/users/${id}`);
      expect(res.status).toBe(200);
      const data = extractData<any>(res);
      expect(data.id).toBe(id);
      expect(data.email).toBeUndefined(); // email must not be in public profile
    });

    it('non-existent user → 404', async () => {
      const { client } = await createVerifiedUser();
      const res = await client.get('/users/00000000-0000-0000-0000-000000000000');
      expect(res.status).toBe(404);
    });
  });
});

describe('Phase 3 — Artist Profile (BL-67)', () => {
  describe('GET /artists/:id/profile', () => {
    it('returns public artist profile and increments listenerCount (BL-11)', async () => {
      const { artistProfileId, client } = await createVerifiedArtist();

      const before = extractData<any>(await client.get(`/artists/${artistProfileId}/profile`));
      const firstCount = before.listenerCount ?? 0;

      await client.get(`/artists/${artistProfileId}/profile`);
      const after = extractData<any>(await client.get(`/artists/${artistProfileId}/profile`));
      expect(after.listenerCount).toBeGreaterThan(firstCount);
    });

    it('returns only LIVE songs in artist profile (BL-11)', async () => {
      const { artistProfileId, client } = await createVerifiedArtist();
      const data = extractData<any>(await client.get(`/artists/${artistProfileId}/profile`));
      // All songs in the profile must be LIVE
      data.songs?.forEach((s: any) => expect(s.status).toBe('LIVE'));
    });
  });

  describe('PATCH /artists/me/profile', () => {
    it('updates stageName and bio', async () => {
      const { client } = await createVerifiedArtist();
      const res = await client.patch('/artists/me/profile', {
        stageName: 'New Stage Name',
        bio: 'Updated bio',
      });
      expect(res.status).toBe(200);
      const data = extractData<any>(res);
      expect(data.stageName).toBe('New Stage Name');
    });

    it('non-artist user cannot update artist profile → 403', async () => {
      const { client } = await createVerifiedUser();
      const res = await client.patch('/artists/me/profile', { stageName: 'X' });
      expect(res.status).toBe(403);
    });
  });
});

describe('Phase 3 — Follow / Unfollow (BL-32, BL-72, BL-73)', () => {
  it('user follows an artist → followerCount increments', async () => {
    const { artistProfileId, id: artistUserId } = await createVerifiedArtist();
    const { client } = await createVerifiedUser();

    const before = extractData<any>(await client.get(`/artists/${artistProfileId}/profile`));
    const countBefore = before.followerCount;

    const followRes = await client.post(`/artists/${artistProfileId}/follow`);
    expect(followRes.status).toBe(200);

    const after = extractData<any>(await client.get(`/artists/${artistProfileId}/profile`));
    expect(after.followerCount).toBe(countBefore + 1);
  });

  it('unfollowing reduces followerCount', async () => {
    const { artistProfileId } = await createVerifiedArtist();
    const { client } = await createVerifiedUser();

    await client.post(`/artists/${artistProfileId}/follow`);
    const before = extractData<any>(await client.get(`/artists/${artistProfileId}/profile`));

    const unfollow = await client.delete(`/artists/${artistProfileId}/follow`);
    expect(unfollow.status).toBe(200);

    const after = extractData<any>(await client.get(`/artists/${artistProfileId}/profile`));
    expect(after.followerCount).toBe(before.followerCount - 1);
  });

  it('self-follow is forbidden → 403', async () => {
    const { id, artistProfileId, client } = await createVerifiedArtist();
    const res = await client.post(`/artists/${artistProfileId}/follow`);
    expect(res.status).toBe(403);
  });

  it('following a user → followingCount increments for follower', async () => {
    const { id: userBId } = await createVerifiedUser();
    const { client: clientA } = await createVerifiedUser();

    const res = await clientA.post(`/users/${userBId}/follow`);
    expect(res.status).toBe(200);

    const me = extractData<any>(await clientA.get('/users/me'));
    expect(me.followingCount).toBeGreaterThanOrEqual(1);
  });

  it('self-follow on user → 403', async () => {
    const { id, client } = await createVerifiedUser();
    const res = await client.post(`/users/${id}/follow`);
    expect(res.status).toBe(403);
  });
});
