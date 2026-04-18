import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, Repository } from 'typeorm';

import { Playlist } from './entities/playlist.entity';
import { PlaylistSong } from './entities/playlist-song.entity';
import { SavedPlaylist } from './entities/saved-playlist.entity';
import { FeedEvent } from '../feed/entities/feed-event.entity';
import { Song } from '../songs/entities/song.entity';
import { User } from '../auth/entities/user.entity';
import { ArtistProfile } from '../auth/entities/artist-profile.entity';
import { StorageService } from '../storage/storage.service';
import { FeedEventType, SongStatus } from '../../common/enums';
import { CreatePlaylistDto } from './dto/create-playlist.dto';
import { UpdatePlaylistDto } from './dto/update-playlist.dto';
import { AddSongDto } from './dto/add-song.dto';
import { PlaylistQueryDto } from './dto/playlist-query.dto';

@Injectable()
export class PlaylistsService {
  constructor(
    @InjectRepository(Playlist)     private readonly playlists:     Repository<Playlist>,
    @InjectRepository(PlaylistSong) private readonly playlistSongs: Repository<PlaylistSong>,
    @InjectRepository(SavedPlaylist) private readonly savedPlaylists: Repository<SavedPlaylist>,
    @InjectRepository(FeedEvent)    private readonly feedEvents:    Repository<FeedEvent>,
    @InjectRepository(Song)         private readonly songs:         Repository<Song>,
    @InjectRepository(User)         private readonly users:         Repository<User>,
    @InjectRepository(ArtistProfile) private readonly artistProfiles: Repository<ArtistProfile>,
    private readonly storage: StorageService,
    private readonly dataSource: DataSource,
  ) {}

  // ── GET /playlists — own + saved playlists ────────────────────────────────

  async findAll(userId: string, dto: PlaylistQueryDto) {
    const { page = 1, limit = 20 } = dto;
    const skip = (page - 1) * limit;

    // Own playlists (excluding LikedSongs — shown separately via /playlists/liked)
    const [ownItems, ownTotal] = await this.playlists.findAndCount({
      where: { userId, isLikedSongs: false },
      order: { createdAt: 'DESC' },
      skip,
      take: limit,
    });

    const items = ownItems.map((p) => this.buildPlaylistSummary(p));
    return { items, total: ownTotal, page, limit };
  }

  // ── GET /playlists/liked — LikedSongs playlist ────────────────────────────

  async getLikedSongs(userId: string) {
    const playlist = await this.playlists.findOne({
      where: { userId, isLikedSongs: true },
    });

    if (!playlist) {
      // No likes yet — return empty shell
      return {
        id: null,
        title: 'Liked Songs',
        isLikedSongs: true,
        totalTracks: 0,
        totalHours: 0,
        songs: [],
      };
    }

    return this.getPlaylistDetail(playlist.id, userId, false);
  }

  // ── GET /playlists/:id (BL-12: increment listener_count) ─────────────────

  async findById(playlistId: string, requesterId: string) {
    const playlist = await this.playlists.findOne({ where: { id: playlistId } });
    if (!playlist) throw new NotFoundException('Playlist not found');

    // Only owner or public playlists are accessible
    if (!playlist.isPublic && playlist.userId !== requesterId) {
      throw new ForbiddenException('This playlist is private');
    }

    // BL-12: increment listener_count on every GET
    await this.playlists.increment({ id: playlistId }, 'listenerCount', 1);

    return this.getPlaylistDetail(playlistId, requesterId, true);
  }

  // ── POST /playlists (BL-22) ───────────────────────────────────────────────

  async create(userId: string, dto: CreatePlaylistDto) {
    return this.dataSource.transaction(async (manager) => {
      const playlist = manager.create(Playlist, {
        userId,
        title: dto.title,
        description: dto.description ?? null,
        isPublic: dto.isPublic ?? false,
        isLikedSongs: false,
      });
      const saved = await manager.save(Playlist, playlist);

      // BL-33: emit feed event when a public playlist is created
      if (saved.isPublic) {
        await manager.insert(FeedEvent, {
          actorId: userId,
          eventType: FeedEventType.NEW_PLAYLIST,
          entityId: saved.id,
          entityType: 'PLAYLIST',
        });
      }

      return this.buildPlaylistSummary(saved);
    });
  }

