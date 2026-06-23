import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { isActive } from '@tracer/common-models';
import { LinkEntity } from '../links/entities/link.entity';
import { ClicksService } from '../clicks/clicks.service';

export interface ResolveContext {
  ip?: string;
  userAgent?: string;
  referrer?: string;
}

/**
 * The redirect hot path (`GET /:slug`). Lives behind an Express middleware in
 * main.ts (not a Nest controller) so the route sits at the API root, outside the
 * global `/api` prefix.
 */
@Injectable()
export class RedirectService {
  constructor(
    @InjectRepository(LinkEntity)
    private readonly links: Repository<LinkEntity>,
    private readonly clicks: ClicksService,
  ) {}

  /**
   * Resolve a slug to its target URL if the link exists and is active
   * (non-expired). Records a Click as a fire-and-forget side effect.
   * Returns the target URL, or null if not found / expired.
   */
  async resolveTarget(
    slug: string,
    ctx: ResolveContext,
  ): Promise<string | null> {
    const link = await this.links.findOne({ where: { slug } });

    if (
      !link ||
      !isActive({
        expires_at: link.expiresAt ? link.expiresAt.toISOString() : null,
      })
    ) {
      return null;
    }

    // Fire-and-forget click recording — never blocks or fails the redirect.
    this.clicks
      .record(link.id, {
        ip: ctx.ip,
        userAgent: ctx.userAgent,
        referrer: ctx.referrer,
      })
      .catch(() => {
        // ignore click recording errors
      });

    return link.targetUrl;
  }
}
