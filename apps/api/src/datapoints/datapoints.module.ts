import { Module } from '@nestjs/common';
import { DatapointsController } from './datapoints.controller';
import { DatapointsService } from './datapoints.service';
import { RequirementProfileService } from './requirement-profile.service';
import { EntityLifecycleService } from './entity-lifecycle.service';

@Module({
  controllers: [DatapointsController],
  providers: [
    DatapointsService,
    RequirementProfileService,
    EntityLifecycleService,
  ],
  exports: [
    DatapointsService,
    RequirementProfileService,
    EntityLifecycleService,
  ],
})
export class DatapointsModule {}