  // ── PATCH /playlists/:id ─────────────────────────────────────────────────

  async update(userId: string, playlistId: string, dto: UpdatePlaylistDto) {
    const playlist = await this.findOwnedOrThrow(userId, playlistId);
    if (playlist.isLikedSongs) throw new ForbiddenException('Cannot modify the Liked Songs playlist');

    if (dto.title !== undefined) playlist.title = dto.title;
    if (dto.description !== undefined) playlist.description = dto.description ?? null;
    if (dto.isPublic !== undefined) playlist.isPublic = dto.isPublic;

    const updated = await this.playlists.save(playlist);
    return this.buildPlaylistSummary(updated);
  }

  // ── DELETE /playlists/:id (BL-17) ────────────────────────────────────────

  async remove(userId: string, playlistId: string): Promise<void> {
    const playlist = await this.findOwnedOrThrow(userId, playlistId);
    if (playlist.isLikedSongs) throw new ForbiddenException('Cannot delete the Liked Songs playlist');

    await this.dataSource.transaction(async (manager) => {
      // BL-17: cascade remove playlist_songs and saved_playlists via FK ON DELETE CASCADE
      // (both entities have onDelete: 'CASCADE' on the playlist FK)
      await manager.remove(Playlist, playlist);
    });
  }

  // ── POST /playlists/:id/songs (BL-15) ────────────────────────────────────

  async addSong(userId: string, playlistId: string, dto: AddSongDto) {
    const playlist = await this.findOwnedOrThrow(userId, playlistId);

    const song = await this.songs.findOne({ where: { id: dto.songId } });
    if (!song) throw new NotFoundException('Song not found');
    if (song.status !== SongStatus.LIVE && song.status !== SongStatus.TAKEN_DOWN) {
      throw new BadRequestException('Only LIVE songs can be added to playlists');
    }

    const existing = await this.playlistSongs.findOne({
      where: { playlistId, songId: dto.songId },
    });
    if (existing) throw new ConflictException('Song already in playlist');

    await this.dataSource.transaction(async (manager) => {
      type MaxRow = { max: number | null };
      const [{ max }] = await manager.query<MaxRow[]>(
        'SELECT MAX(position) AS max FROM playlist_songs WHERE playlist_id = $1',
        [playlistId],
      );
      await manager.insert(PlaylistSong, {
        playlistId,
        songId: dto.songId,
        position: (max ?? -1) + 1,
      });
      await this.recomputeStats(manager, playlistId);
    });

    return this.buildPlaylistSummary(
      (await this.playlists.findOne({ where: { id: playlistId } }))!,
    );
  }

  // ── DELETE /playlists/:id/songs/:songId (BL-15) ───────────────────────────

  async removeSong(userId: string, playlistId: string, songId: string): Promise<void> {
    await this.findOwnedOrThrow(userId, playlistId);

    const link = await this.playlistSongs.findOne({ where: { playlistId, songId } });
    if (!link) throw new NotFoundException('Song not in playlist');

    await this.dataSource.transaction(async (manager) => {
      await manager.remove(PlaylistSong, link);
      await this.recomputeStats(manager, playlistId);
    });
  }

  // ── POST /playlists/:id/save (BL-13) ─────────────────────────────────────

  async savePlaylist(userId: string, playlistId: string) {
    const playlist = await this.playlists.findOne({ where: { id: playlistId } });
    if (!playlist) throw new NotFoundException('Playlist not found');
    if (!playlist.isPublic) throw new ForbiddenException('Cannot save a private playlist');
    if (playlist.userId === userId) throw new BadRequestException('Cannot save your own playlist');

    const existing = await this.savedPlaylists.findOne({ where: { userId, playlistId } });
    if (existing) throw new ConflictException('Playlist already saved');

    await this.dataSource.transaction(async (manager) => {
      await manager.insert(SavedPlaylist, { userId, playlistId });
      // BL-13: listener_count is incremented on save (view-count proxy)
      await manager.increment(Playlist, { id: playlistId }, 'listenerCount', 1);
    });

    return { playlistId, saved: true };
  }

