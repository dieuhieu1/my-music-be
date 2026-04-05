import { Injectable, OnModuleDestroy } from '@nestjs/common';
import {
  HealthIndicator,
  HealthIndicatorResult,
  HealthCheckError,
} from '@nestjs/terminus';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

@Injectable()
export class RedisHealthIndicator extends HealthIndicator implements OnModuleDestroy {
  private readonly client: Redis;

  constructor(private readonly config: ConfigService) {
    super();
    this.client = new Redis({
      host: config.get<string>('redis.host'),
      port: config.get<number>('redis.port'),
      password: config.get<string>('redis.password') || undefined,
      // Don't auto-connect — only connect when ping is called
      lazyConnect: true,
      // Don't spam retries in health checks
      maxRetriesPerRequest: 1,
      enableReadyCheck: false,
    });
  }

  async pingCheck(key: string): Promise<HealthIndicatorResult> {
    try {
      await this.client.ping();
      return this.getStatus(key, true);
    } catch (error) {
      throw new HealthCheckError(
        'Redis ping failed',
        this.getStatus(key, false, { error: (error as Error).message }),
      );
    }
  }

  onModuleDestroy() {
    this.client.disconnect();
  }
}
