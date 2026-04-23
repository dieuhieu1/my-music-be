import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { InjectDataSource } from '@nestjs/typeorm';
import { InjectQueue } from '@nestjs/bullmq';
import { Cron } from '@nestjs/schedule';
import { DataSource, In, LessThanOrEqual, Repository } from 'typeorm';
import { Queue } from 'bullmq';

import { Song } from '../songs/entities/song.entity';
import { DropNotification } from './entities/drop-notification.entity';
import { Follow } from '../follow/entities/follow.entity';
import { User } from '../auth/entities/user.entity';
import { ArtistProfile } from '../auth/entities/artist-profile.entity';
import { Notification } from '../notifications/entities/notification.entity';
import { FeedEvent } from '../feed/entities/feed-event.entity';
import { AuditLog } from '../audit/entities/audit-log.entity';
import { NotificationsService } from '../notifications/notifications.service';
import { FeedService } from '../feed/feed.service';
import { AuditService } from '../audit/audit.service';
import { MailService } from '../mail/mail.service';
import { StorageService } from '../storage/storage.service';
import { FeedEventType, NotificationType, Role, SongStatus } from '../../common/enums';
import { QUEUE_NAMES } from '../queue/queue.constants';
import { RescheduleDropDto } from './dto/reschedule-drop.dto';
import { TeaserResponseDto } from './dto/teaser-response.dto';

export interface DropNotifyJobPayload {
  songId: string;
}

const ONE_HOUR_MS = 60 * 60 * 1000;
const ONE_DAY_MS = 24 * ONE_HOUR_MS;
const NINETY_DAYS_MS = 90 * ONE_DAY_MS;

@Injectable()
export class DropsService {
  private readonly logger = new Logger(DropsService.name);

  constructor(
    @InjectRepository(Song) private readonly songs: Repository<Song>,
    @InjectRepository(DropNotification) private readonly dropNotifications: Repository<DropNotification>,
    @InjectRepository(Follow) private readonly follows: Repository<Follow>,
    @InjectRepository(User) private readonly users: Repository<User>,
    @InjectRepository(ArtistProfile) private readonly artistProfiles: Repository<ArtistProfile>,
    private readonly notificationsService: NotificationsService,
    private readonly feedService: FeedService,
    private readonly auditService: AuditService,
    private readonly mailService: MailService,
    private readonly storageService: StorageService,
    @InjectQueue(QUEUE_NAMES.DROP_NOTIFICATION) private readonly dropQueue: Queue,
    @InjectQueue(QUEUE_NAMES.EMAIL) private readonly emailQueue: Queue,
    @InjectDataSource() private readonly dataSource: DataSource,
  ) {}

  // ── GET /songs/:songId/teaser (BL-60) ────────────────────────────────────

  async getTeaser(songId: string): Promise<TeaserResponseDto> {
    const song = await this.songs.findOne({
      where: { id: songId, status: SongStatus.SCHEDULED },
      select: ['id', 'title', 'coverArtUrl', 'dropAt', 'userId'],
    });
    if (!song) throw new NotFoundException('Drop teaser not found or song is not scheduled');

    const artistProfile = await this.artistProfiles.findOne({
      where: { userId: song.userId },
      select: ['stageName'],
    });
    const artistName = artistProfile?.stageName ?? 'Unknown Artist';

    const coverArtUrl = song.coverArtUrl
      ? this.storageService.getPublicUrl(this.storageService.getBuckets().images, song.coverArtUrl)
      : null;

    return {
      id: song.id,
      title: song.title,
      artistName,
      coverArtUrl,
      dropAt: song.dropAt!,
      teaserText: `${artistName} · drops in ${this.relativeTime(song.dropAt!)}`,
    };
  }

  // ── POST /songs/:songId/notify (BL-64 opt-in) ────────────────────────────

  async optIn(userId: string, songId: string): Promise<void> {
    const song = await this.songs.findOne({
      where: { id: songId, status: SongStatus.SCHEDULED },
      select: ['id'],
    });
    if (!song) throw new NotFoundException('Song not found or not scheduled');

    await this.dropNotifications
      .createQueryBuilder()
      .insert()
      .into(DropNotification)
      .values({ userId, songId })
      .orIgnore()
      .execute();
  }