  // ── DELETE /playlists/:id/save ────────────────────────────────────────────

  async unsavePlaylist(userId: string, playlistId: string): Promise<void> {
    const link = await this.savedPlaylists.findOne({ where: { userId, playlistId } });
    if (!link) throw new NotFoundException('Playlist not in saved list');
    await this.savedPlaylists.remove(link);
  }

  // ── GET /playlists/saved ──────────────────────────────────────────────────

  async getSavedPlaylists(userId: string, dto: PlaylistQueryDto) {
    const { page = 1, limit = 20 } = dto;
    const [saved, total] = await this.savedPlaylists.findAndCount({
      where: { userId },
      relations: ['playlist'],
      order: { savedAt: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });

    const items = saved
      .filter((s) => s.playlist)
      .map((s) => this.buildPlaylistSummary(s.playlist));

    return { items, total, page, limit };
  }

  // ── POST /songs/:id/like (BL-34) ─────────────────────────────────────────

  async likeSong(userId: string, songId: string) {
    const song = await this.songs.findOne({ where: { id: songId } });
    if (!song) throw new NotFoundException('Song not found');
    if (song.status !== SongStatus.LIVE) {
      throw new BadRequestException('Only LIVE songs can be liked');
    }

    await this.dataSource.transaction(async (manager) => {
      // BL-34: Auto-create LikedSongs playlist on first like
      let likedPlaylist = await manager.findOne(Playlist, {
        where: { userId, isLikedSongs: true },
      });

      if (!likedPlaylist) {
        likedPlaylist = manager.create(Playlist, {
          userId,
          title: 'Liked Songs',
          isPublic: false,
          isLikedSongs: true,
        });
        likedPlaylist = await manager.save(Playlist, likedPlaylist);
      }

      const existing = await manager.findOne(PlaylistSong, {
        where: { playlistId: likedPlaylist.id, songId },
      });
      if (existing) throw new ConflictException('Song already liked');

      type MaxRow = { max: number | null };
      const [{ max }] = await manager.query<MaxRow[]>(
        'SELECT MAX(position) AS max FROM playlist_songs WHERE playlist_id = $1',
        [likedPlaylist.id],
      );
      await manager.insert(PlaylistSong, {
        playlistId: likedPlaylist.id,
        songId,
        position: (max ?? -1) + 1,
      });
      await this.recomputeStats(manager, likedPlaylist.id);

      // BL-33: emit SONG_LIKED feed event
      await manager.insert(FeedEvent, {
        actorId: userId,
        eventType: FeedEventType.SONG_LIKED,
        entityId: songId,
        entityType: 'SONG',
      });
    });

    return { songId, isLiked: true };
  }

  // ── DELETE /songs/:id/like (BL-34) ───────────────────────────────────────

  async unlikeSong(userId: string, songId: string): Promise<void> {
    const likedPlaylist = await this.playlists.findOne({
      where: { userId, isLikedSongs: true },
    });
    if (!likedPlaylist) throw new NotFoundException('No liked songs yet');

    const link = await this.playlistSongs.findOne({
      where: { playlistId: likedPlaylist.id, songId },
    });
    if (!link) throw new NotFoundException('Song not liked');

    await this.dataSource.transaction(async (manager) => {
      await manager.remove(PlaylistSong, link);
      await this.recomputeStats(manager, likedPlaylist.id);
    });
  }

  // ── Check if a song is liked by a user ───────────────────────────────────

  async isLiked(userId: string, songId: string): Promise<boolean> {
    const likedPlaylist = await this.playlists.findOne({
      where: { userId, isLikedSongs: true },
    });
    if (!likedPlaylist) return false;
    return this.playlistSongs.existsBy({ playlistId: likedPlaylist.id, songId });
  }

  // ── Private helpers ───────────────────────────────────────────────────────

  private async findOwnedOrThrow(userId: string, playlistId: string): Promise<Playlist> {
    const playlist = await this.playlists.findOne({ where: { id: playlistId } });
    if (!playlist) throw new NotFoundException('Playlist not found');
    if (playlist.userId !== userId) throw new ForbiddenException('Not your playlist');
    return playlist;
  }

  // BL-15: recompute totalTracks + totalHours from current playlist_songs rows
  private async recomputeStats(manager: EntityManager, playlistId: string): Promise<void> {
    type StatsRow = { track_count: string; total_seconds: string };
    const rows = await manager.query<StatsRow[]>(
      `SELECT COUNT(ps.id)::int AS track_count,
              COALESCE(SUM(s.duration), 0) AS total_seconds
       FROM playlist_songs ps
       LEFT JOIN songs s ON s.id = ps.song_id
       WHERE ps.playlist_id = $1`,
      [playlistId],
    );
    const row = rows[0];
    await manager.update(Playlist, playlistId, {
      totalTracks: parseInt(row.track_count, 10),
      totalHours: parseFloat(row.total_seconds) / 3600,
    });
  }

  private async getPlaylistDetail(
    playlistId: string,
    requesterId: string,
    reloaded: boolean,
  ) {
    const playlist = reloaded
      ? await this.playlists.findOne({ where: { id: playlistId } })
      : await this.playlists.findOne({ where: { id: playlistId } });

    if (!playlist) throw new NotFoundException('Playlist not found');

    const playlistSongs = await this.playlistSongs.find({
      where: { playlistId },
      relations: ['song'],
      order: { position: 'ASC' },
    });

    // Batch-fetch artist names for songs
    const artistUserIds = [...new Set(playlistSongs.map((ps) => ps.song?.userId).filter(Boolean))] as string[];
    const artistProfiles =
      artistUserIds.length > 0
        ? await this.artistProfiles.findBy({ userId: artistUserIds as any })
        : [];
    const artistMap = new Map<string, string>(artistProfiles.map((ap) => [ap.userId, ap.stageName] as [string, string]));

    const isSaved =
      playlist.userId !== requesterId
        ? await this.savedPlaylists.existsBy({ userId: requesterId, playlistId })
        : false;

    const songs = playlistSongs.map((ps) => this.buildSongInPlaylist(ps, artistMap));

    return {
      ...this.buildPlaylistSummary(playlist),
      isSaved,
      songs,
    };
  }

  // BL-16: TAKEN_DOWN songs remain in playlist but fileUrl is nullified in response
  private buildSongInPlaylist(
    ps: PlaylistSong,
    artistMap: Map<string, string>,
  ) {
    const song = ps.song;
    if (!song) return null;

    const isTakenDown = song.status === SongStatus.TAKEN_DOWN;
    const coverArtUrl = song.coverArtUrl
      ? this.storage.getPublicUrl(this.storage.getBuckets().images, song.coverArtUrl)
      : null;

    return {
      playlistSongId: ps.id,
      position: ps.position,
      addedAt: ps.addedAt,
      id: song.id,
      title: song.title,
      artistName: artistMap.get(song.userId) ?? null,
      duration: song.duration,
      coverArtUrl,
      bpm: song.bpm,
      camelotKey: song.camelotKey,
      status: song.status,
      // BL-16: no fileUrl for TAKEN_DOWN songs so client can grey-out but still show row
      isTakenDown,
    };
  }

  buildPlaylistSummary(playlist: Playlist) {
    const coverArtUrl = playlist.coverArtUrl
      ? this.storage.getPublicUrl(this.storage.getBuckets().images, playlist.coverArtUrl)
      : null;

    return {
      id: playlist.id,
      userId: playlist.userId,
      title: playlist.title,
      description: playlist.description,
      coverArtUrl,
      isPublic: playlist.isPublic,
      isLikedSongs: playlist.isLikedSongs,
      totalTracks: playlist.totalTracks,
      totalHours: playlist.totalHours,
      listenerCount: playlist.listenerCount,
      createdAt: playlist.createdAt,
      updatedAt: playlist.updatedAt,
    };
  }
}
