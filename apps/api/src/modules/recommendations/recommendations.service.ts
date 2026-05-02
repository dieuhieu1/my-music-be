import {
  Injectable,
  Logger,
  UnprocessableEntityException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, IsNull } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

import { Song } from '../songs/entities/song.entity';
import { PlayHistory } from '../playback/entities/play-history.entity';
import { Playlist } from '../playlists/entities/playlist.entity';
import { PlaylistSong } from '../playlists/entities/playlist-song.entity';
import { Genre } from '../genres/entities/genre.entity';
import { ArtistProfile } from '../auth/entities/artist-profile.entity';
import { User } from '../auth/entities/user.entity';
import { UserGenrePreference } from '../users/entities/user-genre-preference.entity';
import { RecommendationCache } from './entities/recommendation-cache.entity';

import { GetRecommendationsDto } from './dto/recommendation-query.dto';
import { GetMoodRecommendationsDto } from './dto/mood-recommendation-query.dto';
import { SongRecommendationDto } from './dto/song-recommendation.dto';
import { MoodType, SongStatus } from '../../common/enums';

// ── Mood config (BL-36A) ──────────────────────────────────────────────────────
// Energy ranges overlap intentionally — adjacent moods share boundary songs.
interface MoodConfig {
  genreNames: string[];
  bpmMin: number;
  bpmMax: number;
  energyMin: number;
  energyMax: number;
}

const MOOD_CONFIG: Record<MoodType, MoodConfig> = {
  [MoodType.HAPPY]:   { genreNames: ['Pop', 'Dance'],                  bpmMin: 120, bpmMax: 145, energyMin: 0.60, energyMax: 0.80 },
  [MoodType.SAD]:     { genreNames: ['Ballad', 'Acoustic'],            bpmMin: 60,  bpmMax: 90,  energyMin: 0.00, energyMax: 0.25 },
  [MoodType.FOCUS]:   { genreNames: ['Lo-fi', 'Ambient', 'Classical'], bpmMin: 70,  bpmMax: 100, energyMin: 0.40, energyMax: 0.65 },
  [MoodType.CHILL]:   { genreNames: ['R&B', 'Jazz', 'Indie'],          bpmMin: 80,  bpmMax: 110, energyMin: 0.25, energyMax: 0.50 },
  [MoodType.WORKOUT]: { genreNames: ['EDM', 'Hip-Hop', 'Rock'],        bpmMin: 130, bpmMax: 175, energyMin: 0.75, energyMax: 1.00 },
};

const COLD_START_THRESHOLD = 5;
const CACHE_TTL_SECONDS    = 86400; // 24h
const SKIP_DECAY_DAYS      = 90;
const RECENTLY_HEARD_DAYS  = 7;
const SCORING_DAYS_30      = 30;
const SCORING_DAYS_7       = 7;
const TOP_GENRES_COUNT     = 5;
const TOP_ARTISTS_COUNT    = 10;
const MAX_CANDIDATES       = 500;

// ── Internal types ────────────────────────────────────────────────────────────

export interface ContextSignals {
  deviceType?: string;
  localHour?: number;
  locationContext?: string;
}

interface RawCandidateSong {
  id: string;
  title: string;
  userId: string;
  coverArtUrl: string | null;
  duration: number | null;
  genreIdsRaw: string | null; // CSV of genre UUIDs (TypeORM simple-array raw form)
  bpm: number | null;
  camelotKey: string | null;
  energy: number | null;      // internal only — stripped before any response
  listenCount: number;
  createdAt:   Date;
  artistName:  string | null;
}

interface ScoredCandidate {
  song: RawCandidateSong;
  score: number;
}

// ── Service ───────────────────────────────────────────────────────────────────

@Injectable()
export class RecommendationsService {
  private readonly logger = new Logger(RecommendationsService.name);
  private readonly redis: Redis;

