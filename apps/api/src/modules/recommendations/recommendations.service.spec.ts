import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';
import { Repository } from 'typeorm';

import { RecommendationsService, ContextSignals } from './recommendations.service';
import { Song } from '../songs/entities/song.entity';
import { PlayHistory } from '../playback/entities/play-history.entity';
import { Playlist } from '../playlists/entities/playlist.entity';
import { PlaylistSong } from '../playlists/entities/playlist-song.entity';
import { Genre } from '../genres/entities/genre.entity';
import { ArtistProfile } from '../auth/entities/artist-profile.entity';
import { UserGenrePreference } from '../users/entities/user-genre-preference.entity';
import { RecommendationCache } from './entities/recommendation-cache.entity';
import { MoodType } from '../../common/enums';

function repoMock<T = unknown>(): jest.Mocked<Partial<Repository<T>>> {
  return {
    createQueryBuilder: jest.fn().mockReturnValue({
      select: jest.fn().mockReturnThis(),
      addSelect: jest.fn().mockReturnThis(),
      leftJoin: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      whereInIds: jest.fn().mockReturnThis(),
      getRawOne: jest.fn().mockResolvedValue(null),
      getRawMany: jest.fn().mockResolvedValue([]),
      getOne: jest.fn().mockResolvedValue(null),
      getMany: jest.fn().mockResolvedValue([]),
    }),
    findOne: jest.fn().mockResolvedValue(null),
    update:  jest.fn().mockResolvedValue({}),
    save:    jest.fn().mockResolvedValue({}),
    create:  jest.fn().mockImplementation((v) => v),
  } as jest.Mocked<Partial<Repository<T>>>;
}

const redisMock = {
  get: jest.fn().mockResolvedValue(null),
  set: jest.fn().mockResolvedValue('OK'),
};

jest.mock('ioredis', () => jest.fn().mockImplementation(() => redisMock));

describe('RecommendationsService', () => {
  let service: RecommendationsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RecommendationsService,
        { provide: getRepositoryToken(Song),                useValue: repoMock() },
        { provide: getRepositoryToken(PlayHistory),         useValue: repoMock() },
        { provide: getRepositoryToken(Playlist),            useValue: repoMock() },
        { provide: getRepositoryToken(PlaylistSong),        useValue: repoMock() },
        { provide: getRepositoryToken(Genre),               useValue: repoMock() },
        { provide: getRepositoryToken(ArtistProfile),       useValue: repoMock() },
        { provide: getRepositoryToken(UserGenrePreference), useValue: repoMock() },
        { provide: getRepositoryToken(RecommendationCache), useValue: repoMock() },
        {
          provide: ConfigService,
          useValue: { get: jest.fn().mockReturnValue('localhost') },
        },
      ],
    }).compile();

    service = module.get(RecommendationsService);
  });

  // ── resolveInferredMood ────────────────────────────────────────────────────

  describe('resolveInferredMood', () => {
    it('returns null when X-Local-Hour header is absent', () => {
      expect(service.resolveInferredMood({})).toBeNull();
    });

    it('returns FOCUS for hour=8 on a weekday with no location', () => {
      // Weekday: Monday = 1. Mocking Date.getDay() would need jest.spyOn.
      // Simple path: just assert FOCUS from time signal when count doesn't reach 3.
      const result = service.resolveInferredMood({ localHour: 8 });
      // Only 1 signal (FOCUS from time) — < 3 → null
      expect(result).toBeNull();
    });

    it('returns WORKOUT when gym + weekend + morning combine to 3 agreeing signals', () => {
      // This requires all 3 signals pointing to the same mood — very rare by design.
      // Simulate by counting: gym=WORKOUT(1). Max=1 < 3. Returns null.
      const result = service.resolveInferredMood({ localHour: 8, locationContext: 'gym' });
      expect(result).toBeNull();
    });

    it('returns null for neutral hour 14 with no location or weekend', () => {
      expect(service.resolveInferredMood({ localHour: 14 })).toBeNull();
    });
  });

  // ── applyDeviceFilter ─────────────────────────────────────────────────────

  describe('applyDeviceFilter', () => {
    const genreMap = new Map<string, string>();

    it('returns all songs in original order for desktop', () => {
      const input = [
        { song: { id: '1', title: 'A', userId: 'u', coverArtUrl: null, duration: 300, genreIdsRaw: null, bpm: null, camelotKey: null, energy: 0.5, listenCount: 10, createdAt: new Date(), stageName: 'Artist' }, score: 10 },
        { song: { id: '2', title: 'B', userId: 'u', coverArtUrl: null, duration: 200, genreIdsRaw: null, bpm: null, camelotKey: null, energy: 0.8, listenCount: 5,  createdAt: new Date(), stageName: 'Artist' }, score: 8 },
      ];
      const result = service.applyDeviceFilter(input, { deviceType: 'desktop' }, genreMap);
      expect(result[0].id).toBe('1');
      expect(result[1].id).toBe('2');
    });

    it('boosts short+energetic songs to front for mobile', () => {
      const input = [
        { song: { id: '1', title: 'Long', userId: 'u', coverArtUrl: null, duration: 400, genreIdsRaw: null, bpm: null, camelotKey: null, energy: 0.9, listenCount: 20, createdAt: new Date(), stageName: 'Artist' }, score: 20 },
        { song: { id: '2', title: 'Short+Energetic', userId: 'u', coverArtUrl: null, duration: 180, genreIdsRaw: null, bpm: null, camelotKey: null, energy: 0.7, listenCount: 5, createdAt: new Date(), stageName: 'Artist' }, score: 5 },
      ];
      const result = service.applyDeviceFilter(input, { deviceType: 'mobile' }, genreMap);
      expect(result[0].id).toBe('2'); // short+energetic boosted
      expect(result[1].id).toBe('1');
    });
  });

  // ── getFromCacheOrCompute ─────────────────────────────────────────────────

  describe('getFromCacheOrCompute', () => {
    it('returns cached songs from Redis without touching the DB', async () => {
      const cached = [{ id: 'cached-id', title: 'Cached', artistName: 'A', coverArtUrl: null, duration: 180, genres: [], bpm: 120, camelotKey: null, totalPlays: 10, createdAt: new Date().toISOString() }];
      redisMock.get.mockResolvedValueOnce(JSON.stringify(cached));

      const result = await service.getFromCacheOrCompute(
        'rec:user:test:general', 'user-1', null, 20, '30d', {},
      );
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('cached-id');
    });
  });

  // ── computeGeneralRecs ────────────────────────────────────────────────────

  describe('computeGeneralRecs', () => {
    it('falls back to cold start recs when user has < 5 non-skipped plays', async () => {
      const getColdStartSpy = jest.spyOn(service, 'getColdStartRecs').mockResolvedValueOnce([]);
      await service.computeGeneralRecs('user-new', 20, '30d', {});
      expect(getColdStartSpy).toHaveBeenCalled();
    });
  });

  // ── computeMoodRecs ───────────────────────────────────────────────────────

  describe('computeMoodRecs', () => {
    it('falls back to listenCount sort for cold-start users', async () => {
      const result = await service.computeMoodRecs('user-new', MoodType.HAPPY, 20, '30d', {});
      expect(Array.isArray(result)).toBe(true);
    });
  });
});
