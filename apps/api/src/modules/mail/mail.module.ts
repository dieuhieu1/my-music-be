import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { MailService } from './mail.service';
import { EmailWorker } from './workers/email.worker';
import { QUEUE_NAMES } from '../queue/queue.constants';

@Module({
  imports: [BullModule.registerQueue({ name: QUEUE_NAMES.EMAIL })],
  providers: [MailService, EmailWorker],
  exports: [MailService],
})
export class MailModule {}
