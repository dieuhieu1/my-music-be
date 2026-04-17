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
import { dspConfig } from './config/dsp.config';

import { HealthModule } from './modules/health/health.module';
import { StorageModule } from './modules/storage/storage.module';
import { QueueModule } from './modules/queue/queue.module';
import { MailModule } from './modules/mail/mail.module';
import { AuthModule } from './modules/auth/auth.module';
import { UsersModule } from './modules/users/users.module';
import { ArtistProfileModule } from './modules/artist-profile/artist-profile.module';
import { SongsModule } from './modules/songs/songs.module';
import { AlbumsModule } from './modules/albums/albums.module';
import { GenresModule } from './modules/genres/genres.module';
import { JwtAuthGuard } from './common/guards/jwt-auth.guard';

@Module({
  imports: [
    // ── Config (global) ────────────────────────────────────────────────────
    ConfigModule.forRoot({
      isGlobal: true,
      load: [databaseConfig, redisConfig, minioConfig, jwtConfig, throttlerConfig, dspConfig],
      envFilePath: '.env',
    }),

    // ── Database ───────────────────────────────────────────────────────────
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => config.get('database'),
    }),

    // ── BullMQ ─────────────────────────────────────────────────────────────
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

    // ── Rate limiting (Redis-backed) ───────────────────────────────────────
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

    // ── Cron jobs ──────────────────────────────────────────────────────────
    ScheduleModule.forRoot(),

    // ── Infrastructure modules ─────────────────────────────────────────────
    HealthModule,
    StorageModule,
    QueueModule,
    MailModule,

    // ── Phase 2: Auth ──────────────────────────────────────────────────────
    AuthModule,

    // ── Phase 3: User & Artist Profiles ───────────────────────────────────
    UsersModule,
    ArtistProfileModule,

    // ── Phase 4A: Content Upload & DSP Processing ──────────────────────────
    SongsModule,
    AlbumsModule,
    GenresModule,
  ],
  providers: [
    // Global rate limiting
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    // Global JWT auth — @Public() decorator bypasses this
    { provide: APP_GUARD, useClass: JwtAuthGuard },
  ],
})
export class AppModule {}