  constructor(
    @InjectRepository(Song)
    private readonly songsRepo: Repository<Song>,
    @InjectRepository(PlayHistory)
    private readonly playHistoryRepo: Repository<PlayHistory>,
    @InjectRepository(Playlist)
    private readonly playlistsRepo: Repository<Playlist>,
    @InjectRepository(PlaylistSong)
    private readonly playlistSongsRepo: Repository<PlaylistSong>,
    @InjectRepository(Genre)
    private readonly genresRepo: Repository<Genre>,
    @InjectRepository(ArtistProfile)
    private readonly artistProfilesRepo: Repository<ArtistProfile>,
    @InjectRepository(UserGenrePreference)
    private readonly genrePrefsRepo: Repository<UserGenrePreference>,
    @InjectRepository(RecommendationCache)
    private readonly recCacheRepo: Repository<RecommendationCache>,
    private readonly config: ConfigService,
  ) {
    this.redis = new Redis({
      host:        config.get<string>('redis.host'),
      port:        config.get<number>('redis.port'),
      password:    config.get<string>('redis.password') || undefined,
      lazyConnect: true,
    });
  }

  // ── GET /recommendations ─────────────────────────────────────────────────

  async getRecommendations(
    userId: string,
    dto: GetRecommendationsDto,
    context: ContextSignals,
  ): Promise<SongRecommendationDto[]> {
    const timeRange = dto.timeRange ?? '30d';
    if (!['7d', '30d'].includes(timeRange)) {
      throw new UnprocessableEntityException('timeRange must be 7d or 30d');
    }
    return this.getFromCacheOrCompute(`rec:user:${userId}:general`, userId, null, dto.size ?? 20, timeRange, context);
  }

  // ── GET /recommendations/mood ────────────────────────────────────────────

  async getMoodRecommendations(
    userId: string,
    dto: GetMoodRecommendationsDto,
    context: ContextSignals,
  ): Promise<{ mood: MoodType | null; inferred: boolean; songs: SongRecommendationDto[] }> {
    let resolvedMood: MoodType | null = dto.mood ?? null;
    let inferred = false;

    if (!resolvedMood) {
      resolvedMood = this.resolveInferredMood(context);
      inferred = resolvedMood !== null;
    }

    const size = dto.size ?? 20;

    if (!resolvedMood) {
      // Confidence threshold not met — fall back to general recs (no mood filter)
      const songs = await this.getFromCacheOrCompute(
        `rec:user:${userId}:general`, userId, null, size, '30d', context,
      );
      return { mood: null, inferred: false, songs };
    }

    const songs = await this.getFromCacheOrCompute(
      `rec:user:${userId}:mood:${resolvedMood}`, userId, resolvedMood, size, '30d', context,
    );
    return { mood: resolvedMood, inferred, songs };
  }

  // ── Cache-aside ──────────────────────────────────────────────────────────

  async getFromCacheOrCompute(
    cacheKey: string,
    userId: string,
    mood: MoodType | null,
    size: number,
    timeRange: '7d' | '30d',
    context: ContextSignals,
  ): Promise<SongRecommendationDto[]> {
    try {
      const cached = await this.redis.get(cacheKey);
      if (cached) {
        return (JSON.parse(cached) as SongRecommendationDto[]).slice(0, size);
      }
    } catch (err) {
      this.logger.warn(`Redis read failed for ${cacheKey}: ${(err as Error).message}`);
    }

    const all = mood
      ? await this.computeMoodRecs(userId, mood, MAX_CANDIDATES, timeRange, context)
      : await this.computeGeneralRecs(userId, MAX_CANDIDATES, timeRange, context);

    await this.writeCache(cacheKey, userId, mood, all);
    return all.slice(0, size);
  }

  // ── General recommendations (BL-35) ─────────────────────────────────────

  async computeGeneralRecs(
    userId: string,
    size: number,
    timeRange: '7d' | '30d',
    context: ContextSignals,
  ): Promise<SongRecommendationDto[]> {
    if (await this.isColdStart(userId)) {
      return this.getColdStartRecs(userId, size, context);
    }

    const { topGenreIds, topArtistIds, recentlyHeardIds, skipMap } =
      await this.buildUserSignals(userId, timeRange);

    const likedIds     = await this.getLikedSongIds(userId);
    const exclusionIds = new Set([...recentlyHeardIds, ...likedIds]);
    const candidates   = await this.fetchCandidateSongs(exclusionIds);
    const genreMap     = await this.buildGenreMap(candidates);

    const scored = this.scoreCandidates(candidates, topGenreIds, topArtistIds, skipMap);
    return this.applyDeviceFilter(scored, context, genreMap).slice(0, size);
  }

  // ── Mood recommendations (BL-36A) ────────────────────────────────────────

