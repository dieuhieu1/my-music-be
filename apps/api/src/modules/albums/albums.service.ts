import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, Repository } from 'typeorm';

import { Album } from './entities/album.entity';
import { AlbumSong } from './entities/album-song.entity';
import { Song } from '../songs/entities/song.entity';
import { StorageService } from '../storage/storage.service';
import { CreateAlbumDto } from './dto/create-album.dto';
import { UpdateAlbumDto } from './dto/update-album.dto';

@Injectable()
export class AlbumsService {
  constructor(
    @InjectRepository(Album) private readonly albums: Repository<Album>,
    @InjectRepository(AlbumSong) private readonly albumSongs: Repository<AlbumSong>,
    private readonly storage: StorageService,
    private readonly dataSource: DataSource,
  ) {}

  // ── GET /albums/mine (artist's own albums) ───────────────────────────────

  async findAllByUser(userId: string) {
    const albums = await this.albums.find({
      where: { userId },
      order: { createdAt: 'DESC' },
    });
    return Promise.all(albums.map((a) => this.buildAlbumSummary(a)));
  }

  // ── GET /albums (public paginated browse) ────────────────────────────────

  async browsePaginated(page = 1, limit = 20) {
    const skip = (page - 1) * limit;
    const [items, total] = await this.albums.findAndCount({
      order: { createdAt: 'DESC' },
      skip,
      take: limit,
    });
    return {
      items: await Promise.all(items.map((a) => this.buildAlbumSummary(a))),
      total,
      page,
      limit,
    };
  }

  // ── POST /albums ──────────────────────────────────────────────────────────

  async create(userId: string, dto: CreateAlbumDto, coverArtFile?: Express.Multer.File) {
    const album = this.albums.create({
      userId,
      title: dto.title,
      description: dto.description ?? null,
      releasedAt: dto.releasedAt ? new Date(dto.releasedAt) : null,
    });

    if (coverArtFile) {
      const objectName = `albums/${userId}/${Date.now()}-cover`;
      await this.storage.upload(
        this.storage.getBuckets().images,
        objectName,
        coverArtFile.buffer,
        coverArtFile.mimetype,
      );
      album.coverArtUrl = objectName;
    }

    const saved = await this.albums.save(album);
    return this.buildAlbumDetail(saved, []);
  }

  // ── GET /albums/:id ───────────────────────────────────────────────────────

  async findById(albumId: string) {
    const album = await this.albums.findOne({ where: { id: albumId } });
    if (!album) throw new NotFoundException('Album not found');

    const albumSongsWithSong = await this.albumSongs.find({
      where: { albumId },
      relations: ['song'],
      order: { position: 'ASC' },
    });

    return this.buildAlbumDetail(album, albumSongsWithSong);
  }

  // ── PATCH /albums/:id ─────────────────────────────────────────────────────

  async update(
    userId: string,
    albumId: string,
    dto: UpdateAlbumDto,
    coverArtFile?: Express.Multer.File,
  ) {
    const album = await this.albums.findOne({ where: { id: albumId } });
    if (!album) throw new NotFoundException('Album not found');
    if (album.userId !== userId) throw new ForbiddenException('Not your album');

    if (dto.title !== undefined) album.title = dto.title;
    if (dto.description !== undefined) album.description = dto.description ?? null;
    if (dto.releasedAt !== undefined) album.releasedAt = dto.releasedAt ? new Date(dto.releasedAt) : null;

    if (coverArtFile) {
      const objectName = `albums/${userId}/${albumId}-cover`;
      await this.storage.upload(
        this.storage.getBuckets().images,
        objectName,
        coverArtFile.buffer,
        coverArtFile.mimetype,
      );
      album.coverArtUrl = objectName;
    }

    const saved = await this.albums.save(album);

    const albumSongsWithSong = await this.albumSongs.find({
      where: { albumId },
      relations: ['song'],
      order: { position: 'ASC' },
    });
    return this.buildAlbumDetail(saved, albumSongsWithSong);
  }

  // ── DELETE /albums/:id (BL-18: cascade removes album_songs rows) ──────────

  async remove(userId: string, albumId: string): Promise<void> {
    const album = await this.albums.findOne({ where: { id: albumId } });
    if (!album) throw new NotFoundException('Album not found');
    if (album.userId !== userId) throw new ForbiddenException('Not your album');

    // album_songs rows are cascade-deleted by the FK constraint.
    // Songs themselves remain in the songs table (not deleted).
    await this.albums.remove(album);
  }

  // ── Helpers used by SongsService (called within a transaction) ────────────

  // Recomputes totalTracks and totalHours for an album after any song change (BL-14).
  // Must be called within the caller's transaction via the EntityManager.
  async recomputeAlbumStats(manager: EntityManager, albumId: string): Promise<void> {
    type StatsRow = { track_count: string; total_seconds: string };
    const rows = await manager.query<StatsRow[]>(
      `SELECT COUNT(als.id)::int AS track_count,
              COALESCE(SUM(s.duration), 0) AS total_seconds
       FROM album_songs als
       LEFT JOIN songs s ON s.id = als.song_id
       WHERE als.album_id = $1`,
      [albumId],
    );
    const row = rows[0];
    await manager.update(Album, albumId, {
      totalTracks: parseInt(row.track_count, 10),
      totalHours: parseFloat(row.total_seconds) / 3600,
    });
  }

  // ── Response builders ─────────────────────────────────────────────────────

  async buildAlbumSummary(album: Album) {
    return {
      id: album.id,
      userId: album.userId,
      title: album.title,
      description: album.description,
      coverArtUrl: this.resolveCoverArtUrl(album.coverArtUrl),
      totalTracks: album.totalTracks,
      totalHours: album.totalHours,
      releasedAt: album.releasedAt,
      createdAt: album.createdAt,
    };
  }

  private async buildAlbumDetail(album: Album, albumSongs: AlbumSong[]) {
    const coverArtUrl = this.resolveCoverArtUrl(album.coverArtUrl);

    const tracks = await Promise.all(
      albumSongs.map(async (as) => ({
        position: as.position,
        songId: as.songId,
        title: as.song?.title ?? null,
        duration: as.song?.duration ?? null,
        bpm: as.song?.bpm ?? null,
        camelotKey: as.song?.camelotKey ?? null,
        status: as.song?.status ?? null,
        // energy: never exposed (BL-37A)
      })),
    );

    return {
      id: album.id,
      userId: album.userId,
      title: album.title,
      description: album.description,
      coverArtUrl,
      totalTracks: album.totalTracks,
      totalHours: album.totalHours,
      releasedAt: album.releasedAt,
      createdAt: album.createdAt,
      updatedAt: album.updatedAt,
      tracks,
    };
  }

  private resolveCoverArtUrl(objectPath: string | null): string | null {
    if (!objectPath) return null;
    return this.storage.getPublicUrl(this.storage.getBuckets().images, objectPath);
  }
}
