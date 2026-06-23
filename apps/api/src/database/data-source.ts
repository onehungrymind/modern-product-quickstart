import 'reflect-metadata';
import { DataSource, type DataSourceOptions } from 'typeorm';
import { UserEntity } from '../users/entities/user.entity';
import { LinkEntity } from '../links/entities/link.entity';
import { ClickEntity } from '../clicks/entities/click.entity';

export const dataSourceOptions: DataSourceOptions = {
  type: 'postgres',
  url:
    process.env['DATABASE_URL'] ??
    'postgres://tracer:tracer@localhost:5433/tracer',
  entities: [UserEntity, LinkEntity, ClickEntity],
  synchronize: true,
  logging: process.env['DB_LOGGING'] === 'true',
  ssl:
    process.env['DATABASE_SSL'] === 'true'
      ? { rejectUnauthorized: false }
      : false,
};

export const AppDataSource = new DataSource(dataSourceOptions);
