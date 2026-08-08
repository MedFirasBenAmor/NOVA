import { Module } from '@nestjs/common';
import { CollectionStrategyService } from './collection-strategy.service';
import { CollectionController } from './collection.controller';
import { DatapointsModule } from '../datapoints/datapoints.module';
import { ConversationsModule } from '../conversations/conversations.module';

@Module({
  imports: [DatapointsModule, ConversationsModule],
  controllers: [CollectionController],
  providers: [CollectionStrategyService],
  exports: [CollectionStrategyService],
})
export class CollectionModule {}
