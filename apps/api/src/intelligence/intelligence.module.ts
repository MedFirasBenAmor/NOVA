import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DatapointsModule } from '../datapoints/datapoints.module';
import { ConversationsModule } from '../conversations/conversations.module';
import { CollectionModule } from '../collection/collection.module';
import { IntelligenceController } from './intelligence.controller';
import {
  INTELLIGENCE_PROVIDER,
  type IntelligenceProvider,
} from './intelligence.provider';
import { IntelligenceService } from './intelligence.service';
import { GeminiIntelligenceProvider } from './providers/gemini-intelligence.provider';
import { MockIntelligenceProvider } from './providers/mock-intelligence.provider';

@Module({
  imports: [DatapointsModule, ConversationsModule, CollectionModule],
  controllers: [IntelligenceController],
  providers: [
    IntelligenceService,
    MockIntelligenceProvider,
    GeminiIntelligenceProvider,
    {
      provide: INTELLIGENCE_PROVIDER,
      inject: [
        ConfigService,
        MockIntelligenceProvider,
        GeminiIntelligenceProvider,
      ],
      useFactory: (
        config: ConfigService,
        mock: MockIntelligenceProvider,
        gemini: GeminiIntelligenceProvider,
      ): IntelligenceProvider =>
        config.get<string>('AI_PROVIDER', 'mock') === 'gemini' ? gemini : mock,
    },
  ],
})
export class IntelligenceModule {}
