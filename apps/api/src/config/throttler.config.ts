import { registerAs } from '@nestjs/config';

export const throttlerConfig = registerAs('throttler', () => ({
  // Applied globally via APP_GUARD in AppModule
  general: { ttl: 60_000, limit: 200 },
  // Applied per-route with @Throttle({ auth: {} }) in Phase 2
  auth: { ttl: 60_000, limit: 10 },
  // Applied per-route with @Throttle({ upload: {} }) in Phase 4
  upload: { ttl: 60_000, limit: 5 },
}));