  // ── DELETE /songs/:songId/notify (BL-64 opt-out) ─────────────────────────

  async optOut(userId: string, songId: string): Promise<void> {
    await this.dropNotifications.delete({ userId, songId });
  }

  // ── DELETE /songs/:songId/drop (BL-63) ───────────────────────────────────

  async cancelDrop(userId: string, songId: string, roles: string[]): Promise<void> {
    const song = await this.findSongOrThrow(songId);
    const isAdmin = roles.includes(Role.ADMIN);

    if (song.status !== SongStatus.SCHEDULED) {
      throw new BadRequestException('Song is not scheduled for a drop');
    }
    if (song.userId !== userId && !isAdmin) {
      throw new ForbiddenException('You do not own this song');
    }

    await this.removeBullMQJobs(song);

    await this.songs.update(songId, {
      status: SongStatus.APPROVED,
      dropAt: null,
      dropJob24hId: null,
      dropJob1hId: null,
    });

    const optIns = await this.dropNotifications.find({ where: { songId } });
    if (optIns.length > 0) {
      const artistProfile = await this.artistProfiles.findOne({
        where: { userId: song.userId },
        select: ['stageName'],
      });
      const artistName = artistProfile?.stageName ?? 'Unknown Artist';
      const optInUserIds = optIns.map((d) => d.userId);
      const optInUsers = await this.users.find({
        where: { id: In(optInUserIds) },
        select: ['id', 'email'],
      });
      const userMap = new Map(optInUsers.map((u) => [u.id, u]));

      await Promise.allSettled([
        ...optIns.map((dn) =>
          this.notificationsService.create(dn.userId, NotificationType.DROP_CANCELLED, {
            songId,
            songTitle: song.title,
            artistName,
          }),
        ),
        ...optIns
          .map((dn) => userMap.get(dn.userId))
          .filter(Boolean)
          .map((user) =>
            this.emailQueue.add('send-email', {
              to: user!.email,
              subject: `Drop cancelled: "${song.title}"`,
              html: this.mailService.dropCancelledEmail(song.title, artistName),
            }),
          ),
      ]);

      await this.dropNotifications.delete({ songId });
    }
  }

  // ── PATCH /songs/:songId/drop (BL-65) ────────────────────────────────────

  async rescheduleDrop(
    userId: string,
    songId: string,
    dto: RescheduleDropDto,
    roles: string[],
  ): Promise<Song> {
    const song = await this.findSongOrThrow(songId);
    const isAdmin = roles.includes(Role.ADMIN);

    if (song.status !== SongStatus.SCHEDULED) {
      throw new BadRequestException('Song is not scheduled for a drop');
    }
    if (song.userId !== userId && !isAdmin) {
      throw new ForbiddenException('You do not own this song');
    }
    if (song.hasRescheduled) {
      throw new ForbiddenException('Reschedule limit reached — contact admin');
    }

    const now = Date.now();
    const newDropAt = dto.dropAt;
    const newDropMs = newDropAt.getTime();

    if (newDropMs < now + ONE_HOUR_MS) {
      throw new UnprocessableEntityException('New drop time must be at least 1 hour from now');
    }
    if (newDropMs > now + NINETY_DAYS_MS) {
      throw new UnprocessableEntityException('New drop time cannot exceed 90 days from now');
    }
    // Cannot reschedule to within 24h of original drop (spec: new > original - 24h)
    const originalMs = song.dropAt!.getTime();
    if (newDropMs < originalMs - ONE_DAY_MS) {
      throw new UnprocessableEntityException(
        'New drop time cannot be more than 24 hours before the original drop time',
      );
    }

    await this.removeBullMQJobs(song);

    song.dropAt = newDropAt;
    song.hasRescheduled = true;
    song.dropJob24hId = null;
    song.dropJob1hId = null;
    await this.songs.save(song);

    await this.enqueueDropJobs(song);

    const optIns = await this.dropNotifications.find({ where: { songId } });
    if (optIns.length > 0) {
      const artistProfile = await this.artistProfiles.findOne({
        where: { userId: song.userId },
        select: ['stageName'],
      });
      const artistName = artistProfile?.stageName ?? 'Unknown Artist';
      const optInUserIds = optIns.map((d) => d.userId);
      const optInUsers = await this.users.find({
        where: { id: In(optInUserIds) },
        select: ['id', 'email'],
      });
      const userMap = new Map(optInUsers.map((u) => [u.id, u]));

      await Promise.allSettled([
        ...optIns.map((dn) =>
          this.notificationsService.create(dn.userId, NotificationType.DROP_RESCHEDULED, {
            songId,
            songTitle: song.title,
            artistName,
            newDropAt: newDropAt.toISOString(),
          }),
        ),
        ...optIns
          .map((dn) => userMap.get(dn.userId))
          .filter(Boolean)
          .map((user) =>
            this.emailQueue.add('send-email', {
              to: user!.email,
              subject: `Drop rescheduled: "${song.title}"`,
              html: this.mailService.dropRescheduledEmail(song.title, artistName, newDropAt),
            }),
          ),
      ]);
    }

    return song;
  }

