import { DataSource } from 'typeorm';
import * as dotenv from 'dotenv';
import { join } from 'path';

// Load .env for CLI commands (migration:generate, migration:run, etc.)
dotenv.config({ path: join(__dirname, '..', '..', '..', '.env') });

// Used exclusively by the TypeORM CLI.
// The NestJS app uses TypeOrmModule.forRootAsync() in AppModule instead.
export const AppDataSource = new DataSource({
  type: 'postgres',
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432', 10),
  username: process.env.DB_USER || 'mymusic',
  password: process.env.DB_PASSWORD || 'mymusic_password',
  database: process.env.DB_NAME || 'mymusic_db',
  entities: [join(__dirname, '..', '**', '*.entity.{ts,js}')],
  migrations: [join(__dirname, 'migrations', '*.{ts,js}')],
  synchronize: false,
  logging: process.env.NODE_ENV === 'development',
});
