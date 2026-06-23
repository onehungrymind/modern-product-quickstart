import { Module } from '@nestjs/common';
import { APP_GUARD, APP_PIPE } from '@nestjs/core';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ZodValidationPipe } from 'nestjs-zod';
import { dataSourceOptions } from '../database/data-source';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { AuthModule } from '../auth/auth.module';
import { UsersModule } from '../users/users.module';
import { LinksModule } from '../links/links.module';
import { ClicksModule } from '../clicks/clicks.module';
import { HealthModule } from '../health/health.module';
import { PortsModule } from '../ports/ports.module';
import { RedirectModule } from '../redirect/redirect.module';

@Module({
  imports: [
    TypeOrmModule.forRoot({ ...dataSourceOptions, autoLoadEntities: true }),
    PortsModule,
    AuthModule,
    UsersModule,
    LinksModule,
    ClicksModule,
    HealthModule,
    RedirectModule,
  ],
  providers: [
    { provide: APP_PIPE, useClass: ZodValidationPipe },
    { provide: APP_GUARD, useClass: JwtAuthGuard },
  ],
})
export class AppModule {}
