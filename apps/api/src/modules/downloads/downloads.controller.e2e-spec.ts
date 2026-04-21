/**
 * E2E tests for Phase 7 — Downloads.
 * Run with: npm run test:e2e
 *
 * Prerequisites: docker-compose up; a LIVE song + PREMIUM user seeded in DB.
 */
// eslint-disable-next-line @typescript-eslint/no-require-imports
const request = require('supertest');
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { AppModule } from '../../app.module';

describe('DownloadsController (e2e)', () => {
  let app: INestApplication;
  let liveSongId: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.init();

    // TODO: seed PREMIUM user + LIVE song, capture JWT cookie + songId
  });

  afterAll(async () => {
    await app.close();
  });

  describe('POST /songs/:songId/download', () => {
    it('returns downloadUrl + licenseJwt for PREMIUM user', async () => {
      // TODO: attach PREMIUM user cookie
      const res = await request(app.getHttpServer())
        .post(`/api/v1/songs/${liveSongId}/download`)
        .expect(201);

      expect(res.body.data).toHaveProperty('downloadUrl');
      expect(res.body.data).toHaveProperty('licenseJwt');
      expect(res.body.data).toHaveProperty('expiresAt');
    });

    it('returns 403 for non-premium user', async () => {
      // TODO: use non-premium cookie
      await request(app.getHttpServer())
        .post(`/api/v1/songs/${liveSongId}/download`)
        .expect(403);
    });

    it('returns 401 for unauthenticated request', async () => {
      await request(app.getHttpServer())
        .post(`/api/v1/songs/${liveSongId}/download`)
        .expect(401);
    });
  });

  describe('GET /songs/downloads', () => {
    it('returns list of download records for authenticated user', async () => {
      // TODO: attach PREMIUM user cookie
      const res = await request(app.getHttpServer())
        .get('/api/v1/songs/downloads')
        .expect(200);

      expect(res.body.data).toBeInstanceOf(Array);
    });
  });

  describe('POST /songs/downloads/revalidate', () => {
    it('returns renewed/revoked arrays', async () => {
      // TODO: attach PREMIUM user cookie + real songIds
      const res = await request(app.getHttpServer())
        .post('/api/v1/songs/downloads/revalidate')
        .send({ songIds: [] })
        .expect(200);

      expect(res.body.data).toHaveProperty('renewed');
      expect(res.body.data).toHaveProperty('revoked');
    });

    it('returns 400 for invalid songIds array', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/songs/downloads/revalidate')
        .send({ songIds: ['not-a-uuid'] })
        .expect(400);
    });
  });

  describe('DELETE /songs/downloads/:songId', () => {
    it('returns 204 on successful removal', async () => {
      // TODO: attach PREMIUM cookie + pre-seeded download record
      await request(app.getHttpServer())
        .delete(`/api/v1/songs/downloads/${liveSongId}`)
        .expect(204);
    });

    it('returns 404 when download record does not exist', async () => {
      const fakeId = '00000000-0000-0000-0000-000000000000';
      await request(app.getHttpServer())
        .delete(`/api/v1/songs/downloads/${fakeId}`)
        .expect(404);
    });
  });
});
