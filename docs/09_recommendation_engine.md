# Recommendation Engine — Implementation Guide
**Next-Song Recommendation using Librosa Audio Features**

---

## 0. How It Works (One Paragraph)

Every song uploaded to the platform is analysed by the Python DSP sidecar (librosa). Three values are extracted and stored in the `songs` table: `bpm`, `camelot_key`, and `energy`. When a song finishes playing, the backend scores every other LIVE song in the catalog against the current song using these three values — songs that are harmonically compatible, have a similar tempo, and similar energy level score lower (lower = better). The lowest-scoring song that the user has not recently played or heard is returned as the next recommendation. No model training, no external API, no embeddings.

---

## 1. Data Available (No New Tables Required for Tier 1)

### 1.1 Fields already in `songs` table

```
songs
├── id               uuid
├── title            text
├── status           SongStatus      ← only LIVE songs are candidates
├── bpm              integer | null  ← extracted by librosa beat_track()
├── camelot_key      varchar | null  ← extracted by librosa chroma_cqt() + mapping
├── energy           integer | null  ← 0–100, extracted by librosa RMS + spectral centroid
└── listener         integer         ← all-time play count, used as tiebreaker
```

> `bpm`, `camelot_key`, `energy` are `null` only when DSP extraction failed. Those songs are excluded from candidate pool automatically.

### 1.2 Related tables used

```
song_genres        (song_id, genre_id)   ← genre matching
liked_songs        (user_id, song_id)    ← build user taste profile
song_daily_stats   (user_id, song_id, date, play_count)  ← Layer 1 deduplication
```

### 1.3 Redis keys (new — created by this feature)

```
Key                               Type    TTL     Purpose
──────────────────────────────────────────────────────────────────────
session:{userId}:played           SET     2 h     All songs played this session (Layer 2)
session:{userId}:recs             LIST    2 h     Last 20 recommended song IDs (Layer 3)
decay:{userId}:{songId}           STRING  7 d     How many times this song was recommended (Layer 4)
profile:{userId}:genres           STRING  24 h    User's top 3 genre IDs (cached)
```

---

## 2. Audio Distance Function

Two songs are "similar" if their musical characteristics are close. We measure distance on three axes and combine them into a single score.

### 2.1 BPM Distance

```typescript
// Normalised over an assumed maximum tempo difference of 140 BPM (range 60–200)
// Result: 0.0 = identical tempo  |  1.0 = maximum difference

function bpmDistance(bpmA: number, bpmB: number): number {
  return Math.abs(bpmA - bpmB) / 140;
}

// Examples:
// bpmDistance(120, 118) = 0.014  ← very similar
// bpmDistance(120, 85)  = 0.25   ← noticeable difference
// bpmDistance(60, 200)  = 1.0    ← maximum difference
```

### 2.2 Camelot Key Distance

The Camelot Wheel is a circular clock-face with 24 positions (1A–12A minor keys, 1B–12B major keys). Songs that are adjacent on the wheel mix harmonically without clashing.

```
         12B  1B
      11B        2B
    10B            3B
    10A            3A
      11A        4A
         12A  1A
              │
             5A ── 5B
            6A    6B
           7A      7B
          8A        8B
           9A      9B
```

```typescript
// Returns 0 (compatible), 0.5 (close), or 1 (incompatible)

function camelotDistance(keyA: string, keyB: string): number {
  if (!keyA || !keyB) return 0.5;    // missing data → treat as neutral
  if (keyA === keyB)  return 0;      // perfect match

  const numA    = parseInt(keyA);
  const numB    = parseInt(keyB);
  const letterA = keyA.slice(-1);    // "A" or "B"
  const letterB = keyB.slice(-1);

  // Same number, different letter = relative major/minor (e.g. 8A ↔ 8B)
  if (numA === numB) return 0;

  // One step around the wheel, same letter (e.g. 8A ↔ 9A or 8A ↔ 7A)
  const diff = Math.abs(numA - numB);
  const isAdjacent = diff === 1 || diff === 11;  // 11 = wrap-around (12↔1)

  if (isAdjacent && letterA === letterB) return 0;    // fully compatible
  if (isAdjacent && letterA !== letterB) return 0.5;  // close but not ideal

  return 1;   // harmonically distant — avoid unless no other options
}
```

### 2.3 Full Camelot Wheel Adjacency Reference

