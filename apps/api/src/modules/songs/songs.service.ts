import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Not, Repository } from 'typeorm';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { randomBytes, createCipheriv } from 'crypto';
import { v4 as uuidv4 } from 'uuid';

import { Song } from './entities/song.entity';
import { SongEncryptionKey } from './entities/song-encryption-key.entity';
import { Album } from '../albums/entities/album.entity';
import { AlbumSong } from '../albums/entities/album-song.entity';
import { GenreSuggestion } from '../genres/entities/genre-suggestion.entity';
import { User } from '../auth/entities/user.entity';
import { StorageService } from '../storage/storage.service';
import { AlbumsService } from '../albums/albums.service';
import { QUEUE_NAMES } from '../queue/queue.constants';
import { UploadSongDto } from './dto/upload-song.dto';
import { UpdateSongDto } from './dto/update-song.dto';
import { ResubmitSongDto } from './dto/resubmit-song.dto';
import { SongStatus } from '../../common/enums';

// ── Audio magic-byte helpers ─────────────────────────────────────────────────

/**
 * Returns the detected MIME type if the buffer contains a supported audio format,
 * or null if the magic bytes do not match any allowed format (BL-44).
 *
 * Supported:  MP3 (ID3v2 header or raw frame sync), FLAC, WAV
 */
function detectAudioMagicBytes(buf: Buffer): string | null {
  if (buf.length < 12) return null;

  // ID3v2 tag (most MP3 files start with 'ID3')
  if (buf[0] === 0x49 && buf[1] === 0x44 && buf[2] === 0x33) return 'audio/mpeg';

  // Raw MP3 frame sync: high 11 bits are all 1s (0xFFE0 mask)
  if (buf[0] === 0xff && (buf[1] & 0xe0) === 0xe0) return 'audio/mpeg';

  // FLAC: 'fLaC' (0x66 0x4C 0x61 0x43)
  if (buf[0] === 0x66 && buf[1] === 0x4c && buf[2] === 0x61 && buf[3] === 0x43) return 'audio/flac';

  // WAV: 'RIFF' at [0..3] and 'WAVE' at [8..11]
  if (
    buf[0] === 0x52 && buf[1] === 0x49 && buf[2] === 0x46 && buf[3] === 0x46 &&
    buf[8] === 0x57 && buf[9] === 0x41 && buf[10] === 0x56 && buf[11] === 0x45
  ) {
    return 'audio/wav';
  }

  return null;
}

/**
 * Strips an ID3v2 tag from the start of an MP3 buffer (BL-44: metadata removal).
 * If no ID3v2 tag is present the buffer is returned unchanged.
 * Note: ID3v1 tags sit at the end of the file (last 128 bytes) and are handled
 * separately if needed in a future hardening pass.
 */
function stripId3v2Header(buf: Buffer): Buffer {
  // ID3v2 header signature
  if (buf[0] !== 0x49 || buf[1] !== 0x44 || buf[2] !== 0x33) return buf;

  // Size is encoded as a 4-byte syncsafe integer starting at offset 6
  const tagSize =
    ((buf[6] & 0x7f) << 21) |
    ((buf[7] & 0x7f) << 14) |
    ((buf[8] & 0x7f) << 7) |
    (buf[9] & 0x7f);

  const headerTotalSize = 10 + tagSize;
  if (headerTotalSize >= buf.length) return buf; // malformed — return as-is
  return buf.subarray(headerTotalSize);
}

/**
 * AES-256-CBC encryption — generates a fresh random key and IV per song (BL-44).
 * Returns the encrypted buffer and the base64-encoded key + IV for storage.
 */
function encryptAes256Cbc(buf: Buffer): { encrypted: Buffer; aesKey: string; iv: string } {
  const key = randomBytes(32); // 256-bit key
  const ivBuf = randomBytes(16); // 128-bit IV
  const cipher = createCipheriv('aes-256-cbc', key, ivBuf);
  const encrypted = Buffer.concat([cipher.update(buf), cipher.final()]);
  return { encrypted, aesKey: key.toString('base64'), iv: ivBuf.toString('base64') };
}

// ── Song upload quota constant (BL-39) ───────────────────────────────────────
const NON_PREMIUM_UPLOAD_LIMIT = 50;

