import 'dotenv/config';
import 'reflect-metadata';
import { DataSource, type DataSourceOptions } from 'typeorm';
import { UserEntity } from '../users/entities/user.entity';
import { LinkEntity } from '../links/entities/link.entity';
import { ClickEntity } from '../clicks/entities/click.entity';
import { FeatureFlagEntity } from '../feature-flags/entities/feature-flag.entity';
import { InitialSchema1782220891606 } from './migrations/1782220891606-InitialSchema';
import { AddFeatureFlags1782300000000 } from './migrations/1782300000000-AddFeatureFlags';

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

  // Entities AND migrations are listed explicitly (no glob) so they survive the
  // webpack bundle — a fresh container self-migrates on boot (migrationsRun) with
  // no migration files on disk. Add each new migration class to this array.
  entities: [UserEntity, LinkEntity, ClickEntity, FeatureFlagEntity],

  migrations: [InitialSchema1782220891606, AddFeatureFlags1782300000000],

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
