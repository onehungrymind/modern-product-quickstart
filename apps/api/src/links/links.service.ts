import {
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { randomBytes } from 'node:crypto';
import type { Link, ClickStats } from '@tracer/common-models';
import { generateSlug } from '@tracer/common-models';
import { LinkEntity } from './entities/link.entity';
import { ClickEntity } from '../clicks/entities/click.entity';
import {
  URL_PREVIEW_PROVIDER,
  type UrlPreviewProvider,
} from '../ports/url-preview/url-preview.provider';
import { FeatureFlagsService } from '../feature-flags/feature-flags.service';
import type { CreateLinkDto } from './dto/create-link.dto';

function toDto(e: LinkEntity): Link {
  return {
    id: e.id,
    slug: e.slug,
    target_url: e.targetUrl,
    title: e.title ?? null,
    owner_id: e.ownerId,
    created_at: e.createdAt.toISOString(),
    expires_at: e.expiresAt ? e.expiresAt.toISOString() : null,
  };
}

function toClickDto(e: ClickEntity) {
  return {
    id: e.id,
    link_id: e.linkId,
    occurred_at: e.occurredAt.toISOString(),
    ip_hash: e.ipHash ?? null,
    user_agent: e.userAgent ?? null,
    referrer: e.referrer ?? null,
    country: e.country ?? null,
  };
}

function cryptoRandom(): number {
  const buf = randomBytes(4);
  const val = buf.readUInt32BE(0);
  return val / 0x100000000;
}

@Injectable()
export class LinksService {
  constructor(
    @InjectRepository(LinkEntity)
    private readonly links: Repository<LinkEntity>,
    @InjectRepository(ClickEntity)
    private readonly clicks: Repository<ClickEntity>,
    @Inject(URL_PREVIEW_PROVIDER)
    private readonly urlPreview: UrlPreviewProvider,
    private readonly flags: FeatureFlagsService,
  ) {}

  async create(dto: CreateLinkDto, ownerId: string): Promise<Link> {
    let slug: string;

    if (dto.slug) {
      const existing = await this.links.findOne({ where: { slug: dto.slug } });
      if (existing) {
        throw new ConflictException(`Slug "${dto.slug}" is already taken`);
      }
      slug = dto.slug;
    } else {
      // Retry up to 5 times on collision
      slug = await this.mintSlug();
    }

    // Auto-fetching the target's <title> is gated behind a runtime feature flag,
    // so the capability can be released (flag on) without a redeploy.
    let title = dto.title ?? null;
    if (
      (title === null || title === undefined) &&
      (await this.flags.isEnabled('link_title_preview'))
    ) {
      title = await this.urlPreview.fetchTitle(dto.target_url);
    }

    const entity = this.links.create({
      slug,
      targetUrl: dto.target_url,
      title: title ?? null,
      ownerId,
      expiresAt: dto.expires_at ? new Date(dto.expires_at) : null,
    });
    const saved = await this.links.save(entity);
    return toDto(saved);
  }

  async findAll(ownerId: string): Promise<Link[]> {
    const rows = await this.links.find({
      where: { ownerId },
      order: { createdAt: 'DESC' },
    });
    return rows.map(toDto);
  }

  async findOne(id: string, ownerId: string): Promise<Link> {
    const entity = await this.links.findOne({ where: { id, ownerId } });
    if (!entity) throw new NotFoundException('Link not found');
    return toDto(entity);
  }

  async getClickStats(id: string, ownerId: string): Promise<ClickStats> {
    // Verify ownership
    const link = await this.links.findOne({ where: { id, ownerId } });
    if (!link) throw new NotFoundException('Link not found');

    const total = await this.clicks.count({ where: { linkId: id } });
    const recent = await this.clicks.find({
      where: { linkId: id },
      order: { occurredAt: 'DESC' },
      take: 50,
    });

    return {
      link_id: id,
      total,
      recent: recent.map(toClickDto),
    };
  }

  private async mintSlug(attempts = 5): Promise<string> {
    for (let i = 0; i < attempts; i++) {
      const candidate = generateSlug(cryptoRandom);
      const existing = await this.links.findOne({
        where: { slug: candidate },
      });
      if (!existing) return candidate;
    }
    throw new ConflictException('Could not mint a unique slug after retries');
  }
}