```
Key    Note    Adjacent keys (all score 0)
─────────────────────────────────────────────────────
1A     Abm     12A  2A  1B
1B     B       12B  2B  1A
2A     Ebm     1A   3A  2B
2B     F#      1B   3B  2A
3A     Bbm     2A   4A  3B
3B     Db      2B   4B  3A
4A     Fm      3A   5A  4B
4B     Ab      3B   5B  4A
5A     Cm      4A   6A  5B
5B     Eb      4B   6B  5A
6A     Gm      5A   7A  6B
6B     Bb      5B   7B  6A
7A     Dm      6A   8A  7B
7B     F       6B   8B  7A
8A     Am      7A   9A  8B
8B     C       7B   9B  8A
9A     Em      8A  10A  9B
9B     G       8B  10B  9A
10A    Bm      9A  11A  10B
10B    D       9B  11B  10A
11A    F#m    10A  12A  11B
11B    A      10B  12B  11A
12A    Dbm    11A   1A  12B
12B    E      11B   1B  12A
```

### 2.4 Energy Distance

```typescript
// Normalised over range 0–100
// Result: 0.0 = identical energy  |  1.0 = maximum difference

function energyDistance(energyA: number, energyB: number): number {
  return Math.abs(energyA - energyB) / 100;
}
```

### 2.5 Combined Audio Distance

```typescript
// src/modules/recommendations/audio-distance.ts

export function audioDistance(songA: SongFeatures, songB: SongFeatures): number {
  const bpmDist    = bpmDistance(songA.bpm, songB.bpm);
  const keyDist    = camelotDistance(songA.camelotKey, songB.camelotKey);
  const energyDist = energyDistance(songA.energy, songB.energy);

  // Weights: BPM and key are equally important, energy is a secondary factor
  return (0.4 * bpmDist) + (0.4 * keyDist) + (0.2 * energyDist);
}

// Range: 0.0 (perfect match) → 1.0 (completely incompatible)
// Example:
//   Current song:   bpm=120, key="8A",  energy=65
//   Candidate A:    bpm=118, key="8A",  energy=63  → distance ≈ 0.014 (very close)
//   Candidate B:    bpm=85,  key="3B",  energy=30  → distance ≈ 0.66  (poor match)
```

---

## 3. Scoring Function

Audio distance is the base. Three adjustments are layered on top:

```typescript
// src/modules/recommendations/next-song.service.ts

private scoreCandidate(
  candidate: Song,
  current:   Song,
  userProfile: UserTasteProfile,
  decayCounts: Map<string, number>,
): number {

  // ── Base: audio similarity (lower = more similar) ──────────────────────
  const baseDist = audioDistance(current, candidate);

  // ── Adjustment 1: Genre preference bonus ───────────────────────────────
  // Subtract from score if candidate is in user's top 3 genres
  const hasPreferredGenre = candidate.genres.some(g =>
    userProfile.topGenreIds.includes(g.id)
  );
  const genreBonus = hasPreferredGenre ? 0.15 : 0;

  // ── Adjustment 2: Decay penalty ────────────────────────────────────────
  // Each prior recommendation this week adds 0.05 penalty (max 0.30)
  // Prevents the same song from always winning
  const decayCount   = decayCounts.get(candidate.id) ?? 0;
  const decayPenalty = Math.min(decayCount * 0.05, 0.30);

  // ── Adjustment 3: Popularity tiebreaker ────────────────────────────────
  // log-normalised so mega-hits don't always dominate
  const popularityBonus = Math.log10(candidate.listener + 1) / 100;

  const finalScore = baseDist - genreBonus + decayPenalty - popularityBonus;

  return finalScore;
}

// Score range: roughly -0.25 (perfect popular genre match) to 1.30 (incompatible + high decay)
// Sort ascending. Pick randomly from top 5 to add variety.
```

### Score interpretation

```
Score   Meaning
──────────────────────────────────────────────────────────────
< 0.10  Excellent match — same key, close BPM, user's genre
0.10 – 0.30  Good match
0.30 – 0.60  Acceptable — similar energy or genre but different tempo/key
> 0.60  Poor match — only returned when catalog is exhausted
```

---

## 4. User Taste Profile

Built from liked songs. Cached in Redis for 24 h to avoid re-querying on every request.

```typescript
interface UserTasteProfile {
  topGenreIds: string[];   // top 3 genres by liked-song count
  avgBpm:      number;     // average BPM of liked songs (informational, not used in score)
  avgEnergy:   number;     // average energy of liked songs (informational)
}
```

