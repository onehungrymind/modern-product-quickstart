import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { LinkEntity } from './entities/link.entity';
import { ClickEntity } from '../clicks/entities/click.entity';
import { LinksService } from './links.service';
import { LinksController } from './links.controller';
import { FeatureFlagsModule } from '../feature-flags/feature-flags.module';

@Module({
  imports: [TypeOrmModule.forFeature([LinkEntity, ClickEntity]), FeatureFlagsModule],
  controllers: [LinksController],
  providers: [LinksService],
  exports: [LinksService],
})
export class LinksModule {}
