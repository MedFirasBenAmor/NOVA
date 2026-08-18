import { Module } from '@nestjs/common';
import { DatapointsController } from './datapoints.controller';
import { DatapointsService } from './datapoints.service';
import { RequirementProfileService } from './requirement-profile.service';
import { EntityLifecycleService } from './entity-lifecycle.service';
import { SectionReviewService } from './section-review.service';

@Module({
  controllers: [DatapointsController],
  providers: [
    DatapointsService,
    RequirementProfileService,
    EntityLifecycleService,
    SectionReviewService,
  ],
  exports: [
    DatapointsService,
    RequirementProfileService,
    EntityLifecycleService,
    SectionReviewService,
  ],
})
export class DatapointsModule {}