```typescript
private async buildUserProfile(userId: string): Promise<UserTasteProfile> {
  const cacheKey = `profile:${userId}:genres`;
  const cached   = await this.redis.get(cacheKey);
  if (cached) return JSON.parse(cached);

  const rows = await this.dataSource.query(`
    SELECT
      sg.genre_id,
      COUNT(*)        AS like_count,
      AVG(s.bpm)      AS avg_bpm,
      AVG(s.energy)   AS avg_energy
    FROM liked_songs ls
    JOIN songs s       ON s.id  = ls.song_id
    JOIN song_genres sg ON sg.song_id = ls.song_id
    WHERE ls.user_id = $1
      AND s.bpm IS NOT NULL
    GROUP BY sg.genre_id
    ORDER BY like_count DESC
    LIMIT 3
  `, [userId]);

  const profile: UserTasteProfile = {
    topGenreIds: rows.map(r => r.genre_id),
    avgBpm:      rows[0]?.avg_bpm ?? 100,
    avgEnergy:   rows[0]?.avg_energy ?? 50,
  };

  await this.redis.set(cacheKey, JSON.stringify(profile), 'EX', 86400);  // 24h cache
  return profile;
}
```

**Cold start (new user, 0 likes):** `topGenreIds = []`. Genre bonus never fires. System falls back to pure audio distance from current song — still works perfectly.

---

## 5. Deduplication System (4 Layers)

Each layer catches a different type of repetition.

```
Request: GET /songs/:songId/next
              │
    ┌─────────▼────────────────────────────────────────────────────────┐
    │ Layer 1 — DB cooldown                                            │
    │ SELECT DISTINCT song_id FROM song_daily_stats                    │
    │ WHERE user_id=$1 AND date >= NOW() - INTERVAL '7 days'           │
    │ → excludes anything played in the last week                      │
    │ Problem solved: re-recommending songs played earlier this week   │
    └─────────┬────────────────────────────────────────────────────────┘
              │
    ┌─────────▼────────────────────────────────────────────────────────┐
    │ Layer 2 — Session played set (Redis SET, TTL 2h)                 │
    │ SMEMBERS session:{userId}:played                                 │
    │ → excludes every song played since the session started           │
    │ Problem solved: recommending a song the user literally just      │
    │                 played 10 minutes ago in the same session        │
    └─────────┬────────────────────────────────────────────────────────┘
              │
    ┌─────────▼────────────────────────────────────────────────────────┐
    │ Layer 3 — Recent recommendations window (Redis LIST, TTL 2h)     │
    │ LRANGE session:{userId}:recs 0 -1  (max 20 items)                │
    │ → excludes songs we already recommended this session             │
    │ Problem solved: PING-PONG (A→B→A→B) where A and B are each      │
    │                 other's nearest neighbour                        │
    └─────────┬────────────────────────────────────────────────────────┘
              │
    ┌─────────▼────────────────────────────────────────────────────────┐
    │ Layer 4 — Decay penalty (Redis STRING, TTL 7d)                   │
    │ GET decay:{userId}:{songId}  → count of past recommendations     │
    │ → adds score penalty per prior recommendation (not an exclusion) │
    │ Problem solved: CATALOG MAGNET where one song is everyone's      │
    │                 nearest neighbour and always wins the scoring     │
    └─────────┬────────────────────────────────────────────────────────┘
              │
              ▼
         Score + pick top 5 → random(top5)
```

### 5.1 Layer implementations