  async computeMoodRecs(
    userId: string,
    mood: MoodType,
    size: number,
    timeRange: '7d' | '30d',
    context: ContextSignals,
  ): Promise<SongRecommendationDto[]> {
    const cfg = MOOD_CONFIG[mood];

    const [isColdStart, likedIds, moodGenreIds] = await Promise.all([
      this.isColdStart(userId),
      this.getLikedSongIds(userId),
      this.resolveMoodGenreIds(cfg.genreNames),
    ]);

    const recentlyHeardIds = isColdStart ? [] : await this.getRecentlyHeardIds(userId);
    const exclusionIds     = new Set([...recentlyHeardIds, ...likedIds]);
    const candidates       = await this.fetchCandidateSongs(exclusionIds, {
      bpmMin: cfg.bpmMin, bpmMax: cfg.bpmMax,
      energyMin: cfg.energyMin, energyMax: cfg.energyMax,
      genreIds: moodGenreIds,
    });
    const genreMap = await this.buildGenreMap(candidates);

    if (isColdStart) {
      const sorted = [...candidates].sort((a, b) => b.listenCount - a.listenCount);
      const scored: ScoredCandidate[] = sorted.map(s => ({ song: s, score: s.listenCount }));
      return this.applyDeviceFilter(scored, context, genreMap).slice(0, size);
    }

    const { topGenreIds, topArtistIds, skipMap } = await this.buildUserSignals(userId, timeRange);
    const scored = this.scoreCandidates(candidates, topGenreIds, topArtistIds, skipMap);
    return this.applyDeviceFilter(scored, context, genreMap).slice(0, size);
  }

  // ── Cold start (BL-35A) ──────────────────────────────────────────────────

  private async isColdStart(userId: string): Promise<boolean> {
    const result = await this.playHistoryRepo
      .createQueryBuilder('ph')
      .select('COUNT(ph.id)', 'count')
      .where('ph.userId = :userId AND ph.skipped = false', { userId })
      .getRawOne<{ count: string }>();
    return parseInt(result?.count ?? '0', 10) < COLD_START_THRESHOLD;
  }

  async getColdStartRecs(
    userId: string,
    size: number,
    context: ContextSignals,
  ): Promise<SongRecommendationDto[]> {
    const prefs = await this.genrePrefsRepo
      .createQueryBuilder('ugp')
      .select('ugp.genreId', 'genreId')
      .where('ugp.userId = :userId', { userId })
      .getRawMany<{ genreId: string }>();

    if (prefs.length > 0) {
      const prefIds    = prefs.map(p => p.genreId);
      const candidates = await this.fetchCandidateSongs(new Set(), { genreIds: prefIds });
      const genreMap   = await this.buildGenreMap(candidates);
      const sorted     = [...candidates].sort((a, b) => b.listenCount - a.listenCount);
      const scored: ScoredCandidate[] = sorted.map(s => ({ song: s, score: s.listenCount }));
      return this.applyDeviceFilter(scored, context, genreMap).slice(0, size);
    }

    // Fallback: global top LIVE songs
    return this.fetchTopLiveSongs(size, context);
  }

  // ── User signals ─────────────────────────────────────────────────────────

