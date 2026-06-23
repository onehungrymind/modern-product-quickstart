import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { LinkEntity } from './entities/link.entity';
import { ClickEntity } from '../clicks/entities/click.entity';
import { LinksService } from './links.service';
import { LinksController } from './links.controller';

@Module({
  imports: [TypeOrmModule.forFeature([LinkEntity, ClickEntity])],
  controllers: [LinksController],
  providers: [LinksService],
  exports: [LinksService],
})
export class LinksModule {}
