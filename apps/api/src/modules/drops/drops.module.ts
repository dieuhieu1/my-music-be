import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { Song } from '../songs/entities/song.entity';
import { DropNotification } from './entities/drop-notification.entity';
import { Follow } from '../follow/entities/follow.entity';
import { User } from '../auth/entities/user.entity';
import { ArtistProfile } from '../auth/entities/artist-profile.entity';
import { Notification } from '../notifications/entities/notification.entity';
import { FeedEvent } from '../feed/entities/feed-event.entity';
import { AuditLog } from '../audit/entities/audit-log.entity';

import { DropsService } from './drops.service';
import { DropsController } from './drops.controller';
import { DropNotificationWorker } from '../queue/workers/drop-notification.worker';

import { NotificationsModule } from '../notifications/notifications.module';
import { FeedModule } from '../feed/feed.module';
import { AuditModule } from '../audit/audit.module';
import { StorageModule } from '../storage/storage.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Song,
      DropNotification,
      Follow,
      User,
      ArtistProfile,
      Notification,
      FeedEvent,
      AuditLog,
    ]),
    NotificationsModule,
    FeedModule,
    AuditModule,
    StorageModule,
  ],
  controllers: [DropsController],
  providers: [DropsService, DropNotificationWorker],
  exports: [DropsService],
})
export class DropsModule {}
