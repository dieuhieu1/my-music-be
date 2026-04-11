import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, LessThan } from 'typeorm';
import { Job } from 'bullmq';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { QUEUE_NAMES } from '../queue.constants';
import { Session } from '../../auth/entities/session.entity';
import { VerificationCode } from '../../auth/entities/verification-code.entity';
import { PasswordReset } from '../../auth/entities/password-reset.entity';

export interface SessionCleanupPayload {
  sessionId: string;
}

// BL-42: Hard-delete soft-deleted sessions after TTL
@Processor(QUEUE_NAMES.SESSION_CLEANUP)
export class SessionCleanupWorker extends WorkerHost {
  private readonly logger = new Logger(SessionCleanupWorker.name);

  constructor(
    @InjectRepository(Session) private readonly sessions: Repository<Session>,
    @InjectRepository(VerificationCode) private readonly codes: Repository<VerificationCode>,
    @InjectRepository(PasswordReset) private readonly resets: Repository<PasswordReset>,
  ) {
    super();
  }

  async process(job: Job<SessionCleanupPayload>): Promise<void> {
    this.logger.log(`Hard-deleting session ${job.data.sessionId}`);
    await this.sessions.delete({ id: job.data.sessionId });
  }

  // BL-25: Purge expired soft-deleted sessions — runs every hour
  @Cron(CronExpression.EVERY_HOUR)
  async purgeExpiredSessions(): Promise<void> {
    const result = await this.sessions
      .createQueryBuilder()
      .delete()
      .where('expires_at < NOW()')
      .execute();
    if (result.affected) {
      this.logger.log(`Purged ${result.affected} expired sessions`);
    }
  }

  // BL-27: Purge expired verification codes — runs every 30 minutes
  @Cron(CronExpression.EVERY_30_MINUTES)
  async purgeExpiredVerificationCodes(): Promise<void> {
    const [codesResult, resetsResult] = await Promise.all([
      this.codes.delete({ expiresAt: LessThan(new Date()), used: false }),
      this.resets.delete({ expiresAt: LessThan(new Date()), used: false }),
    ]);
    const total = (codesResult.affected ?? 0) + (resetsResult.affected ?? 0);
    if (total) {
      this.logger.log(`Purged ${total} expired verification/reset codes`);
    }
  }
}
