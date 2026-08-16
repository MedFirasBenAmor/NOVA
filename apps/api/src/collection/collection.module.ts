import { Module } from '@nestjs/common';
import { CollectionStrategyService } from './collection-strategy.service';
import { CollectionController } from './collection.controller';
import { DatapointsModule } from '../datapoints/datapoints.module';
import { ConversationsModule } from '../conversations/conversations.module';
import { IntakeOrchestratorService } from './intake-orchestrator.service';

@Module({
  imports: [DatapointsModule, ConversationsModule],
  controllers: [CollectionController],
  providers: [CollectionStrategyService, IntakeOrchestratorService],
  exports: [CollectionStrategyService, IntakeOrchestratorService],
})
export class CollectionModule {}
