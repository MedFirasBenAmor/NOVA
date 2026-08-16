import { Module } from '@nestjs/common';
import { DatapointsController } from './datapoints.controller';
import { DatapointsService } from './datapoints.service';
import { RequirementProfileService } from './requirement-profile.service';

@Module({
  controllers: [DatapointsController],
  providers: [DatapointsService, RequirementProfileService],
  exports: [DatapointsService, RequirementProfileService],
})
export class DatapointsModule {}
