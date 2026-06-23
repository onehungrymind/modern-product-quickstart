import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { FeatureFlagEntity } from './entities/feature-flag.entity';
import { FeatureFlagsService } from './feature-flags.service';

@Module({
  imports: [TypeOrmModule.forFeature([FeatureFlagEntity])],
  providers: [FeatureFlagsService],
  exports: [FeatureFlagsService],
})
export class FeatureFlagsModule {}
