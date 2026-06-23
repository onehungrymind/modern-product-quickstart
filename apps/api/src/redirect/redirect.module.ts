import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { LinkEntity } from '../links/entities/link.entity';
import { ClicksModule } from '../clicks/clicks.module';
import { RedirectService } from './redirect.service';

/**
 * No controller: the root `/:slug` redirect is served via an Express middleware
 * in main.ts (so it stays outside the global `/api` prefix). This module only
 * provides RedirectService so main.ts can resolve it with `app.get(...)`.
 */
@Module({
  imports: [TypeOrmModule.forFeature([LinkEntity]), ClicksModule],
  providers: [RedirectService],
  exports: [RedirectService],
})
export class RedirectModule {}
