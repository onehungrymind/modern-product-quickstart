import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ClickEntity } from './entities/click.entity';
import { ClicksService } from './clicks.service';

@Module({
  imports: [TypeOrmModule.forFeature([ClickEntity])],
  providers: [ClicksService],
  exports: [ClicksService],
})
export class ClicksModule {}
