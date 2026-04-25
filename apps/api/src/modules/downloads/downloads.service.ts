import {
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';
import { Cron } from '@nestjs/schedule';
import { LessThanOrEqual, Repository } from 'typeorm';
import * as jwt from 'jsonwebtoken';

import { DownloadRecord } from './entities/download-record.entity';
import { Song } from '../songs/entities/song.entity';
import { SongEncryptionKey } from '../songs/entities/song-encryption-key.entity';
import { User } from '../auth/entities/user.entity';
import { StorageService } from '../storage/storage.service';
import { Role, SongStatus } from '../../common/enums';
import { RevalidateDownloadsDto } from './dto/revalidate-downloads.dto';
import {
  DownloadRecordResponseDto,
  DownloadResponseDto,
  RevalidateResponseDto,
} from './dto/download.response.dto';

// ── Constants ──────────────────────────────────────────────────────────────────

const DOWNLOAD_LIMITS: Partial<Record<string, number>> = {
  ARTIST_PREMIUM: 200,
  USER_PREMIUM: 100,
};

const LICENSE_JWT_TTL_DAYS = 30;
// Resolved from StorageService at call time via getBuckets().audioEnc

// ── Helpers ────────────────────────────────────────────────────────────────────

function getDownloadLimit(roles: Role[]): number {
  if (roles.includes(Role.ADMIN)) return Infinity;
  if (!roles.includes(Role.PREMIUM)) return 0;
  return roles.includes(Role.ARTIST)
    ? (DOWNLOAD_LIMITS.ARTIST_PREMIUM ?? 200)
    : (DOWNLOAD_LIMITS.USER_PREMIUM ?? 100);
}

function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

// ── Service ────────────────────────────────────────────────────────────────────

@Injectable()
export class DownloadsService {
  private readonly logger = new Logger(DownloadsService.name);

  constructor(
    @InjectRepository(DownloadRecord)
    private readonly downloadRecords: Repository<DownloadRecord>,
    @InjectRepository(Song)
    private readonly songs: Repository<Song>,
    @InjectRepository(SongEncryptionKey)
    private readonly encryptionKeys: Repository<SongEncryptionKey>,
    @InjectRepository(User)
    private readonly users: Repository<User>,
    private readonly storageService: StorageService,
    private readonly config: ConfigService,
  ) {}

  // ── POST /songs/:songId/download ───────────────────────────────────────────

  async downloadSong(userId: string, songId: string): Promise<DownloadResponseDto> {
    const user = await this.users.findOne({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');

    // ADMIN bypasses PREMIUM check entirely
    const isAdmin = user.roles.includes(Role.ADMIN);
    if (!isAdmin && !user.isPremium) {
      throw new ForbiddenException('Premium subscription required to download songs');
    }

    const song = await this.songs.findOne({
      where: { id: songId },
      select: ['id', 'status', 'title', 'encryptedFileUrl'],
    });
    if (!song) throw new NotFoundException('Song not found');
    if (song.status !== SongStatus.LIVE) {
      throw new UnprocessableEntityException('Only LIVE songs can be downloaded');
    }

    if (!isAdmin) {
      const limit = getDownloadLimit(user.roles);
      const activeCount = await this.downloadRecords.count({
        where: { userId, revokedAt: undefined },
      });
      if (activeCount >= limit) {
        throw new ForbiddenException(
          `Download quota reached (${activeCount}/${limit}). Remove a download or upgrade your plan.`,
        );
      }
    }

    const encKey = await this.encryptionKeys.findOne({
      where: { songId },
      select: ['aesKey', 'iv'],
    });
    if (!encKey) {
      throw new UnprocessableEntityException('Encryption key not found for this song');
    }

    // Build licenseJwt — FE uses aesKey + iv for Web Crypto AES-256-CBC decrypt
    const expiresAt = addDays(new Date(), LICENSE_JWT_TTL_DAYS);
    const secret = this.config.get<string>('payment.downloadJwtSecret')!;
    const licenseJwt = jwt.sign(
      {
        songId,
        userId,
        aesKey: encKey.aesKey,
        iv: encKey.iv,
        expiresAt: Math.floor(expiresAt.getTime() / 1000),
      },
      secret,
      { algorithm: 'HS256', expiresIn: `${LICENSE_JWT_TTL_DAYS}d` },
    );

    // 5-minute presigned URL for the .enc file
    const encFileName = `${songId}.enc`;
    const downloadUrl = await this.storageService.presignedGetObject(
      this.storageService.getBuckets().audioEnc,
      encFileName,
      5 * 60,
    );

    // Upsert download record (re-download refreshes the JWT)
    const existing = await this.downloadRecords.findOne({
      where: { userId, songId },
    });

    if (existing) {
      await this.downloadRecords.update(existing.id, {
        licenseJwt,
        expiresAt,
        revokedAt: null,
        downloadedAt: new Date(),
      });
    } else {
      const record = this.downloadRecords.create({
        userId,
        songId,
        licenseJwt,
        expiresAt,
        revokedAt: null,
      });
      await this.downloadRecords.save(record);

      // Update downloadQuota counter on user
      await this.users.increment({ id: userId }, 'downloadQuota', 1);
    }

    return { downloadUrl, licenseJwt, expiresAt };
  }

  // ── GET /songs/downloads ───────────────────────────────────────────────────

  async getDownloads(userId: string): Promise<DownloadRecordResponseDto[]> {
    const records = await this.downloadRecords.find({
      where: { userId },
      relations: ['song'],
      order: { downloadedAt: 'DESC' },
      select: {
        id: true,
        songId: true,
        licenseJwt: true,
        downloadedAt: true,
        expiresAt: true,
        revokedAt: true,
        song: { id: true, title: true, coverArtUrl: true },
      },
    });

    return records.map((r) => ({
      id: r.id,
      songId: r.songId,
      songTitle: r.song?.title ?? '',
      coverArtUrl: r.song?.coverArtUrl ?? null,
      downloadedAt: r.downloadedAt,
      expiresAt: r.expiresAt,
      revokedAt: r.revokedAt,
      licenseJwt: r.revokedAt ? '' : r.licenseJwt, // omit JWT for revoked records
    }));
  }

  // ── POST /songs/downloads/revalidate ──────────────────────────────────────

  async revalidateDownloads(
    userId: string,
    dto: RevalidateDownloadsDto,
  ): Promise<RevalidateResponseDto> {
    if (dto.songIds.length === 0) return { renewed: [], revoked: [] };

    const user = await this.users.findOne({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');

    const records = await this.downloadRecords.find({
      where: { userId, songId: dto.songIds as any },
      relations: ['song'],
    });

    const secret = this.config.get<string>('payment.downloadJwtSecret')!;
    const encKeys = await this.encryptionKeys.find({
      where: { songId: dto.songIds as any },
      select: ['songId', 'aesKey', 'iv'],
    });
    const keyMap = new Map(encKeys.map((k) => [k.songId, k]));

    const renewed: string[] = [];
    const revoked: string[] = [];
    const isAdmin = user.roles.includes(Role.ADMIN);
    const isPremiumActive = isAdmin || user.isPremium;

    for (const record of records) {
      if (record.revokedAt) continue; // already revoked, skip

      // If song was taken down, do not revoke — just omit the JWT (already handled in getDownloads)
      if (record.song?.status === SongStatus.TAKEN_DOWN) continue;

      if (!isPremiumActive) {
        // Premium lapsed: revoke
        await this.downloadRecords.update(record.id, { revokedAt: new Date() });
        revoked.push(record.songId);
        continue;
      }

      // Renew: reissue fresh licenseJwt (30-day reset)
      const key = keyMap.get(record.songId);
      if (!key) continue;

      const expiresAt = addDays(new Date(), LICENSE_JWT_TTL_DAYS);
      const licenseJwt = jwt.sign(
        {
          songId: record.songId,
          userId,
          aesKey: key.aesKey,
          iv: key.iv,
          expiresAt: Math.floor(expiresAt.getTime() / 1000),
        },
        secret,
        { algorithm: 'HS256', expiresIn: `${LICENSE_JWT_TTL_DAYS}d` },
      );

      await this.downloadRecords.update(record.id, { licenseJwt, expiresAt });
      renewed.push(record.songId);
    }

    return { renewed, revoked };
  }

  // ── DELETE /songs/downloads/:songId ───────────────────────────────────────

  async removeDownload(userId: string, songId: string): Promise<void> {
    const record = await this.downloadRecords.findOne({
      where: { userId, songId },
    });

    if (!record) throw new NotFoundException('Download record not found');
    if (record.revokedAt) return; // already removed, idempotent

    await this.downloadRecords.update(record.id, { revokedAt: new Date() });
    await this.users.decrement({ id: userId }, 'downloadQuota', 1);
  }

  // ── Daily 3AM cron: hard-delete expired revoked records ───────────────────

  @Cron('0 3 * * *')
  async cleanupExpiredDownloads(): Promise<void> {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - 7); // 7-day grace period (BL-58)

    const result = await this.downloadRecords.delete({
      revokedAt: LessThanOrEqual(cutoff),
    });

    if (result.affected && result.affected > 0) {
      this.logger.log(`cleanupExpiredDownloads: deleted ${result.affected} expired records`);
    }
  }
}
