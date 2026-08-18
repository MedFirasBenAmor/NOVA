import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  UseGuards,
} from '@nestjs/common';
import { AnonymousSessionGuard } from '../auth/anonymous-session.guard';
import { CollectionStrategyService } from './collection-strategy.service';
import { RespondCollectionActionDto } from './dto/respond-collection-action.dto';
import { AnswerDatapointDto } from './dto/answer-datapoint.dto';
import { IntakeOrchestratorService } from './intake-orchestrator.service';

@Controller('leads/:leadId/collection-actions')
@UseGuards(AnonymousSessionGuard)
export class CollectionController {
  constructor(
    private readonly strategy: CollectionStrategyService,
    private readonly intake: IntakeOrchestratorService,
  ) {}

  @Post(':actionId/respond')
  respond(
    @Param('leadId', ParseUUIDPipe) leadId: string,
    @Param('actionId', ParseUUIDPipe) actionId: string,
    @Body() dto: RespondCollectionActionDto,
  ) {
    return this.strategy.respond(leadId, actionId, dto.decision);
  }

  @Get('current')
  current(@Param('leadId', ParseUUIDPipe) leadId: string) {
    return this.intake.selectCore(leadId).then((nextAction) => ({
      nextAction,
    }));
  }

  @Post(':actionId/answer')
  answer(
    @Param('leadId', ParseUUIDPipe) leadId: string,
    @Param('actionId', ParseUUIDPipe) actionId: string,
    @Body() dto: AnswerDatapointDto,
  ) {
    return this.intake
      .isIntakeAction(leadId, actionId)
      .then((isIntake) =>
        isIntake
          ? this.intake.answerIntake(leadId, actionId, dto.value, dto.message)
          : this.strategy.answer(leadId, actionId, dto.value, dto.message),
      );
  }
}