```typescript
// ── Layer 1: DB cooldown ─────────────────────────────────────────────────

private async getDbCooldownIds(userId: string): Promise<Set<string>> {
  const rows = await this.dataSource.query(`
    SELECT DISTINCT song_id
    FROM song_daily_stats
    WHERE user_id = $1
      AND date >= NOW() - INTERVAL '7 days'
  `, [userId]);
  return new Set(rows.map((r: any) => r.song_id));
}

// ── Layer 2: Session played set ──────────────────────────────────────────

async recordSongPlayed(userId: string, songId: string): Promise<void> {
  const key = `session:${userId}:played`;
  await this.redis.sadd(key, songId);
  await this.redis.expire(key, 7200);    // 2-hour session window
}

private async getSessionPlayedIds(userId: string): Promise<Set<string>> {
  const members = await this.redis.smembers(`session:${userId}:played`);
  return new Set(members);
}

// ── Layer 3: Recent recommendation window ────────────────────────────────

private async recordRecommendation(userId: string, songId: string): Promise<void> {
  const key = `session:${userId}:recs`;
  await this.redis.lpush(key, songId);   // newest first
  await this.redis.ltrim(key, 0, 19);   // keep only last 20
  await this.redis.expire(key, 7200);
}

private async getRecentlyRecommendedIds(userId: string): Promise<Set<string>> {
  const members = await this.redis.lrange(`session:${userId}:recs`, 0, -1);
  return new Set(members);
}

// ── Layer 4: Decay counters ───────────────────────────────────────────────

async incrementDecay(userId: string, songId: string): Promise<void> {
  const key = `decay:${userId}:${songId}`;
  await this.redis.incr(key);
  await this.redis.expire(key, 604800);  // 7-day TTL — resets weekly
}

private async getDecayCounts(
  userId:  string,
  songIds: string[],
): Promise<Map<string, number>> {
  if (songIds.length === 0) return new Map();

  const pipeline = this.redis.pipeline();
  songIds.forEach(id => pipeline.get(`decay:${userId}:${id}`));
  const results  = await pipeline.exec();

  return new Map(
    songIds.map((id, i) => [id, parseInt((results[i][1] as string) ?? '0') || 0])
  );
}
```

---

## 6. Catalog Exhaustion Fallback

When the exclusion set is too large (small catalog or niche genre), the system relaxes constraints progressively.

```typescript
private async getCandidatesWithFallback(
  userId:          string,
  currentSongId:   string,
  allLiveSongs:    Song[],
  sessionPlayedIds: Set<string>,
  fullExcludeIds:  Set<string>,
): Promise<{ songs: Song[]; tier: string }> {

  // Tier 1: strictest — all 4 layers active
  let pool = allLiveSongs.filter(s => !fullExcludeIds.has(s.id));
  if (pool.length >= 5) return { songs: pool, tier: 'FULL' };

  // Tier 2: drop DB 7-day cooldown (Layer 1), keep session + recs
  const sessionOnlyExclude = new Set([
    currentSongId,
    ...sessionPlayedIds,
    ...await this.getRecentlyRecommendedIds(userId),
  ]);
  pool = allLiveSongs.filter(s => !sessionOnlyExclude.has(s.id));
  if (pool.length >= 5) return { songs: pool, tier: 'SESSION_ONLY' };

  // Tier 3: only exclude what was played THIS session (Layer 2 only)
  pool = allLiveSongs.filter(s =>
    s.id !== currentSongId && !sessionPlayedIds.has(s.id)
  );
  if (pool.length >= 3) return { songs: pool, tier: 'NO_REPEAT_SESSION' };

  // Tier 4 (last resort): literally any LIVE song except current
  pool = allLiveSongs.filter(s => s.id !== currentSongId);
  return { songs: pool, tier: 'LAST_RESORT' };
}
```

---

## 7. Complete NestJS Service

### 7.1 Module file

```typescript
// src/modules/recommendations/recommendations.module.ts

@Module({
  imports: [
    TypeOrmModule.forFeature([Song, LikedSong, SongDailyStats]),
    BullModule.registerQueue({ name: 'recommendations' }),
  ],
  providers: [NextSongService, RecommendationsBatchService],
  exports: [NextSongService],
})
export class RecommendationsModule {}
```

### 7.2 Types

```typescript
// src/modules/recommendations/types.ts

export interface SongFeatures {
  id:          string;
  bpm:         number;
  camelotKey:  string;
  energy:      number;
  listener:    number;
  genres:      { id: string }[];
}

export interface UserTasteProfile {
  topGenreIds: string[];
  avgBpm:      number;
  avgEnergy:   number;
}

export interface NextSongResult {
  song:       Song;
  score:      number;
  matchedOn:  {
    bpm:        boolean;
    camelotKey: boolean;
    energy:     boolean;
    genre:      boolean;
  };
  fallbackTier: string;
}
```

### 7.3 NextSongService (full)