  // ── GET /drops (BL-59 listing) ────────────────────────────────────────────

  async getDrops(userId: string, roles: string[]) {
    const isAdmin = roles.includes(Role.ADMIN);

    const whereClause = isAdmin
      ? { status: SongStatus.SCHEDULED }
      : { status: SongStatus.SCHEDULED, userId };

    const scheduledSongs = await this.songs.find({
      where: whereClause,
      order: { dropAt: 'ASC' },
      select: ['id', 'title', 'coverArtUrl', 'dropAt', 'hasRescheduled', 'userId', 'listenCount'],
    });

    const artistIds = [...new Set(scheduledSongs.map((s) => s.userId))];
    const profiles = await this.artistProfiles.find({
      where: { userId: In(artistIds) },
      select: ['userId', 'stageName'],
    });
    const profileMap = new Map(profiles.map((p) => [p.userId, p]));

    return scheduledSongs.map((song) => ({
      id: song.id,
      title: song.title,
      coverArtUrl: song.coverArtUrl
        ? this.storageService.getPublicUrl(this.storageService.getBuckets().images, song.coverArtUrl)
        : null,
      dropAt: song.dropAt,
      hasRescheduled: song.hasRescheduled,
      artistName: profileMap.get(song.userId)?.stageName ?? 'Unknown Artist',
      listenCount: song.listenCount,
    }));
  }

  // ── @Cron: fire due drops every minute (BL-62) ───────────────────────────

  @Cron('* * * * *')
  async fireDueDrops(): Promise<void> {
    const dueSongs = await this.songs.find({
      where: { status: SongStatus.SCHEDULED, dropAt: LessThanOrEqual(new Date()) },
      select: ['id', 'userId', 'title', 'dropAt'],
    });

    for (const song of dueSongs) {
      await this.fireSingleDrop(song).catch((err: Error) =>
        this.logger.error(`Drop fire failed for song ${song.id}: ${err.message}`),
      );
    }
  }

  // ── enqueueDropJobs (called by AdminService on SCHEDULED approval) ────────

  async enqueueDropJobs(song: Song): Promise<void> {
    const now = Date.now();
    const dropMs = song.dropAt!.getTime();

    const delay24h = dropMs - now - ONE_DAY_MS;
    const delay1h = dropMs - now - ONE_HOUR_MS;

    let jobId24h: string | null = null;
    let jobId1h: string | null = null;

    if (delay24h > 0) {
      const job = await this.dropQueue.add(
        'drop-notify-24h',
        { songId: song.id } satisfies DropNotifyJobPayload,
        { delay: delay24h },
      );
      jobId24h = job.id?.toString() ?? null;
    }

    if (delay1h > 0) {
      const job = await this.dropQueue.add(
        'drop-notify-1h',
        { songId: song.id } satisfies DropNotifyJobPayload,
        { delay: delay1h },
      );
      jobId1h = job.id?.toString() ?? null;
    }

    await this.songs.update(song.id, { dropJob24hId: jobId24h, dropJob1hId: jobId1h });
  }

