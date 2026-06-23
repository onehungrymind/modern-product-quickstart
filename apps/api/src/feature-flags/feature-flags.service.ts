import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { FeatureFlagEntity } from './entities/feature-flag.entity';

/**
 * Reads feature flags from the database with a short TTL cache, so toggling a
 * flag row takes effect within seconds across all replicas — no redeploy.
 */
@Injectable()
export class FeatureFlagsService {
  private readonly cache = new Map<string, { value: boolean; at: number }>();
  private readonly ttlMs = 5000;

  constructor(
    @InjectRepository(FeatureFlagEntity)
    private readonly repo: Repository<FeatureFlagEntity>,
  ) {}

  async isEnabled(key: string, now: number = Date.now()): Promise<boolean> {
    const cached = this.cache.get(key);
    if (cached && now - cached.at < this.ttlMs) return cached.value;
    const row = await this.repo.findOne({ where: { key } });
    const value = row?.enabled ?? false;
    this.cache.set(key, { value, at: now });
    return value;
  }
}
