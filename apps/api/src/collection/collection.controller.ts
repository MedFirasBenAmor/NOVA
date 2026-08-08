import {
  Body,
  Controller,
  Param,
  ParseUUIDPipe,
  Post,
  UseGuards,
} from '@nestjs/common';
import { AnonymousSessionGuard } from '../auth/anonymous-session.guard';
import { CollectionStrategyService } from './collection-strategy.service';
import { RespondCollectionActionDto } from './dto/respond-collection-action.dto';
import { AnswerDatapointDto } from './dto/answer-datapoint.dto';

@Controller('leads/:leadId/collection-actions')
@UseGuards(AnonymousSessionGuard)
export class CollectionController {
  constructor(private readonly strategy: CollectionStrategyService) {}

  @Post(':actionId/respond')
  respond(
    @Param('leadId', ParseUUIDPipe) leadId: string,
    @Param('actionId', ParseUUIDPipe) actionId: string,
    @Body() dto: RespondCollectionActionDto,
  ) {
    return this.strategy.respond(leadId, actionId, dto.decision);
  }

  @Post(':actionId/answer')
  answer(
    @Param('leadId', ParseUUIDPipe) leadId: string,
    @Param('actionId', ParseUUIDPipe) actionId: string,
    @Body() dto: AnswerDatapointDto,
  ) {
    return this.strategy.answer(leadId, actionId, dto.value, dto.message);
  }
}
