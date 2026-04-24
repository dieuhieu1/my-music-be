import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { AnalyticsService } from './analytics.service';
import { Song } from '../songs/entities/song.entity';
import { ArtistProfile } from '../auth/entities/artist-profile.entity';
import { Role, SongStatus } from '../../common/enums';

const mockRepo = () => ({ findOne: jest.fn() });

describe('AnalyticsService', () => {
  let service: AnalyticsService;
  let dataSource: { query: jest.Mock };

  beforeEach(async () => {
    dataSource = { query: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AnalyticsService,
        { provide: getRepositoryToken(Song),          useFactory: mockRepo },
        { provide: getRepositoryToken(ArtistProfile), useFactory: mockRepo },
        { provide: DataSource, useValue: dataSource },
      ],
    }).compile();

    service = module.get(AnalyticsService);
  });

  describe('getOverview', () => {
    it('returns aggregated overview for artist', async () => {
      const artistProfileRepo = module.get(getRepositoryToken(ArtistProfile));
      artistProfileRepo.findOne.mockResolvedValue({ followerCount: 42, stageName: 'DJ Test' });

      // dataSource.query called 3 times (totalPlays, totalLikes, topSongs)
      dataSource.query
        .mockResolvedValueOnce([{ total: '100' }])   // totalPlays
        .mockResolvedValueOnce([{ total: '50' }])    // totalLikes
        .mockResolvedValueOnce([                     // topSongs
          { id: 's1', title: 'Test Song', cover_art_url: null, plays: '80', likes: '20' },
        ]);

      const result = await service.getOverview('artist-1', [Role.ARTIST]);

      expect(result.totalPlays).toBe(100);
      expect(result.totalLikes).toBe(50);
      expect(result.followerCount).toBe(42);
      expect(result.topSongs).toHaveLength(1);
      expect(result.topSongs[0].plays).toBe(80);
    });

    it('throws NotFoundException if artist profile not found', async () => {
      const artistProfileRepo = module.get(getRepositoryToken(ArtistProfile));
      artistProfileRepo.findOne.mockResolvedValue(null);

      await expect(service.getOverview('artist-1', [Role.ARTIST])).rejects.toThrow('Artist profile not found');
    });
  });

  describe('getSongAnalytics', () => {
    it('returns 7d/30d plays, likes, and 30-day daily breakdown', async () => {
      const songRepo = module.get(getRepositoryToken(Song));
      songRepo.findOne.mockResolvedValue({ id: 's1', title: 'Hit', userId: 'artist-1', status: SongStatus.LIVE });

      dataSource.query
        .mockResolvedValueOnce([{ count: '10' }])  // 7d
        .mockResolvedValueOnce([{ count: '30' }])  // 30d
        .mockResolvedValueOnce([{ count: '5' }])   // likes
        .mockResolvedValueOnce(
          Array.from({ length: 30 }, (_, i) => ({ date: `2026-03-${String(i + 1).padStart(2, '0')}`, count: '0' })),
        );

      const result = await service.getSongAnalytics('artist-1', [Role.ARTIST], 's1');

      expect(result.plays['7d']).toBe(10);
      expect(result.plays['30d']).toBe(30);
      expect(result.likes).toBe(5);
      expect(result.dailyPlays).toHaveLength(30);
    });

    it('throws ForbiddenException if ARTIST requests another artist song', async () => {
      const songRepo = module.get(getRepositoryToken(Song));
      songRepo.findOne.mockResolvedValue({ id: 's1', userId: 'other-artist', status: SongStatus.LIVE });

      await expect(
        service.getSongAnalytics('artist-1', [Role.ARTIST], 's1'),
      ).rejects.toThrow('do not have access');
    });

    it('allows ADMIN to view any song analytics', async () => {
      const songRepo = module.get(getRepositoryToken(Song));
      songRepo.findOne.mockResolvedValue({ id: 's1', title: 'Hit', userId: 'other-artist', status: SongStatus.LIVE });

      dataSource.query
        .mockResolvedValueOnce([{ count: '0' }])
        .mockResolvedValueOnce([{ count: '0' }])
        .mockResolvedValueOnce([{ count: '0' }])
        .mockResolvedValueOnce([]);

      await expect(
        service.getSongAnalytics('admin-1', [Role.ADMIN], 's1'),
      ).resolves.toBeDefined();
    });
  });

  let module: TestingModule;
  beforeEach(async () => {
    dataSource = { query: jest.fn() };
    module = await Test.createTestingModule({
      providers: [
        AnalyticsService,
        { provide: getRepositoryToken(Song),          useFactory: mockRepo },
        { provide: getRepositoryToken(ArtistProfile), useFactory: mockRepo },
        { provide: DataSource, useValue: dataSource },
      ],
    }).compile();
    service = module.get(AnalyticsService);
  });
});
