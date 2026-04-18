import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BullModule } from '@nestjs/bullmq';

import { Song } from '../songs/entities/song.entity';
import { User } from '../auth/entities/user.entity';
import { AdminService } from './admin.service';
import { AdminController } from './admin.controller';
import { AuditModule } from '../audit/audit.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { GenresModule } from '../genres/genres.module';
import { SongsModule } from '../songs/songs.module';
import { MailModule } from '../mail/mail.module';
import { QUEUE_NAMES } from '../queue/queue.constants';

@Module({
  imports: [
    TypeOrmModule.forFeature([Song, User]),
    BullModule.registerQueue({ name: QUEUE_NAMES.EMAIL }),
    AuditModule,
    NotificationsModule,
    GenresModule,
    SongsModule,
    MailModule,
  ],
  controllers: [AdminController],
  providers: [AdminService],
})
export class AdminModule {}