  private async buildUserSignals(
    userId: string,
    timeRange: '7d' | '30d',
  ): Promise<{
    topGenreIds: string[];
    topArtistIds: string[];
    recentlyHeardIds: string[];
    skipMap: Map<string, Date>;
  }> {
    const days90Ago    = new Date(Date.now() - SKIP_DECAY_DAYS * 86400_000);
    const days7Ago     = new Date(Date.now() - RECENTLY_HEARD_DAYS * 86400_000);
    const scoringDays  = timeRange === '7d' ? SCORING_DAYS_7 : SCORING_DAYS_30;
    const scoringSince = new Date(Date.now() - scoringDays * 86400_000);

    // Single query covering skip-decay window (90d) and scoring window (7d or 30d)
    const rows = await this.playHistoryRepo
      .createQueryBuilder('ph')
      .select('ph.songId',   'songId')
      .addSelect('ph.playedAt', 'playedAt')
      .addSelect('ph.skipped',  'skipped')
      .where('ph.userId = :userId AND ph.playedAt > :since90', { userId, since90: days90Ago })
      .getRawMany<{ songId: string; playedAt: string; skipped: boolean | string }>();

    const recentlyHeardIds: string[] = [];
    const skipMap = new Map<string, Date>();
    const scoringIds: string[] = [];

    for (const row of rows) {
      const playedAt = new Date(row.playedAt);
      const skipped  = row.skipped === true || row.skipped === 'true';

      if (skipped) {
        const prev = skipMap.get(row.songId);
        if (!prev || prev < playedAt) skipMap.set(row.songId, playedAt);
      } else {
        if (playedAt >= days7Ago)    recentlyHeardIds.push(row.songId);
        if (playedAt >= scoringSince) scoringIds.push(row.songId);
      }
    }

    if (scoringIds.length === 0) {
      return { topGenreIds: [], topArtistIds: [], recentlyHeardIds, skipMap };
    }

    const uniqueSongIds = [...new Set(scoringIds)];
    const playedSongs   = await this.songsRepo
      .createQueryBuilder('s')
      .select(['s.id', 's.userId', 's.genreIds'])
      .whereInIds(uniqueSongIds)
      .getMany();

    const genreCount  = new Map<string, number>();
    const artistCount = new Map<string, number>();

    for (const song of playedSongs) {
      const freq = scoringIds.filter(id => id === song.id).length;
      for (const gid of (song.genreIds ?? [])) {
        genreCount.set(gid, (genreCount.get(gid) ?? 0) + freq);
      }
      artistCount.set(song.userId, (artistCount.get(song.userId) ?? 0) + freq);
    }

    const topGenreIds = [...genreCount.entries()]
      .sort((a, b) => b[1] - a[1]).slice(0, TOP_GENRES_COUNT).map(([id]) => id);
    const topArtistIds = [...artistCount.entries()]
      .sort((a, b) => b[1] - a[1]).slice(0, TOP_ARTISTS_COUNT).map(([id]) => id);

    return { topGenreIds, topArtistIds, recentlyHeardIds, skipMap };
  }

  private async getRecentlyHeardIds(userId: string): Promise<string[]> {
    const since7 = new Date(Date.now() - RECENTLY_HEARD_DAYS * 86400_000);
    const rows   = await this.playHistoryRepo
      .createQueryBuilder('ph')
      .select('ph.songId', 'songId')
      .where('ph.userId = :userId AND ph.playedAt > :since AND ph.skipped = false', { userId, since: since7 })
      .getRawMany<{ songId: string }>();
    return rows.map(r => r.songId);
  }

  // ── Liked songs ──────────────────────────────────────────────────────────

  private async getLikedSongIds(userId: string): Promise<string[]> {
    const likedPlaylist = await this.playlistsRepo
      .createQueryBuilder('p')
      .select('p.id', 'id')
      .where('p.userId = :userId AND p.isLikedSongs = true', { userId })
      .getRawOne<{ id: string }>();

    if (!likedPlaylist) return [];

    const rows = await this.playlistSongsRepo
      .createQueryBuilder('ps')
      .select('ps.songId', 'songId')
      .where('ps.playlistId = :pid', { pid: likedPlaylist.id })
      .getRawMany<{ songId: string }>();

    return rows.map(r => r.songId);
  }

  // ── Candidate songs (one JOIN query, no per-song loops) ──────────────────