```typescript
// src/modules/recommendations/next-song.service.ts

@Injectable()
export class NextSongService {

  constructor(
    @InjectRepository(Song)
    private readonly songsRepo: Repository<Song>,
    @InjectDataSource()
    private readonly dataSource: DataSource,
    @Inject(REDIS_CLIENT)
    private readonly redis: Redis,
  ) {}

  // ── Main entry point ─────────────────────────────────────────────────────

  async getNextSong(currentSongId: string, userId: string): Promise<NextSongResult> {
    // 1. Load current song (must have librosa features)
    const currentSong = await this.songsRepo.findOne({
      where: { id: currentSongId },
      relations: ['genres'],
    });

    if (!currentSong) {
      throw new NotFoundException('SONG_NOT_FOUND');
    }

    if (!currentSong.bpm || !currentSong.camelotKey || !currentSong.energy) {
      throw new UnprocessableEntityException('NO_AUDIO_FEATURES');
    }

    // 2. Load all data in parallel
    const [
      userProfile,
      dbCooldownIds,
      sessionPlayedIds,
      recentlyRecommendedIds,
    ] = await Promise.all([
      this.buildUserProfile(userId),
      this.getDbCooldownIds(userId),
      this.getSessionPlayedIds(userId),
      this.getRecentlyRecommendedIds(userId),
    ]);

    // 3. Build full exclusion set
    const fullExcludeIds = new Set([
      currentSongId,
      ...dbCooldownIds,
      ...sessionPlayedIds,
      ...recentlyRecommendedIds,
    ]);

    // 4. Fetch all LIVE songs with librosa data
    const allLive = await this.songsRepo.find({
      where: {
        status: SongStatus.LIVE,
        bpm:         Not(IsNull()),
        camelotKey:  Not(IsNull()),
        energy:      Not(IsNull()),
      },
      relations: ['genres'],
    });

    if (allLive.length === 0) {
      throw new NotFoundException('NO_CANDIDATES');
    }

    // 5. Apply fallback-aware filtering
    const { songs: candidates, tier } = await this.getCandidatesWithFallback(
      userId, currentSongId, allLive, sessionPlayedIds, fullExcludeIds,
    );

    // 6. Get decay counts for all candidates
    const decayCounts = await this.getDecayCounts(userId, candidates.map(c => c.id));

    // 7. Score all candidates
    const scored = candidates.map(candidate => ({
      song:  candidate,
      score: this.scoreCandidate(candidate, currentSong, userProfile, decayCounts),
    }));

    scored.sort((a, b) => a.score - b.score);    // ascending

    // 8. Pick randomly from top 5 (prevents ping-pong)
    const pool = scored.slice(0, Math.min(5, scored.length));
    const pick = pool[Math.floor(Math.random() * pool.length)];

    // 9. Update deduplication state
    await this.recordRecommendation(userId, pick.song.id);
    await this.incrementDecay(userId, pick.song.id);

    // 10. Build debug info (remove matchedOn in production)
    return {
      song:  pick.song,
      score: Math.round(pick.score * 100) / 100,
      matchedOn: {
        bpm:        bpmDistance(currentSong.bpm, pick.song.bpm) < 0.15,
        camelotKey: camelotDistance(currentSong.camelotKey, pick.song.camelotKey) === 0,
        energy:     energyDistance(currentSong.energy, pick.song.energy) < 0.20,
        genre:      pick.song.genres.some(g => userProfile.topGenreIds.includes(g.id)),
      },
      fallbackTier: tier,
    };
  }

  // ── Record that a song was played (called from PlaybackService) ──────────

  async recordSongPlayed(userId: string, songId: string): Promise<void> {
    const key = `session:${userId}:played`;
    await this.redis.sadd(key, songId);
    await this.redis.expire(key, 7200);
  }

  // ── Private helpers ──────────────────────────────────────────────────────

  private scoreCandidate(
    candidate:   Song,
    current:     Song,
    profile:     UserTasteProfile,
    decayCounts: Map<string, number>,
  ): number {
    const baseDist      = audioDistance(current, candidate);
    const genreBonus    = candidate.genres.some(g => profile.topGenreIds.includes(g.id)) ? 0.15 : 0;
    const decayPenalty  = Math.min((decayCounts.get(candidate.id) ?? 0) * 0.05, 0.30);
    const popBonus      = Math.log10(candidate.listener + 1) / 100;
    return baseDist - genreBonus + decayPenalty - popBonus;
  }

  private async buildUserProfile(userId: string): Promise<UserTasteProfile> {
    const cacheKey = `profile:${userId}:genres`;
    const cached   = await this.redis.get(cacheKey);
    if (cached) return JSON.parse(cached);

    const rows = await this.dataSource.query(`
      SELECT sg.genre_id, COUNT(*) AS cnt
      FROM liked_songs ls
      JOIN song_genres sg ON sg.song_id = ls.song_id
      JOIN songs s        ON s.id       = ls.song_id
      WHERE ls.user_id = $1 AND s.bpm IS NOT NULL
      GROUP BY sg.genre_id
      ORDER BY cnt DESC
      LIMIT 3
    `, [userId]);

    const profile: UserTasteProfile = {
      topGenreIds: rows.map((r: any) => r.genre_id),
      avgBpm:      100,
      avgEnergy:   50,
    };

    await this.redis.set(cacheKey, JSON.stringify(profile), 'EX', 86400);
    return profile;
  }

  private async getDbCooldownIds(userId: string): Promise<Set<string>> {
    const rows = await this.dataSource.query(`
      SELECT DISTINCT song_id FROM song_daily_stats
      WHERE user_id = $1 AND date >= NOW() - INTERVAL '7 days'
    `, [userId]);
    return new Set(rows.map((r: any) => r.song_id));
  }

  private async getSessionPlayedIds(userId: string): Promise<Set<string>> {
    return new Set(await this.redis.smembers(`session:${userId}:played`));
  }

  private async getRecentlyRecommendedIds(userId: string): Promise<Set<string>> {
    return new Set(await this.redis.lrange(`session:${userId}:recs`, 0, -1));
  }

  private async recordRecommendation(userId: string, songId: string): Promise<void> {
    const key = `session:${userId}:recs`;
    await this.redis.lpush(key, songId);
    await this.redis.ltrim(key, 0, 19);
    await this.redis.expire(key, 7200);
  }

  private async incrementDecay(userId: string, songId: string): Promise<void> {
    const key = `decay:${userId}:${songId}`;
    await this.redis.incr(key);
    await this.redis.expire(key, 604800);
  }

  private async getDecayCounts(userId: string, ids: string[]): Promise<Map<string, number>> {
    if (ids.length === 0) return new Map();
    const pipeline = this.redis.pipeline();
    ids.forEach(id => pipeline.get(`decay:${userId}:${id}`));
    const results = await pipeline.exec();
    return new Map(ids.map((id, i) => [id, parseInt((results[i][1] as string) ?? '0') || 0]));
  }

  private async getCandidatesWithFallback(
    userId:           string,
    currentSongId:    string,
    allLive:          Song[],
    sessionPlayedIds: Set<string>,
    fullExcludeIds:   Set<string>,
  ): Promise<{ songs: Song[]; tier: string }> {
    let pool = allLive.filter(s => !fullExcludeIds.has(s.id));
    if (pool.length >= 5) return { songs: pool, tier: 'FULL' };

    const sessionOnlyExclude = new Set([
      currentSongId,
      ...sessionPlayedIds,
      ...await this.getRecentlyRecommendedIds(userId),
    ]);
    pool = allLive.filter(s => !sessionOnlyExclude.has(s.id));
    if (pool.length >= 5) return { songs: pool, tier: 'SESSION_ONLY' };

    pool = allLive.filter(s => s.id !== currentSongId && !sessionPlayedIds.has(s.id));
    if (pool.length >= 3) return { songs: pool, tier: 'NO_REPEAT_SESSION' };

    pool = allLive.filter(s => s.id !== currentSongId);
    return { songs: pool, tier: 'LAST_RESORT' };
  }
}
```

