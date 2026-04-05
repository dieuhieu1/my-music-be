import { registerAs } from '@nestjs/config';
import { TypeOrmModuleOptions } from '@nestjs/typeorm';
import { join } from 'path';

export const databaseConfig = registerAs(
  'database',
  (): TypeOrmModuleOptions => ({
    type: 'postgres',
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432', 10),
    username: process.env.DB_USER || 'mymusic',
    password: process.env.DB_PASSWORD || 'mymusic_password',
    database: process.env.DB_NAME || 'mymusic_db',
    // Entities are registered per-module via TypeOrmModule.forFeature()
    autoLoadEntities: true,
    // Always false — use migrations for schema changes
    synchronize: false,
    logging: process.env.NODE_ENV === 'development',
    migrations: [join(__dirname, '..', 'database', 'migrations', '*.{ts,js}')],
    migrationsRun: false,
  }),
);
