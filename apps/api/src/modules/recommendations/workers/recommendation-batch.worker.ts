import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PlayHistory } from '../../playback/entities/play-history.entity';
import { RecommendationsService } from '../recommendations.service';

@Injectable()
export class RecommendationBatchWorker {
  private readonly logger = new Logger(RecommendationBatchWorker.name);

  constructor(
    @InjectRepository(PlayHistory)
    private readonly playHistoryRepo: Repository<PlayHistory>,
    private readonly recommendationsService: RecommendationsService,
  ) {}

  // Daily 3 AM — refreshes recommendation cache for all active users.
  // "Active" = played at least one song in the past 30 days.
  // Per-user failure is logged and skipped; the batch never aborts entirely.
  @Cron('0 3 * * *')
  async runBatch(): Promise<void> {
    this.logger.log('Recommendation batch: starting');

    const thirtyDaysAgo = new Date(Date.now() - 30 * 86400_000);

    // DISTINCT in raw query — no TypeORM helper for this
    const rows = await this.playHistoryRepo
      .createQueryBuilder('ph')
      .select('DISTINCT ph.userId', 'userId')
      .where('ph.playedAt > :since', { since: thirtyDaysAgo })
      .getRawMany<{ userId: string }>();

    this.logger.log(`Recommendation batch: ${rows.length} active users`);

    for (const { userId } of rows) {
      try {
        await this.recommendationsService.batchComputeForUser(userId);
      } catch (err) {
        this.logger.error(`Batch failed for user ${userId}: ${(err as Error).message}`);
      }
    }

    this.logger.log('Recommendation batch: complete');
  }
}
