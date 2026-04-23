import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { InjectQueue } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { Queue } from 'bullmq';
import { In, Repository } from 'typeorm';

import { Song } from '../../../modules/songs/entities/song.entity';
import { DropNotification } from '../../../modules/drops/entities/drop-notification.entity';
import { Follow } from '../../../modules/follow/entities/follow.entity';
import { User } from '../../../modules/auth/entities/user.entity';
import { ArtistProfile } from '../../../modules/auth/entities/artist-profile.entity';
import { NotificationsService } from '../../../modules/notifications/notifications.service';
import { MailService } from '../../../modules/mail/mail.service';
import { NotificationType, SongStatus } from '../../../common/enums';
import { QUEUE_NAMES } from '../queue.constants';
import { DropNotifyJobPayload } from '../../../modules/drops/drops.service';

@Processor(QUEUE_NAMES.DROP_NOTIFICATION)
export class DropNotificationWorker extends WorkerHost {
  private readonly logger = new Logger(DropNotificationWorker.name);

  constructor(
    @InjectRepository(Song) private readonly songs: Repository<Song>,
    @InjectRepository(DropNotification) private readonly dropNotifications: Repository<DropNotification>,
    @InjectRepository(Follow) private readonly follows: Repository<Follow>,
    @InjectRepository(User) private readonly users: Repository<User>,
    @InjectRepository(ArtistProfile) private readonly artistProfiles: Repository<ArtistProfile>,
    private readonly notificationsService: NotificationsService,
    private readonly mailService: MailService,
    @InjectQueue(QUEUE_NAMES.EMAIL) private readonly emailQueue: Queue,
  ) {
    super();
  }

  async process(job: Job<DropNotifyJobPayload>): Promise<void> {
    const { songId } = job.data;
    const is24h = job.name === 'drop-notify-24h';

    const song = await this.songs.findOne({
      where: { id: songId },
      select: ['id', 'userId', 'title', 'dropAt', 'status'],
    });

    if (!song || song.status !== SongStatus.SCHEDULED) {
      this.logger.warn(`Drop notification skipped — song ${songId} is no longer SCHEDULED`);
      return;
    }

    const [optIns, follows] = await Promise.all([
      this.dropNotifications.find({ where: { songId } }),
      this.follows.find({ where: { followeeId: song.userId } }),
    ]);

    const recipientIds = [
      ...new Set([
        ...optIns.map((d) => d.userId),
        ...follows.map((f) => f.followerId),
      ]),
    ].filter((id) => id !== song.userId);

    if (recipientIds.length === 0) return;

    const artistProfile = await this.artistProfiles.findOne({
      where: { userId: song.userId },
      select: ['stageName'],
    });
    const artistName = artistProfile?.stageName ?? 'Unknown Artist';
    const timeLabel = is24h ? '24 hours' : '1 hour';

    const recipientUsers = await this.users.find({
      where: { id: In(recipientIds) },
      select: ['id', 'email'],
    });
    const userMap = new Map(recipientUsers.map((u) => [u.id, u]));

    await Promise.allSettled([
      // In-app notifications
      ...recipientIds.map((userId) =>
        this.notificationsService.create(userId, NotificationType.UPCOMING_DROP, {
          songId,
          songTitle: song.title,
          artistName,
          dropAt: song.dropAt?.toISOString(),
        }),
      ),
      // Emails
      ...recipientIds
        .map((uid) => userMap.get(uid))
        .filter(Boolean)
        .map((user) =>
          this.emailQueue.add('send-email', {
            to: user!.email,
            subject: `${artistName} drops "${song.title}" in ${timeLabel}`,
            html: this.mailService.upcomingDropEmail(song.title, artistName, song.dropAt!, is24h),
          }),
        ),
    ]);

    this.logger.log(
      `Drop ${is24h ? '24h' : '1h'} notifications sent for song ${songId} → ${recipientIds.length} recipients`,
    );
  }
}