---

## 8. Controller

```typescript
// src/modules/recommendations/recommendations.controller.ts

@Controller('songs')
@UseGuards(JwtAuthGuard, EmailVerifiedGuard)
export class NextSongController {

  constructor(private readonly nextSongService: NextSongService) {}

  // GET /songs/:songId/next
  @Get(':songId/next')
  async getNextSong(
    @Param('songId') songId: string,
    @CurrentUser() user: User,
  ) {
    return this.nextSongService.getNextSong(songId, user.id);
  }

  // POST /songs/:songId/played
  @Post(':songId/played')
  async recordPlayed(
    @Param('songId') songId: string,
    @CurrentUser() user: User,
  ) {
    await this.nextSongService.recordSongPlayed(user.id, songId);
    return { recorded: true };
  }
}
```

---

## 9. Integration with PlaybackService

`recordSongPlayed` must be called whenever a song actually starts playing — not just when recommended.

```typescript
// src/modules/playback/playback.service.ts

async updateState(userId: string, dto: UpdatePlaybackStateDto): Promise<void> {
  const prev = await this.getPlaybackState(userId);

  // Song changed (user skipped, auto-played, or manually picked)
  if (dto.songId && dto.songId !== prev?.currentSongId) {
    // Record as played for deduplication (fire-and-forget, don't await)
    this.nextSongService.recordSongPlayed(userId, dto.songId).catch(() => {});
  }

  await this.persistPlaybackState(userId, dto);
}
```

