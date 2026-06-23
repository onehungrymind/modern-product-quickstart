import { randomUUID } from 'node:crypto';
import { IncomingMessage, ServerResponse } from 'node:http';

import { Module } from '@nestjs/common';
import { APP_GUARD, APP_PIPE } from '@nestjs/core';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { LoggerModule } from 'nestjs-pino';
import { ZodValidationPipe } from 'nestjs-zod';

import { validateEnv } from '../config/env.schema';
import type { Env } from '../config/env.schema';
import { dataSourceOptions } from '../database/data-source';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { AuthModule } from '../auth/auth.module';
import { UsersModule } from '../users/users.module';
import { LinksModule } from '../links/links.module';
import { ClicksModule } from '../clicks/clicks.module';
import { HealthModule } from '../health/health.module';
import { PortsModule } from '../ports/ports.module';
import { RedirectModule } from '../redirect/redirect.module';
import { TestModule } from '../test/test.module';

@Module({
  imports: [
    /**
     * Global config with strict Zod-based env validation.
     * Boot fails loud if required env vars are missing or malformed.
     */
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env'],
      validate: (raw: Record<string, unknown>) => validateEnv(raw),
    }),

    /**
     * Global rate limiting (OWASP A04:2021 — Rate Limiting / DoS protection).
     * 200 requests per IP per minute. Conservative enough that the e2e suite and
     * the observability probe never hit the ceiling; aggressive enough that a burst
     * exploit of ~250 rapid requests will receive at least one 429.
     */
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 200 }]),

    /**
     * Structured JSON logging with auto-generated correlation IDs.
     * Pretty-printed in dev for readability; raw JSON in prod for log aggregators.
     */
    LoggerModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService<Env, true>) => {
        const nodeEnv = config.get('NODE_ENV', { infer: true });
        const logLevel = config.get('LOG_LEVEL', { infer: true });
        const isDev = nodeEnv === 'development';
        return {
          pinoHttp: {
            level: logLevel,
            // eslint-disable-next-line @typescript-eslint/no-unused-vars
            genReqId: (req: IncomingMessage, _res: ServerResponse) => {
              const existing = req.headers['x-request-id'];
              if (existing) {
                return Array.isArray(existing)
                  ? (existing[0] ?? randomUUID())
                  : existing;
              }
              return randomUUID();
            },
            customProps: (req: IncomingMessage) => ({
              requestId: (req as IncomingMessage & { id?: string | number }).id,
            }),
            ...(isDev
              ? {
                  transport: {
                    target: 'pino-pretty',
                    options: { colorize: true, singleLine: true },
                  },
                }
              : {}),
          },
        };
      },
    }),

    /**
     * PostgreSQL TypeORM configuration.
     * synchronize: false — always use migrations, never auto-sync.
     * migrationsRun: true — auto-run pending migrations on boot.
     */
    TypeOrmModule.forRoot({ ...dataSourceOptions, autoLoadEntities: true }),

    PortsModule,
    AuthModule,
    UsersModule,
    LinksModule,
    ClicksModule,
    HealthModule,
    RedirectModule,
    TestModule,
  ],
  providers: [
    { provide: APP_PIPE, useClass: ZodValidationPipe },
    // Rate limiting guard — must come before JwtAuthGuard so unauthenticated
    // bursts (e.g. login brute-force) are throttled at the edge.
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useClass: JwtAuthGuard },
  ],
})
export class AppModule {}