  // ── Private helpers ───────────────────────────────────────────────────────

  private async fireSingleDrop(song: Song): Promise<void> {
    const qr = this.dataSource.createQueryRunner();
    await qr.connect();
    await qr.startTransaction();

    try {
      // Idempotency guard — another cron instance may have already fired this drop
      const result = await qr.manager.update(
        Song,
        { id: song.id, status: SongStatus.SCHEDULED },
        { status: SongStatus.LIVE, dropJob24hId: null, dropJob1hId: null },
      );
      if (!result.affected || result.affected === 0) {
        await qr.rollbackTransaction();
        return;
      }

      // Feed event
      await qr.manager.save(
        FeedEvent,
        qr.manager.create(FeedEvent, {
          actorId: song.userId,
          eventType: FeedEventType.NEW_RELEASE,
          entityId: song.id,
          entityType: 'SONG',
        }),
      );

      // Audit log
      await qr.manager.save(
        AuditLog,
        qr.manager.create(AuditLog, {
          adminId: song.userId,
          action: 'DROP_FIRED',
          targetType: 'SONG',
          targetId: song.id,
        }),
      );

      // Collect recipient IDs (opted-in + artist followers, deduplicated, artist excluded)
      const [optIns, follows] = await Promise.all([
        qr.manager.find(DropNotification, { where: { songId: song.id } }),
        qr.manager.find(Follow, { where: { followeeId: song.userId } }),
      ]);

      const recipientIds = [
        ...new Set([
          ...optIns.map((d) => d.userId),
          ...follows.map((f) => f.followerId),
        ]),
      ].filter((id) => id !== song.userId);

      if (recipientIds.length > 0) {
        const artistProfile = await qr.manager.findOne(ArtistProfile, {
          where: { userId: song.userId },
          select: ['stageName'],
        });
        const artistName = artistProfile?.stageName ?? 'Unknown Artist';

        const notifs = recipientIds.map((uid) =>
          qr.manager.create(Notification, {
            userId: uid,
            type: NotificationType.NEW_RELEASE,
            title: `New Release: ${song.title}`,
            body: `${artistName} just dropped "${song.title}"`,
            payload: { songId: song.id, songTitle: song.title, artistName },
            isRead: false,
          }),
        );
        await qr.manager.save(Notification, notifs);
      }

      // Remove opt-in records (drop has fired — no longer needed)
      if (optIns.length > 0) {
        await qr.manager.delete(DropNotification, { songId: song.id });
      }

      await qr.commitTransaction();
      this.logger.log(
        `Drop fired: song=${song.id} recipients=${recipientIds.length}`,
      );
    } catch (err) {
      await qr.rollbackTransaction();
      throw err;
    } finally {
      await qr.release();
    }
  }

  private async removeBullMQJobs(song: Song): Promise<void> {
    await Promise.allSettled([
      song.dropJob24hId ? this.dropQueue.remove(song.dropJob24hId) : Promise.resolve(),
      song.dropJob1hId ? this.dropQueue.remove(song.dropJob1hId) : Promise.resolve(),
    ]);
  }

  private async findSongOrThrow(songId: string): Promise<Song> {
    const song = await this.songs.findOne({ where: { id: songId } });
    if (!song) throw new NotFoundException('Song not found');
    return song;
  }

  private relativeTime(dropAt: Date): string {
    const diffMs = dropAt.getTime() - Date.now();
    const days = Math.floor(diffMs / ONE_DAY_MS);
    if (days >= 1) return `${days} day${days !== 1 ? 's' : ''}`;
    const hours = Math.floor(diffMs / ONE_HOUR_MS);
    if (hours >= 1) return `${hours} hour${hours !== 1 ? 's' : ''}`;
    const minutes = Math.floor(diffMs / 60_000);
    return `${Math.max(1, minutes)} minute${minutes !== 1 ? 's' : ''}`;
  }
}
