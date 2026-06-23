import 'reflect-metadata';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import { NestFactory } from '@nestjs/core';
import type { NextFunction, Request, Response } from 'express';
import { AppModule } from './app/app.module';
import { RedirectService } from './redirect/redirect.service';

/**
 * Bare single-segment paths that are NOT slugs — they belong to the API or the
 * browser, so the redirect middleware must let them fall through.
 */
const RESERVED_ROOT_SEGMENTS = new Set(['api', 'favicon.ico']);

/** Matches exactly one path segment: `/abc123` or `/abc123/` (no nested paths). */
const BARE_SEGMENT = /^\/([^/]+)\/?$/;

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.use(helmet());
  app.use(cookieParser());

  const origins = (process.env['CORS_ORIGINS'] ?? 'http://localhost:4200')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  app.enableCors({
    origin: origins.length === 1 && origins[0] === '*' ? true : origins,
    credentials: true,
  });

  // Every Nest controller lives under /api.
  app.setGlobalPrefix('api');

  // The public redirect hot path `GET /:slug` is served at ROOT (outside /api)
  // by an Express middleware, so a bare slug like `/abc123` resolves while
  // `/api/links`, `/api/health`, etc. stay under the prefix.
  const redirect = app.get(RedirectService);
  app.use((req: Request, res: Response, next: NextFunction) => {
    if (req.method !== 'GET') return next();

    const match = BARE_SEGMENT.exec(req.path);
    const slug = match?.[1];
    if (!slug || RESERVED_ROOT_SEGMENTS.has(slug)) return next();

    const referrerHeader = req.headers['referer'] ?? req.headers['referrer'];
    redirect
      .resolveTarget(slug, {
        ip: typeof req.ip === 'string' ? req.ip : undefined,
        userAgent:
          typeof req.headers['user-agent'] === 'string'
            ? req.headers['user-agent']
            : undefined,
        referrer:
          typeof referrerHeader === 'string' ? referrerHeader : undefined,
      })
      .then((target) => {
        if (target) {
          res.redirect(302, target);
        } else {
          next();
        }
      })
      .catch(() => next());
  });

  const port = process.env['PORT'] ?? 3000;
  await app.listen(port);
}

bootstrap().catch((err) => {
  console.error('Failed to bootstrap Tracer API:', err);
  process.exit(1);
});
