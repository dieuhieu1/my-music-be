import { Module, Global } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { TypeOrmModule } from '@nestjs/typeorm';
import { QUEUE_NAMES } from './queue.constants';
import { SessionCleanupWorker } from './workers/session-cleanup.worker';
import { Session } from '../auth/entities/session.entity';
import { VerificationCode } from '../auth/entities/verification-code.entity';
import { PasswordReset } from '../auth/entities/password-reset.entity';

// Global so any module can inject queues via @InjectQueue() without re-importing.
// Workers are co-located here or in their feature modules.
@Global()
@Module({
  imports: [
    BullModule.registerQueue(
      { name: QUEUE_NAMES.EMAIL },
      { name: QUEUE_NAMES.AUDIO_EXTRACTION },
      { name: QUEUE_NAMES.DROP_NOTIFICATION },
      { name: QUEUE_NAMES.GENRE_BULK_TAGGING },
      { name: QUEUE_NAMES.RECOMMENDATION_BATCH },
      { name: QUEUE_NAMES.SESSION_CLEANUP },
    ),
    TypeOrmModule.forFeature([Session, VerificationCode, PasswordReset]),
  ],
  providers: [SessionCleanupWorker],
  exports: [BullModule],
})
export class QueueModule {}
