import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { metrics } from '@opentelemetry/api';
import { isActive } from '@tracer/common-models';
import { LinkEntity } from '../links/entities/link.entity';
import { ClicksService } from '../clicks/clicks.service';

export interface ResolveContext {
  ip?: string;
  userAgent?: string;
  referrer?: string;
}

// ---------------------------------------------------------------------------
// SLI meters — created once at module load, bound to the tracer-api meter.
// ---------------------------------------------------------------------------
const meter = metrics.getMeter('tracer-api');

const redirectsTotal = meter.createCounter('tracer_redirects_total', {
  description: 'Total redirect resolutions by outcome (redirect | not_found)',
});

const redirectDurationMs = meter.createHistogram('tracer_redirect_duration_ms', {
  description: 'Duration of resolveTarget in milliseconds',
  unit: 'ms',
});

const redirectErrorsTotal = meter.createCounter('tracer_redirect_errors_total', {
  description: 'Total failed resolveTarget calls',
});

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
   *
   * SLI instrumentation: records tracer_redirects_total, tracer_redirect_duration_ms,
   * and tracer_redirect_errors_total on every call.
   */
  async resolveTarget(
    slug: string,
    ctx: ResolveContext,
  ): Promise<string | null> {
    // ---------------------------------------------------------------------------
    // Synthetic SLO-burn hook — TEST ONLY.
    // Production NEVER sets SLO_BURN_DELAY_MS. When set (e.g. in the readiness
    // probe that asserts the p99 SLO alert fires), this injects artificial latency
    // so the p99 > 100 ms threshold is breached and the Grafana alert triggers.
    // ---------------------------------------------------------------------------
    if (process.env.SLO_BURN_DELAY_MS) {
      await new Promise<void>((resolve) =>
        setTimeout(resolve, Number(process.env.SLO_BURN_DELAY_MS)),
      );
    }

    const start = performance.now();

    try {
      const link = await this.links.findOne({ where: { slug } });

      if (
        !link ||
        !isActive({
          expires_at: link.expiresAt ? link.expiresAt.toISOString() : null,
        })
      ) {
        const durationMs = performance.now() - start;
        redirectDurationMs.record(durationMs, { outcome: 'not_found' });
        redirectsTotal.add(1, { outcome: 'not_found' });
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

      const durationMs = performance.now() - start;
      redirectDurationMs.record(durationMs, { outcome: 'redirect' });
      redirectsTotal.add(1, { outcome: 'redirect' });

      return link.targetUrl;
    } catch (err) {
      const durationMs = performance.now() - start;
      redirectDurationMs.record(durationMs, { outcome: 'error' });
      redirectErrorsTotal.add(1);
      throw err;
    }
  }
}
