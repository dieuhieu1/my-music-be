import { registerAs } from '@nestjs/config';
import { TypeOrmModuleOptions } from '@nestjs/typeorm';
import { join } from 'path';
import { PrettyTypeOrmLogger } from '../common/logger/typeorm.logger';

export const databaseConfig = registerAs(
  'database',
  (): TypeOrmModuleOptions => ({
    type: 'postgres',
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432', 10),
    username: process.env.DB_USER || 'mymusic',
    password: process.env.DB_PASSWORD || 'mymusic_password',
    database: process.env.DB_NAME || 'mymusic_db',
    autoLoadEntities: true,
    synchronize: process.env.NODE_ENV !== 'production',
    logger: new PrettyTypeOrmLogger(),
    migrations: [join(__dirname, '..', 'database', 'migrations', '*.{ts,js}')],
    migrationsRun: false,
  }),
);
