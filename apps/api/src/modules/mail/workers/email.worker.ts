import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { QUEUE_NAMES } from '../../queue/queue.constants';
import { MailService, SendMailOptions } from '../mail.service';

export type EmailJobPayload = SendMailOptions;

@Processor(QUEUE_NAMES.EMAIL)
export class EmailWorker extends WorkerHost {
  private readonly logger = new Logger(EmailWorker.name);

  constructor(private readonly mailService: MailService) {
    super();
  }

  async process(job: Job<EmailJobPayload>): Promise<void> {
    this.logger.log(`Processing email job ${job.id} → ${job.data.to}`);
    await this.mailService.send(job.data);
  }
}
