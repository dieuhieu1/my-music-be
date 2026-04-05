import { registerAs } from '@nestjs/config';

export const redisConfig = registerAs('redis', () => ({
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379', 10),
  // Undefined means no password — ioredis/BullMQ handle this correctly
  password: process.env.REDIS_PASSWORD || undefined,
}));