---

## 10. Frontend Integration

```typescript
// FE pseudo-code — what happens when a song ends

async function onSongEnd(currentSongId: string) {
  // 1. Ask backend for next song
  const { data } = await api.get(`/songs/${currentSongId}/next`);
  const nextSong = data.song;

  // 2. Load and play
  player.load(nextSong.id);
  player.play();

  // 3. Tell backend this song started playing (updates deduplication state)
  await api.post(`/songs/${nextSong.id}/played`);

  // 4. Update queue display
  queueStore.setCurrentSong(nextSong);
}
```

---

## 11. Edge Cases

| Case | Behaviour |
|---|---|
| Current song has `bpm=null` | Returns `NO_AUDIO_FEATURES 422`. FE falls back to `GET /recommendations` (genre-based list). |
| New user, 0 liked songs | `topGenreIds=[]` → genre bonus never fires → pure audio distance from current song → still works. |
| User only likes 1 genre with 5 songs | Catalog exhaustion → relaxes to session-only exclusion → songs from 3–4 days ago become eligible again. |
| All songs in catalog have been played this session | `LAST_RESORT` tier → picks least-decayed LIVE song except current. |
| Two songs are mutual nearest neighbours (ping-pong) | Layer 3 (rec window of 20) breaks the loop — song B is in `session:recs` after it was recommended once, so it won't be recommended again for 20 more songs. |
| Song deleted mid-session | `LIVE` status filter in query excludes it automatically. |
| DSP extraction failed for many songs | `bpm IS NOT NULL` filter reduces candidate pool. Falls back to genre-based if pool < 3. |

---

## 12. Full Request/Response Flow

```
FE: current song "Midnight Rain" (bpm=85, key=9A, energy=60) ends
           │
           ▼
GET /songs/{id}/next
           │
           ▼
NextSongService.getNextSong("midnight-rain-id", "user-123")
           │
           ├── Redis SMEMBERS session:user-123:played     → {song_A, song_B}
           ├── Redis LRANGE   session:user-123:recs 0 -1  → [song_C, song_D, ...]
           ├── SQL            song_daily_stats 7d          → {song_E, song_F, ...}
           ├── Redis GET      profile:user-123:genres      → ["lo-fi", "chill"]
           │
           ├── Songs repo: SELECT LIVE WHERE bpm IS NOT NULL → 150 songs
           │   Filter exclusions → 130 candidates remain
           │
           ├── Score all 130:
           │   "Deep Flow" bpm=83 key=9A energy=58 genre=lo-fi → 0.06  ← winner
           │   "Alpha Waves" bpm=72 key=6A energy=40           → 0.44
           │   ...
           │
           ├── Top 5: [Deep Flow, Still Water, Morning Haze, Fog Drift, Calm Storm]
           ├── Random pick: "Deep Flow"
           │
           ├── Redis LPUSH session:user-123:recs "deep-flow-id"
           ├── Redis LTRIM  session:user-123:recs 0 19
           ├── Redis INCR   decay:user-123:deep-flow-id
           │
           ▼
{
  "success": true,
  "data": {
    "song": { "id": "deep-flow-id", "title": "Deep Flow", "bpm": 83, ... },
    "score": 0.06,
    "matchedOn": { "bpm": true, "camelotKey": true, "energy": true, "genre": true }
  }
}
           │
           ▼
FE: plays "Deep Flow", calls POST /songs/deep-flow-id/played
           │
           ▼
Redis SADD session:user-123:played "deep-flow-id"
```

---

## 13. Files to Create

```
src/modules/recommendations/
  audio-distance.ts          ← audioDistance(), camelotDistance(), bpmDistance(), energyDistance()
  next-song.service.ts       ← NextSongService (full service above)
  recommendations.controller.ts  ← GET /songs/:id/next + POST /songs/:id/played
  recommendations.module.ts
  types.ts                   ← SongFeatures, UserTasteProfile, NextSongResult
```

```
src/modules/playback/
  playback.service.ts        ← ADD: call nextSongService.recordSongPlayed() on song change
```
