import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import * as request from 'supertest';
import { DropsController } from './drops.controller';
import { DropsService } from './drops.service';
import { SongStatus } from '../../common/enums';

const ARTIST_ID = 'artist-uuid-1';
const ARTIST_ROLES = ['ARTIST'];

const mockService = {
  getTeaser: jest.fn().mockResolvedValue({
    id: 'song-1',
    title: 'My Drop',
    artistName: 'DJ Test',
    coverArtUrl: null,
    dropAt: new Date(Date.now() + 86400000),
    teaserText: 'DJ Test · drops in 1 day',
  }),
  optIn: jest.fn().mockResolvedValue(undefined),
  optOut: jest.fn().mockResolvedValue(undefined),
  cancelDrop: jest.fn().mockResolvedValue(undefined),
  rescheduleDrop: jest.fn().mockResolvedValue({
    id: 'song-1',
    status: SongStatus.SCHEDULED,
    hasRescheduled: true,
  }),
  getDrops: jest.fn().mockResolvedValue([]),
};

describe('DropsController (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      controllers: [DropsController],
      providers: [{ provide: DropsService, useValue: mockService }],
    }).compile();

    app = module.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ transform: true, whitelist: true }));
    await app.init();
  });

  afterAll(() => app.close());
  beforeEach(() => jest.clearAllMocks());

  describe('GET /songs/:songId/teaser', () => {
    it('200 — returns teaser without auth', async () => {
      const res = await request(app.getHttpServer()).get('/songs/song-1/teaser').expect(200);
      expect(mockService.getTeaser).toHaveBeenCalledWith('song-1');
      expect(res.body.artistName).toBe('DJ Test');
    });
  });

  describe('POST /songs/:songId/notify', () => {
    it('201 — opts user into drop notification', async () => {
      await request(app.getHttpServer()).post('/songs/song-1/notify').expect(201);
      expect(mockService.optIn).toHaveBeenCalledWith(ARTIST_ID, 'song-1');
    });
  });

  describe('DELETE /songs/:songId/notify', () => {
    it('200 — opts user out of drop notification', async () => {
      await request(app.getHttpServer()).delete('/songs/song-1/notify').expect(200);
      expect(mockService.optOut).toHaveBeenCalledWith(ARTIST_ID, 'song-1');
    });
  });

  describe('DELETE /songs/:songId/drop', () => {
    it('200 — cancels the drop for the owning artist', async () => {
      await request(app.getHttpServer()).delete('/songs/song-1/drop').expect(200);
      expect(mockService.cancelDrop).toHaveBeenCalledWith(ARTIST_ID, 'song-1', ARTIST_ROLES);
    });
  });

  describe('PATCH /songs/:songId/drop', () => {
    it('200 — reschedules the drop with a valid future dropAt', async () => {
      const newDropAt = new Date(Date.now() + 3 * 86400000).toISOString();
      await request(app.getHttpServer())
        .patch('/songs/song-1/drop')
        .send({ dropAt: newDropAt })
        .expect(200);
      expect(mockService.rescheduleDrop).toHaveBeenCalledWith(
        ARTIST_ID,
        'song-1',
        expect.objectContaining({ dropAt: expect.any(Date) }),
        ARTIST_ROLES,
      );
    });

    it('400 — rejects request with missing dropAt', async () => {
      await request(app.getHttpServer()).patch('/songs/song-1/drop').send({}).expect(400);
    });
  });

  describe('GET /drops', () => {
    it('200 — returns scheduled drops for the artist', async () => {
      await request(app.getHttpServer()).get('/drops').expect(200);
      expect(mockService.getDrops).toHaveBeenCalledWith(ARTIST_ID, ARTIST_ROLES);
    });
  });
});