@Injectable()
export class SongsService {
  private readonly logger = new Logger(SongsService.name);

  constructor(
    @InjectRepository(Song) private readonly songs: Repository<Song>,
    @InjectRepository(SongEncryptionKey) private readonly encryptionKeys: Repository<SongEncryptionKey>,
    @InjectRepository(User) private readonly users: Repository<User>,
    private readonly storage: StorageService,
    private readonly albumsService: AlbumsService,
    private readonly dataSource: DataSource,
    @InjectQueue(QUEUE_NAMES.AUDIO_EXTRACTION) private readonly audioExtractionQueue: Queue,
  ) {}

  // ── POST /songs/upload (BL-48, BL-39, BL-44) ─────────────────────────────

  async upload(
    userId: string,
    dto: UploadSongDto,
    audioFile: Express.Multer.File,
    coverArtFile?: Express.Multer.File,
  ) {
    // BL-39 — quota check: non-premium artists limited to 50 songs
    const user = await this.users.findOne({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');

    if (!user.isPremium) {
      const count = await this.songs.count({
        where: { userId, status: Not(SongStatus.REJECTED) },
      });
      if (count >= NON_PREMIUM_UPLOAD_LIMIT) {
        throw new ForbiddenException(
          `Upload limit reached (${NON_PREMIUM_UPLOAD_LIMIT} songs). Upgrade to Premium for unlimited uploads.`,
        );
      }
    }

    // BL-44 — magic-byte validation (reject files with spoofed extensions)
    const detectedMime = detectAudioMagicBytes(audioFile.buffer);
    if (!detectedMime) {
      throw new BadRequestException(
        'Invalid audio file: magic bytes do not match a supported audio format (MP3, FLAC, WAV).',
      );
    }

    // BL-44 — strip ID3v2 metadata from MP3 (prevents GPS/PII leakage)
    const strippedBuffer =
      detectedMime === 'audio/mpeg' ? stripId3v2Header(audioFile.buffer) : audioFile.buffer;

    // BL-44 — AES-256-CBC encryption for PREMIUM download copy
    const { encrypted, aesKey, iv } = encryptAes256Cbc(strippedBuffer);

    // Pre-generate UUID to use as both the DB id and the MinIO object prefix
    const songId = uuidv4();
    const audioObjectName = `audio/songs/${userId}/${songId}`;
    const encObjectName = `audio/songs/${userId}/${songId}.enc`;
    let coverArtObjectName: string | null = null;

    // Upload files to MinIO — done before the DB transaction so the DB record
    // always points to an object that exists in storage
    await Promise.all([
      this.storage.upload(this.storage.getBuckets().audio, audioObjectName, strippedBuffer, detectedMime),
      this.storage.upload(this.storage.getBuckets().audio, encObjectName, encrypted, 'application/octet-stream'),
    ]);

    if (coverArtFile) {
      coverArtObjectName = `songs/${userId}/${songId}-cover`;
      try {
        await this.storage.upload(
          this.storage.getBuckets().images,
          coverArtObjectName,
          coverArtFile.buffer,
          coverArtFile.mimetype,
        );
      } catch {
        coverArtObjectName = null; // non-fatal; song is still created without cover art
      }
    }

    // DB transaction: Song + SongEncryptionKey + optional AlbumSong + optional GenreSuggestion
    const song = await this.dataSource.transaction(async (manager) => {
      // Create the Song record using the pre-generated ID
      const newSong = manager.create(Song, {
        id: songId,
        userId,
        title: dto.title,
        fileUrl: audioObjectName,
        encryptedFileUrl: encObjectName,
        coverArtUrl: coverArtObjectName,
        genreIds: dto.genreIds ?? [],
        bpm: dto.bpm ?? null,
        camelotKey: dto.camelotKey ?? null,
        dropAt: dto.dropAt ? new Date(dto.dropAt) : null,
        status: SongStatus.PENDING,
      });
      const savedSong = await manager.save(newSong);

      // Store the AES key + IV
      const encKey = manager.create(SongEncryptionKey, { songId, aesKey, iv });
      await manager.save(encKey);

      // Optional album assignment
      if (dto.albumId) {
        const album = await manager.findOne(Album, { where: { id: dto.albumId, userId } });
        if (!album) throw new NotFoundException('Album not found');

        type MaxRow = { max: number | null };
        const [{ max }] = await manager.query<MaxRow[]>(
          'SELECT MAX(position) as max FROM album_songs WHERE album_id = $1',
          [dto.albumId],
        );
        const nextPosition = (max ?? -1) + 1;

        const albumSong = manager.create(AlbumSong, {
          albumId: dto.albumId,
          songId,
          position: nextPosition,
        });
        await manager.save(albumSong);

        // BL-14 — recompute totalTracks / totalHours
        await this.albumsService.recomputeAlbumStats(manager, dto.albumId);
      }

      // Optional genre suggestion — link songId for retroactive bulk-tagging (BL-49)
      if (dto.suggestGenre?.trim()) {
        const suggestion = manager.create(GenreSuggestion, {
          userId,
          songId,
          name: dto.suggestGenre.trim(),
        });
        await manager.save(suggestion);
      }

      return savedSong;
    }).catch(async (err) => {
      // Clean up orphaned MinIO objects if the DB transaction failed
      this.logger.error(`Upload DB transaction failed for songId=${songId}: ${err.message}`);
      await Promise.allSettled([
        this.storage.deleteObject(this.storage.getBuckets().audio, audioObjectName),
        this.storage.deleteObject(this.storage.getBuckets().audio, encObjectName),
        coverArtObjectName
          ? this.storage.deleteObject(this.storage.getBuckets().images, coverArtObjectName)
          : Promise.resolve(),
      ]);
      throw err;
    });

    // Enqueue DSP audio extraction — fire-and-forget (BL-37A)
    await this.audioExtractionQueue.add('extract', { songId: song.id }).catch((err) => {
      this.logger.error(`Failed to enqueue audio extraction for songId=${song.id}: ${err.message}`);
    });

    return this.buildSongResponse(song);
  }

  // ── GET /songs/:id ────────────────────────────────────────────────────────

  async findById(requesterId: string, songId: string) {
    const song = await this.songs.findOne({ where: { id: songId } });
    if (!song) throw new NotFoundException('Song not found');

    // Only the owner can view a PENDING/REJECTED song
    if (
      song.status === SongStatus.PENDING ||
      song.status === SongStatus.REJECTED ||
      song.status === SongStatus.REUPLOAD_REQUIRED
    ) {
      if (song.userId !== requesterId) throw new NotFoundException('Song not found');
    }

    return this.buildSongResponse(song);
  }

  // ── PATCH /songs/:id ──────────────────────────────────────────────────────

  async update(
    userId: string,
    songId: string,
    dto: UpdateSongDto,
    coverArtFile?: Express.Multer.File,
  ) {
    const song = await this.songs.findOne({ where: { id: songId } });
    if (!song) throw new NotFoundException('Song not found');
    if (song.userId !== userId) throw new ForbiddenException('Not your song');

    if (dto.title !== undefined) song.title = dto.title;
    // BL-37A — BPM and Camelot Key are artist-editable (can override DSP values)
    if (dto.bpm !== undefined) song.bpm = dto.bpm;
    if (dto.camelotKey !== undefined) song.camelotKey = dto.camelotKey;
    if (dto.genreIds !== undefined) song.genreIds = dto.genreIds;
    if (dto.dropAt !== undefined) song.dropAt = dto.dropAt ? new Date(dto.dropAt) : null;

    if (coverArtFile) {
      const objectName = `songs/${userId}/${songId}-cover`;
      await this.storage.upload(
        this.storage.getBuckets().images,
        objectName,
        coverArtFile.buffer,
        coverArtFile.mimetype,
      );
      song.coverArtUrl = objectName;
    }

    // Handle album change inside a transaction (BL-14 recompute)
    if (dto.albumId !== undefined) {
      await this.dataSource.transaction(async (manager) => {
        // Remove from old album if it exists
        const existingLink = await manager.findOne(AlbumSong, { where: { songId } });
        if (existingLink) {
          const oldAlbumId = existingLink.albumId;
          await manager.remove(existingLink);
          await this.albumsService.recomputeAlbumStats(manager, oldAlbumId);
        }

        // Validate new album belongs to this user
        const newAlbum = await manager.findOne(Album, { where: { id: dto.albumId, userId } });
        if (!newAlbum) throw new NotFoundException('Album not found');

        type MaxRow = { max: number | null };
        const [{ max }] = await manager.query<MaxRow[]>(
          'SELECT MAX(position) as max FROM album_songs WHERE album_id = $1',
          [dto.albumId],
        );
        const albumSong = manager.create(AlbumSong, {
          albumId: dto.albumId,
          songId,
          position: (max ?? -1) + 1,
        });
        await manager.save(albumSong);
        await this.albumsService.recomputeAlbumStats(manager, dto.albumId);

        await manager.save(song);
      });
    } else {
      await this.songs.save(song);
    }

    const updated = await this.songs.findOne({ where: { id: songId } });
    return this.buildSongResponse(updated!);
  }

  // ── DELETE /songs/:id ─────────────────────────────────────────────────────

  async remove(userId: string, songId: string): Promise<void> {
    const song = await this.songs.findOne({ where: { id: songId } });
    if (!song) throw new NotFoundException('Song not found');
    if (song.userId !== userId) throw new ForbiddenException('Not your song');

    await this.dataSource.transaction(async (manager) => {
      // Remove album association and recompute album stats (BL-14)
      const albumSong = await manager.findOne(AlbumSong, { where: { songId } });
      if (albumSong) {
        const albumId = albumSong.albumId;
        await manager.remove(albumSong);
        await this.albumsService.recomputeAlbumStats(manager, albumId);
      }

      // Cascade: SongEncryptionKey and SongDailyStats are deleted via FK ON DELETE CASCADE
      await manager.remove(song);
    });

    // Clean up MinIO objects — best-effort (stale objects can be pruned by a maintenance job)
    await Promise.allSettled([
      this.storage.deleteObject(this.storage.getBuckets().audio, song.fileUrl),
      this.storage.deleteObject(this.storage.getBuckets().audio, song.encryptedFileUrl),
      song.coverArtUrl
        ? this.storage.deleteObject(this.storage.getBuckets().images, song.coverArtUrl)
        : Promise.resolve(),
    ]);
  }

  // ── Response builder ──────────────────────────────────────────────────────
  // energy is intentionally excluded — never exposed to artists (BL-37A)

  async buildSongResponse(song: Song) {
    const coverArtUrl = song.coverArtUrl
      ? this.storage.getPublicUrl(this.storage.getBuckets().images, song.coverArtUrl)
      : null;

    return {
      id: song.id,
      userId: song.userId,
      title: song.title,
      duration: song.duration,
      coverArtUrl,
      genreIds: song.genreIds ?? [],
      bpm: song.bpm,
      camelotKey: song.camelotKey,
      // energy: omitted — internal use only (BL-37A)
      status: song.status,
      dropAt: song.dropAt,
      reuploadReason: song.reuploadReason,
      rejectionReason: song.rejectionReason,
      listenCount: song.listenCount,
      createdAt: song.createdAt,
      updatedAt: song.updatedAt,
    };
  }

  // ── PATCH /songs/:id/resubmit (BL-85) ────────────────────────────────────

  async resubmit(userId: string, songId: string, dto: ResubmitSongDto) {
    const song = await this.songs.findOne({ where: { id: songId } });
    if (!song) throw new NotFoundException('Song not found');
    if (song.userId !== userId) throw new ForbiddenException('Not your song');

    if (song.status !== SongStatus.REUPLOAD_REQUIRED) {
      throw new BadRequestException('Song is not in REUPLOAD_REQUIRED status');
    }

    if (dto.title !== undefined) song.title = dto.title;
    if (dto.genreIds !== undefined) song.genreIds = dto.genreIds;
    if (dto.dropAt !== undefined) song.dropAt = dto.dropAt ? new Date(dto.dropAt) : null;

    song.status = SongStatus.PENDING;
    song.reuploadReason = null;

    await this.songs.save(song);
    return this.buildSongResponse(song);
  }

  // ── List songs for the current artist ────────────────────────────────────

  async findAllByUser(userId: string) {
    const songs = await this.songs.find({
      where: { userId },
      order: { createdAt: 'DESC' },
    });
    return Promise.all(songs.map((s) => this.buildSongResponse(s)));
  }
}
