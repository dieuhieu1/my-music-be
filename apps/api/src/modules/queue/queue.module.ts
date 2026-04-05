import { Module, Global } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { QUEUE_NAMES } from './queue.constants';

// Global so any module can inject queues via @InjectQueue() without re-importing.
// Workers (Processors) are registered in their own modules (auth, songs, drops, etc.)
// and import QueueModule to get queue references.
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
  ],
  exports: [BullModule],
})
export class QueueModule {}
