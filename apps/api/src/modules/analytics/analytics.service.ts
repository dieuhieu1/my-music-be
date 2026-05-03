import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';

import { Song } from '../songs/entities/song.entity';
import { ArtistProfile } from '../auth/entities/artist-profile.entity';
import { StorageService } from '../storage/storage.service';
import { Role, SongStatus } from '../../common/enums';

export interface DailyPlay {
  date: string;
  count: number;
}

export interface TopSong {
  songId: string;
  title: string;
  coverArtUrl: string | null;
  plays: number;
  likes: number;
}

@Injectable()
export class AnalyticsService {
  constructor(
    @InjectRepository(Song) private readonly songs: Repository<Song>,
    @InjectRepository(ArtistProfile) private readonly artistProfiles: Repository<ArtistProfile>,
    private readonly dataSource: DataSource,
    private readonly storage: StorageService,
  ) {}

  // ── GET /artist/analytics/overview (BL-51) ───────────────────────────────────

  async getOverview(currentUserId: string, currentUserRoles: Role[], targetArtistUserId?: string) {
    const artistUserId = this.resolveArtistUserId(currentUserId, currentUserRoles, targetArtistUserId);

    const profile = await this.artistProfiles.findOne({
      where: { userId: artistUserId },
      select: ['followerCount', 'stageName'],
    });
    if (!profile) throw new NotFoundException('Artist profile not found');

    const [totalPlaysRow, totalLikesRow, topSongsRaw] = await Promise.all([
      this.dataSource.query<[{ total: string }]>(
        `SELECT COALESCE(COUNT(ph.id), 0)::int AS total
         FROM play_history ph
         JOIN songs s ON s.id = ph.song_id
         WHERE s.user_id = $1`,
        [artistUserId],
      ),

      this.dataSource.query<[{ total: string }]>(
        `SELECT COALESCE(COUNT(ps.song_id), 0)::int AS total
         FROM playlist_songs ps
         JOIN playlists p ON ps.playlist_id = p.id
         JOIN songs s     ON ps.song_id      = s.id
         WHERE s.user_id = $1 AND p.is_liked_songs = true`,
        [artistUserId],
      ),

      // Top 5 songs by plays in the last 30 days, with like counts
      this.dataSource.query<{
        id: string;
        title: string;
        cover_art_url: string | null;
        plays: string;
        likes: string;
      }[]>(
        `SELECT s.id,
                s.title,
                s.cover_art_url,
                COALESCE(COUNT(DISTINCT ph.id), 0)::int AS plays,
                COALESCE(
                  (SELECT COUNT(ps2.song_id)
                   FROM playlist_songs ps2
                   JOIN playlists p2 ON ps2.playlist_id = p2.id
                   WHERE ps2.song_id = s.id AND p2.is_liked_songs = true
                  ), 0
                )::int AS likes
         FROM songs s
         LEFT JOIN play_history ph
           ON ph.song_id = s.id
          AND ph.played_at >= NOW() - INTERVAL '30 days'
         WHERE s.user_id = $1 AND s.status = $2
         GROUP BY s.id, s.title, s.cover_art_url
         ORDER BY plays DESC
         LIMIT 5`,
        [artistUserId, SongStatus.LIVE],
      ),
    ]);

    const topSongs: TopSong[] = topSongsRaw.map((row) => ({
      songId:      row.id,
      title:       row.title,
      coverArtUrl: row.cover_art_url 
        ? this.storage.getPublicUrl(this.storage.getBuckets().images, row.cover_art_url)
        : null,
      plays:       Number(row.plays),
      likes:       Number(row.likes),
    }));

    return {
      totalPlays:    Number(totalPlaysRow[0]?.total ?? 0),
      totalLikes:    Number(totalLikesRow[0]?.total ?? 0),
      followerCount: profile.followerCount,
      topSongs,
    };
  }

  // ── GET /artist/analytics/:songId (BL-51) ────────────────────────────────────

  async getSongAnalytics(
    currentUserId: string,
    currentUserRoles: Role[],
    songId: string,
  ) {
    const song = await this.songs.findOne({
      where: { id: songId },
      select: ['id', 'title', 'userId', 'status'],
    });
    if (!song) throw new NotFoundException('Song not found');

    // Ownership: ARTIST can only see their own songs
    if (!currentUserRoles.includes(Role.ADMIN) && song.userId !== currentUserId) {
      throw new ForbiddenException('You do not have access to this song analytics');
    }

    const [plays7dRow, plays30dRow, likesRow, dailyPlaysRaw] = await Promise.all([
      this.dataSource.query<[{ count: string }]>(
        `SELECT COUNT(id)::int AS count
         FROM play_history
         WHERE song_id = $1 AND played_at >= NOW() - INTERVAL '7 days'`,
        [songId],
      ),

      this.dataSource.query<[{ count: string }]>(
        `SELECT COUNT(id)::int AS count
         FROM play_history
         WHERE song_id = $1 AND played_at >= NOW() - INTERVAL '30 days'`,
        [songId],
      ),

      this.dataSource.query<[{ count: string }]>(
        `SELECT COALESCE(COUNT(ps.song_id), 0)::int AS count
         FROM playlist_songs ps
         JOIN playlists p ON ps.playlist_id = p.id
         WHERE ps.song_id = $1 AND p.is_liked_songs = true`,
        [songId],
      ),

      // Last 30 days including today, zero-filled via generate_series
      this.dataSource.query<{ date: string; count: string }[]>(
        `SELECT to_char(d.day, 'YYYY-MM-DD') AS date,
                COALESCE(COUNT(ph.id), 0)::int AS count
         FROM generate_series(
           (current_date - INTERVAL '29 days')::date,
           current_date::date,
           '1 day'::interval
         ) AS d(day)
         LEFT JOIN play_history ph
           ON DATE(ph.played_at AT TIME ZONE 'UTC') = d.day
          AND ph.song_id = $1
         GROUP BY d.day
         ORDER BY d.day ASC`,
        [songId],
      ),
    ]);

    const dailyPlays: DailyPlay[] = dailyPlaysRaw.map((row) => ({
      date:  row.date,
      count: Number(row.count),
    }));

    return {
      songId: song.id,
      title:  song.title,
      plays: {
        '7d':  Number(plays7dRow[0]?.count  ?? 0),
        '30d': Number(plays30dRow[0]?.count ?? 0),
      },
      likes:      Number(likesRow[0]?.count ?? 0),
      dailyPlays,
    };
  }

  // ── Private ───────────────────────────────────────────────────────────────────

  private resolveArtistUserId(
    currentUserId: string,
    currentUserRoles: Role[],
    targetArtistUserId?: string,
  ): string {
    if (currentUserRoles.includes(Role.ADMIN) && targetArtistUserId) {
      return targetArtistUserId;
    }
    return currentUserId;
  }
}
