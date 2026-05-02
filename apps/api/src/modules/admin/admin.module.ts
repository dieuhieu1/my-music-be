import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BullModule } from '@nestjs/bullmq';

import { Song } from '../songs/entities/song.entity';
import { ArtistProfile } from '../auth/entities/artist-profile.entity';
import { User } from '../auth/entities/user.entity';
import { Session } from '../auth/entities/session.entity';
import { PaymentRecord } from '../payments/entities/payment-record.entity';
import { DownloadRecord } from '../downloads/entities/download-record.entity';
import { AdminService } from './admin.service';
import { AdminController } from './admin.controller';
import { AuditModule } from '../audit/audit.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { GenresModule } from '../genres/genres.module';
import { SongsModule } from '../songs/songs.module';
import { MailModule } from '../mail/mail.module';
import { DropsModule } from '../drops/drops.module';
import { ReportsModule } from '../reports/reports.module';
import { PaymentsModule } from '../payments/payments.module';
import { QUEUE_NAMES } from '../queue/queue.constants';

@Module({
  imports: [
    TypeOrmModule.forFeature([Song, ArtistProfile, User, Session, PaymentRecord, DownloadRecord]),
    BullModule.registerQueue({ name: QUEUE_NAMES.EMAIL }),
    AuditModule,
    NotificationsModule,
    GenresModule,
    SongsModule,
    MailModule,
    DropsModule,
    ReportsModule,   // Phase 9 — reports admin endpoints + takedown cascade
    PaymentsModule,  // Phase 9 — adminGrantPremiumByDays, adminRevokePremium
  ],
  controllers: [AdminController],
  providers: [AdminService],
})
export class AdminModule {}
