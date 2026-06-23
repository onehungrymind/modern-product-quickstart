import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';

const DOMAIN_TABLES = ['clicks', 'links', 'users'];

@Injectable()
export class TestService {
  constructor(
    @InjectDataSource()
    private readonly dataSource: DataSource,
  ) {}

  async reset(): Promise<void> {
    await this.dataSource.query(
      `TRUNCATE TABLE ${DOMAIN_TABLES.join(', ')} RESTART IDENTITY CASCADE`,
    );
  }
}