  private async fetchCandidateSongs(
    exclusionIds: Set<string>,
    moodFilter?: {
      bpmMin?: number;  bpmMax?: number;
      energyMin?: number; energyMax?: number;
      genreIds?: string[];
    },
  ): Promise<RawCandidateSong[]> {
    type RawRow = {
      id: string; title: string; userId: string; coverArtUrl: string | null;
      duration: string | null; genreIdsRaw: string | null; bpm: string | null;
      camelotKey: string | null; energy: string | null; listenCount: string;
      createdAt: Date; artistName: string | null;
    };

    const qb = this.songsRepo
      .createQueryBuilder('s')
      .select('s.id',          'id')
      .addSelect('s.title',        'title')
      .addSelect('s.userId',       'userId')
      .addSelect('s.coverArtUrl',  'coverArtUrl')
      .addSelect('s.duration',     'duration')
      .addSelect('s.genreIds',     'genreIdsRaw')
      .addSelect('s.bpm',          'bpm')
      .addSelect('s.camelotKey',   'camelotKey')
      .addSelect('s.energy',       'energy')
      .addSelect('s.listenCount',  'listenCount')
      .addSelect('s.createdAt',    'createdAt')
      .addSelect('COALESCE(ap.stageName, u.name)', 'artistName')
      .leftJoin(ArtistProfile, 'ap', '(s.artist_profile_id::text = ap.id::text AND s.artist_profile_id IS NOT NULL) OR (s.user_id::text = ap.user_id::text AND s.artist_profile_id IS NULL)')
      .leftJoin(User, 'u', 'u.id::text = s.user_id::text')
      .where('s.status = :status', { status: SongStatus.LIVE })
      .limit(MAX_CANDIDATES);

    if (exclusionIds.size > 0) {
      qb.andWhere('s.id NOT IN (:...exclusionIds)', { exclusionIds: [...exclusionIds] });
    }
    if (moodFilter?.bpmMin !== undefined) {
      qb.andWhere('s.bpm IS NOT NULL AND s.bpm >= :bpmMin AND s.bpm <= :bpmMax',
        { bpmMin: moodFilter.bpmMin, bpmMax: moodFilter.bpmMax });
    }
    if (moodFilter?.energyMin !== undefined) {
      qb.andWhere('s.energy IS NOT NULL AND s.energy >= :energyMin AND s.energy <= :energyMax',
        { energyMin: moodFilter.energyMin, energyMax: moodFilter.energyMax });
    }

    const rawRows = await qb.getRawMany<RawRow>();
    let candidates: RawCandidateSong[] = rawRows.map(r => ({
      id:          r.id,
      title:       r.title,
      userId:      r.userId,
      coverArtUrl: r.coverArtUrl,
      duration:    r.duration    != null ? parseFloat(r.duration)    : null,
      genreIdsRaw: r.genreIdsRaw,
      bpm:         r.bpm         != null ? parseFloat(r.bpm)         : null,
      camelotKey:  r.camelotKey,
      energy:      r.energy      != null ? parseFloat(r.energy)      : null,
      listenCount: parseInt(r.listenCount, 10) || 0,
      createdAt:   r.createdAt,
      artistName:  r.artistName,
    }));

    // Post-filter by mood genre IDs (simple-array CSV column cannot be JOINed directly)
    if (moodFilter?.genreIds?.length) {
      const moodGidSet = new Set(moodFilter.genreIds);
      candidates = candidates.filter(c =>
        (c.genreIdsRaw ? c.genreIdsRaw.split(',').filter(Boolean) : []).some(gid => moodGidSet.has(gid)),
      );
    }

    return candidates;
  }

  private async fetchTopLiveSongs(size: number, context: ContextSignals): Promise<SongRecommendationDto[]> {
    type RawRow = {
      id: string; title: string; userId: string; coverArtUrl: string | null;
      duration: string | null; genreIdsRaw: string | null; bpm: string | null;
      camelotKey: string | null; energy: string | null; listenCount: string;
      createdAt: Date; artistName: string | null;
    };

    const rawRows = await this.songsRepo
      .createQueryBuilder('s')
      .select('s.id',         'id')
      .addSelect('s.title',       'title')
      .addSelect('s.userId',      'userId')
      .addSelect('s.coverArtUrl', 'coverArtUrl')
      .addSelect('s.duration',    'duration')
      .addSelect('s.genreIds',    'genreIdsRaw')
      .addSelect('s.bpm',         'bpm')
      .addSelect('s.camelotKey',  'camelotKey')
      .addSelect('s.energy',      'energy')
      .addSelect('s.listenCount', 'listenCount')
      .addSelect('s.createdAt',   'createdAt')
      .addSelect('COALESCE(ap.stageName, u.name)', 'artistName')
      .leftJoin(ArtistProfile, 'ap', '(s.artist_profile_id::text = ap.id::text AND s.artist_profile_id IS NOT NULL) OR (s.user_id::text = ap.user_id::text AND s.artist_profile_id IS NULL)')
      .leftJoin(User, 'u', 'u.id::text = s.user_id::text')
      .where('s.status = :status', { status: SongStatus.LIVE })
      .orderBy('s.listenCount', 'DESC')
      .limit(size * 3)
      .getRawMany<RawRow>();

    const candidates: RawCandidateSong[] = rawRows.map(r => ({
      id:          r.id,
      title:       r.title,
      userId:      r.userId,
      coverArtUrl: r.coverArtUrl,
      duration:    r.duration  != null ? parseFloat(r.duration)  : null,
      genreIdsRaw: r.genreIdsRaw,
      bpm:         r.bpm       != null ? parseFloat(r.bpm)       : null,
      camelotKey:  r.camelotKey,
      energy:      r.energy    != null ? parseFloat(r.energy)    : null,
      listenCount: parseInt(r.listenCount, 10) || 0,
      createdAt:   r.createdAt,
      artistName:  r.artistName,
    }));

    const genreMap = await this.buildGenreMap(candidates);
    const scored: ScoredCandidate[] = candidates.map(s => ({ song: s, score: s.listenCount }));
    return this.applyDeviceFilter(scored, context, genreMap).slice(0, size);
  }

