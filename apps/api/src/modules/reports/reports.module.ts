import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BullModule } from '@nestjs/bullmq';

import { Report } from './entities/report.entity';
import { Song } from '../songs/entities/song.entity';
import { Playlist } from '../playlists/entities/playlist.entity';
import { User } from '../auth/entities/user.entity';
import { ArtistProfile } from '../auth/entities/artist-profile.entity';
import { ReportsService } from './reports.service';
import { ReportsController } from './reports.controller';
import { NotificationsModule } from '../notifications/notifications.module';
import { MailModule } from '../mail/mail.module';
import { QUEUE_NAMES } from '../queue/queue.constants';

@Module({
  imports: [
    TypeOrmModule.forFeature([Report, Song, Playlist, User, ArtistProfile]),
    BullModule.registerQueue({ name: QUEUE_NAMES.EMAIL }),
    NotificationsModule,
    MailModule,
  ],
  controllers: [ReportsController],
  providers: [ReportsService],
  exports: [ReportsService],
})
export class ReportsModule {}
