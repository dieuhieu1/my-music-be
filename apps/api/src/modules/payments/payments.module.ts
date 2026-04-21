import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { HttpModule } from '@nestjs/axios';

import { PaymentRecord } from './entities/payment-record.entity';
import { DownloadRecord } from '../downloads/entities/download-record.entity';
import { User } from '../auth/entities/user.entity';
import { PaymentsService } from './payments.service';
import { PaymentsController } from './payments.controller';
import { NotificationsModule } from '../notifications/notifications.module';
import { MailModule } from '../mail/mail.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([PaymentRecord, DownloadRecord, User]),
    HttpModule,
    NotificationsModule,
    MailModule,
  ],
  controllers: [PaymentsController],
  providers: [PaymentsService],
  exports: [PaymentsService],
})
export class PaymentsModule {}