  // ── Scoring (BL-35) ──────────────────────────────────────────────────────

  private scoreCandidates(
    candidates: RawCandidateSong[],
    topGenreIds: string[],
    topArtistIds: string[],
    skipMap: Map<string, Date>,
  ): ScoredCandidate[] {
    const topGenreSet   = new Set(topGenreIds);
    const topArtistSet  = new Set(topArtistIds);
    const thirtyDaysAgo = new Date(Date.now() - SCORING_DAYS_30 * 86400_000);
    const now           = Date.now();

    return candidates
      .map(c => {
        const genreIds    = c.genreIdsRaw ? c.genreIdsRaw.split(',').filter(Boolean) : [];
        const genreMatch  = genreIds.filter(gid => topGenreSet.has(gid)).length * 3;
        const artistMatch = topArtistSet.has(c.userId) ? 2 : 0;
        const recencyBoost = c.createdAt > thirtyDaysAgo ? 1 : 0;

        let skipPenalty = 0;
        const skippedAt = skipMap.get(c.id);
        if (skippedAt) {
          const daysSinceSkip = (now - skippedAt.getTime()) / 86400_000;
          if (daysSinceSkip < SKIP_DECAY_DAYS) {
            skipPenalty = -3 * Math.max(0, (SKIP_DECAY_DAYS - daysSinceSkip) / SKIP_DECAY_DAYS);
          }
        }

        return { song: c, score: genreMatch + artistMatch + recencyBoost + skipPenalty };
      })
      .sort((a, b) => b.score - a.score);
  }

  // ── Device filter (BL-38A) ───────────────────────────────────────────────

  applyDeviceFilter(
    scored: ScoredCandidate[],
    context: ContextSignals,
    genreMap: Map<string, string>,
  ): SongRecommendationDto[] {
    if (context.deviceType?.toLowerCase() !== 'mobile') {
      return scored.map(s => this.toDto(s.song, genreMap));
    }
    // Soft boost: energetic short songs float to top; others are appended
    const boosted = scored.filter(s => (s.song.duration ?? Infinity) < 240 && (s.song.energy ?? 0) >= 0.60);
    const rest    = scored.filter(s => !boosted.includes(s));
    return [...boosted, ...rest].map(s => this.toDto(s.song, genreMap));
  }

  // ── Inferred mood (BL-36B) ───────────────────────────────────────────────

  resolveInferredMood(context: ContextSignals): MoodType | null {
    if (context.localHour === undefined) return null;

    const signals: MoodType[] = [];

    // Location context (BL-38C)
    if (context.locationContext === 'gym')     signals.push(MoodType.WORKOUT);
    if (context.locationContext === 'commute') signals.push(MoodType.HAPPY);

    // Weekend override
    const day = new Date().getDay();
    if (day === 0 || day === 6) signals.push(MoodType.HAPPY);

    // Time-based signal (X-Local-Hour 0–23)
    const h = context.localHour;
    if (h >= 6 && h < 10)              signals.push(MoodType.FOCUS);
    if ((h >= 18 && h <= 23) || h < 2) signals.push(MoodType.CHILL);
    // 10–18 is neutral — no signal added

    const moodCount = new Map<MoodType, number>();
    for (const m of signals) moodCount.set(m, (moodCount.get(m) ?? 0) + 1);
    if (moodCount.size === 0) return null;

    const [topMood, topCount] = [...moodCount.entries()].sort((a, b) => b[1] - a[1])[0];
    return topCount >= 3 ? topMood : null;
  }

  // ── Mood genre ID resolution ─────────────────────────────────────────────

