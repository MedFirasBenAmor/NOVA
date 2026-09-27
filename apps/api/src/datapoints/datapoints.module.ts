import { Module } from '@nestjs/common';
import { DatapointsController } from './datapoints.controller';
import { DatapointsService } from './datapoints.service';
import { RequirementProfileService } from './requirement-profile.service';
import { EntityLifecycleService } from './entity-lifecycle.service';
import { EntityRelationService } from './entity-relation.service';
import { SectionReviewService } from './section-review.service';
import { QuestionSequenceService } from './question-sequence.service';

@Module({
  controllers: [DatapointsController],
  providers: [
    DatapointsService,
    RequirementProfileService,
    EntityLifecycleService,
    EntityRelationService,
    SectionReviewService,
    QuestionSequenceService,
  ],
  exports: [
    DatapointsService,
    RequirementProfileService,
    EntityLifecycleService,
    EntityRelationService,
    SectionReviewService,
    QuestionSequenceService,
  ],
})
export class DatapointsModule {}
