import 'dotenv/config';
import 'reflect-metadata';
import { join } from 'node:path';
import { DataSource, type DataSourceOptions } from 'typeorm';
import { UserEntity } from '../users/entities/user.entity';
import { LinkEntity } from '../links/entities/link.entity';
import { ClickEntity } from '../clicks/entities/click.entity';

/**
 * Postgres-only DataSource.
 *
 * Two exports:
 *  - `dataSourceOptions` — plain options object consumed by TypeOrmModule.forRoot()
 *    in app.module.ts (NestJS runtime).
 *  - `AppDataSource` — instantiated DataSource for the TypeORM CLI
 *    (`npm run migration:run`, `npm run migration:generate`, etc.).
 *
 * synchronize: false — never auto-sync; always use migrations.
 * migrationsRun: true — auto-run pending migrations on boot.
 */
export const dataSourceOptions: DataSourceOptions = {
  type: 'postgres',
  url: process.env['DATABASE_URL'],

  // Entities are listed explicitly (no glob) so the migration CLI can resolve
  // them without ts-node glob issues.
  entities: [UserEntity, LinkEntity, ClickEntity],

  migrations: [join(__dirname, 'migrations', '*.{ts,js}')],

  // Never auto-sync — always use migrations.
  synchronize: false,

  // Auto-run pending migrations on boot.
  migrationsRun: true,

  logging: process.env['DB_LOGGING'] === 'true',

  ssl:
    process.env['DATABASE_SSL'] === 'true'
      ? { rejectUnauthorized: false }
      : false,
};

/** CLI entry-point: `typeorm-ts-node-commonjs migration:run -d apps/api/src/database/data-source.ts` */
export const AppDataSource = new DataSource(dataSourceOptions);