  private async resolveMoodGenreIds(genreNames: string[]): Promise<string[]> {
    const genres = await this.genresRepo
      .createQueryBuilder('g')
      .select('g.id', 'id')
      .where('g.name IN (:...names) AND g.isActive = true', { names: genreNames })
      .getRawMany<{ id: string }>();
    return genres.map(g => g.id);
  }

  // ── Genre name map (one batch query for all candidates) ──────────────────

  private async buildGenreMap(candidates: RawCandidateSong[]): Promise<Map<string, string>> {
    const allGenreIds = [
      ...new Set(candidates.flatMap(c => c.genreIdsRaw ? c.genreIdsRaw.split(',').filter(Boolean) : [])),
    ];
    if (allGenreIds.length === 0) return new Map();

    const genres = await this.genresRepo
      .createQueryBuilder('g')
      .select('g.id', 'id').addSelect('g.name', 'name')
      .where('g.id IN (:...ids)', { ids: allGenreIds })
      .getRawMany<{ id: string; name: string }>();

    return new Map(genres.map(g => [g.id, g.name]));
  }

  // ── DTO builder (energy intentionally absent) ────────────────────────────

  private toDto(c: RawCandidateSong, genreMap: Map<string, string>): SongRecommendationDto {
    const genreIds = c.genreIdsRaw ? c.genreIdsRaw.split(',').filter(Boolean) : [];
    return {
      id:          c.id,
      title:       c.title,
      artistName:  c.artistName ?? 'Unknown Artist',
      coverArtUrl: c.coverArtUrl,
      duration:    c.duration,
      genres:      genreIds.map(gid => genreMap.get(gid) ?? gid),
      bpm:         c.bpm,
      camelotKey:  c.camelotKey,
      totalPlays:  c.listenCount,
      createdAt:   c.createdAt,
    };
  }

  // ── Cache write ──────────────────────────────────────────────────────────

  async writeCache(
    cacheKey: string,
    userId: string,
    mood: MoodType | null,
    songs: SongRecommendationDto[],
  ): Promise<void> {
    try {
      await this.redis.set(cacheKey, JSON.stringify(songs), 'EX', CACHE_TTL_SECONDS);
    } catch (err) {
      this.logger.warn(`Redis write failed for ${cacheKey}: ${(err as Error).message}`);
    }
    try {
      await this.upsertCacheEntity(userId, mood, songs as unknown as object[]);
    } catch (err) {
      this.logger.error(`DB cache upsert failed user=${userId} mood=${mood}: ${(err as Error).message}`);
    }
  }

  // Handles PostgreSQL NULL ≠ NULL in UNIQUE(userId, mood) via application-level find+save
  private async upsertCacheEntity(
    userId: string,
    mood: MoodType | null,
    songs: object[],
  ): Promise<void> {
    const now       = new Date();
    const expiresAt = new Date(now.getTime() + CACHE_TTL_SECONDS * 1000);

    const existing = await this.recCacheRepo.findOne({
      where: mood === null ? { userId, mood: IsNull() } : { userId, mood },
    });
    if (existing) {
      await this.recCacheRepo.update(existing.id, { songs, computedAt: now, expiresAt });
    } else {
      await this.recCacheRepo.save(
        this.recCacheRepo.create({ userId, mood: mood ?? null, songs, computedAt: now, expiresAt }),
      );
    }
  }

  // ── Batch compute (called by RecommendationBatchWorker) ──────────────────

  async batchComputeForUser(userId: string): Promise<void> {
    const generalSongs = await this.computeGeneralRecs(userId, MAX_CANDIDATES, '30d', {});
    await this.writeCache(`rec:user:${userId}:general`, userId, null, generalSongs);

    const existingMoodRows = await this.recCacheRepo
      .createQueryBuilder('rc')
      .select('rc.mood', 'mood')
      .where('rc.userId = :userId AND rc.mood IS NOT NULL', { userId })
      .getRawMany<{ mood: string }>();

    for (const { mood } of existingMoodRows) {
      try {
        const moodSongs = await this.computeMoodRecs(userId, mood as MoodType, MAX_CANDIDATES, '30d', {});
        await this.writeCache(`rec:user:${userId}:mood:${mood}`, userId, mood as MoodType, moodSongs);
      } catch (err) {
        this.logger.error(`Batch mood recs failed user=${userId} mood=${mood}: ${(err as Error).message}`);
      }
    }
  }
}
