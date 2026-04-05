// Queue name constants — used when registering queues (QueueModule)
// and when injecting them in services/workers via @InjectQueue(QUEUE_NAMES.EMAIL).
export const QUEUE_NAMES = {
  EMAIL: 'email',
  AUDIO_EXTRACTION: 'audio-extraction',
  DROP_NOTIFICATION: 'drop-notification',
  GENRE_BULK_TAGGING: 'genre-bulk-tagging',
  RECOMMENDATION_BATCH: 'recommendation-batch',
  SESSION_CLEANUP: 'session-cleanup',
} as const;

export type QueueName = (typeof QUEUE_NAMES)[keyof typeof QUEUE_NAMES];
