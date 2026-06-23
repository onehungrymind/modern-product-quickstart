import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { createHash } from 'node:crypto';
import { ClickEntity } from './entities/click.entity';

@Injectable()
export class ClicksService {
  constructor(
    @InjectRepository(ClickEntity)
    private readonly repo: Repository<ClickEntity>,
  ) {}

  async record(
    linkId: string,
    opts: {
      ip?: string;
      userAgent?: string;
      referrer?: string;
    },
  ): Promise<ClickEntity> {
    const ipHash = opts.ip
      ? createHash('sha256').update(opts.ip).digest('hex')
      : null;

    const entity = this.repo.create({
      linkId,
      occurredAt: new Date(),
      ipHash,
      userAgent: opts.userAgent ?? null,
      referrer: opts.referrer ?? null,
      country: null,
    });
    return this.repo.save(entity);
  }
}
