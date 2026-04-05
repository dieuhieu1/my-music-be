import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BullModule } from '@nestjs/bullmq';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { ScheduleModule } from '@nestjs/schedule';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerStorageRedisService } from '@nest-lab/throttler-storage-redis';
import Redis from 'ioredis';

import { databaseConfig } from './config/database.config';
import { redisConfig } from './config/redis.config';
import { minioConfig } from './config/minio.config';
import { jwtConfig } from './config/jwt.config';
import { throttlerConfig } from './config/throttler.config';

import { HealthModule } from './modules/health/health.module';
import { StorageModule } from './modules/storage/storage.module';
import { QueueModule } from './modules/queue/queue.module';

@Module({
  imports: [
    // ── Config (global — available everywhere via ConfigService) ──────────
    ConfigModule.forRoot({
      isGlobal: true,
      load: [databaseConfig, redisConfig, minioConfig, jwtConfig, throttlerConfig],
      envFilePath: '.env',
    }),

    // ── Database ──────────────────────────────────────────────────────────
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => config.get('database'),
    }),

    // ── BullMQ (async job queues) ─────────────────────────────────────────
    BullModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        connection: {
          host: config.get<string>('redis.host'),
          port: config.get<number>('redis.port'),
          password: config.get<string>('redis.password') || undefined,
        },
      }),
    }),

    // ── Rate limiting (Redis-backed, 200 req/min default) ─────────────────
    ThrottlerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        throttlers: [
          {
            name: 'general',
            ttl: config.get<number>('throttler.general.ttl'),
            limit: config.get<number>('throttler.general.limit'),
          },
        ],
        storage: new ThrottlerStorageRedisService(
          new Redis({
            host: config.get<string>('redis.host'),
            port: config.get<number>('redis.port'),
            password: config.get<string>('redis.password') || undefined,
          }),
        ),
      }),
    }),

    // ── Cron jobs ─────────────────────────────────────────────────────────
    ScheduleModule.forRoot(),

    // ── Feature modules ───────────────────────────────────────────────────
    HealthModule,
    StorageModule,
    QueueModule,

    // Phase 2+: AuthModule, UsersModule, ArtistProfileModule, MailModule ...
  ],
  providers: [
    // Global rate limiting guard (general 200/min — auth/upload routes
    // override this with @SkipThrottle() + their own @Throttle() in Phase 2)
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule {}
